"""Encode the existing BioCLIP reference dataset's held-out 30-group photos."""

import argparse
from hashlib import sha256
import json
from pathlib import Path
import re
from time import perf_counter

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[2]
SIZE = (224, 224)
MEAN = np.asarray([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
STD = np.asarray([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)
MODEL_SHA256 = "ae858e6a807b3a19d1e1f9ecbe3cc5302badf0a6a0cddcc5d1728cdf9d28517a"


def roster_ids():
    source = (ROOT / "src/content/adoptedAnimals.ts").read_text()
    ids = {}
    for id_, aliases in re.findall(r'^    id: "([^"]+)",\n    name: "[^"]+",\n(?:    aliases: \[([^\n]+)\],\n)?', source, re.M):
        ids.update(dict.fromkeys([id_, *re.findall(r'"([^"]+)"', aliases)], id_))
    if len(set(ids.values())) != 30:
        raise ValueError("The evaluation expects all 30 adopted animal groups")
    return ids


def photos(manifest, roster):
    data = json.loads(manifest.read_text())["samples"]
    splits_by_author = {}
    hashes = set()
    for row in data:
        author = row["captureGroup"]
        split = row["split"]
        if splits_by_author.setdefault(author, split) != split:
            raise ValueError(f"Photographer group crosses splits: {author}")
        signature = row["downloadSha256"]
        if signature in hashes:
            raise ValueError(f"Duplicate photo hash: {row['id']}")
        hashes.add(signature)
        species = row["speciesId"]
        if split not in {"validation", "test"} or species not in roster:
            continue
        path = manifest.parent / row["file"]
        yield row, roster[species], path


def views(image):
    resampling = Image.Resampling.BICUBIC
    yield "crop", ImageOps.fit(image, SIZE, resampling)
    yield "contain", ImageOps.pad(image, SIZE, resampling, color="#7b7568")
    # Candidate with wider coverage than a square crop and less padding.
    width, height = image.size
    left = max(0, (width - 1.25 * height) / 2)
    top = max(0, (height - 1.25 * width) / 2)
    trimmed = image.crop((round(left), round(top), round(width - left), round(height - top)))
    yield "wide", ImageOps.pad(trimmed, SIZE, resampling, color="#7b7568")


def tensor(image):
    return ((np.asarray(image, dtype=np.float32) / 255 - MEAN) / STD).transpose(2, 0, 1)[None]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if sha256(args.model.read_bytes()).hexdigest() != MODEL_SHA256:
        raise ValueError("Model differs from the deployed BioCLIP INT8 encoder")
    rows = list(photos(args.manifest, roster_ids()))
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    start = perf_counter()
    session = ort.InferenceSession(str(args.model), sess_options=options, providers=["CPUExecutionProvider"])
    session.run(["embedding"], {"pixels": np.zeros((1, 3, 224, 224), dtype=np.float32)})
    print(f"Session ready after warm-up: {(perf_counter() - start) * 1000:.1f} ms", flush=True)
    with args.output.open("w", encoding="utf-8") as output:
        for index, (row, group, path) in enumerate(rows, 1):
            digest = sha256(path.read_bytes()).hexdigest()
            if digest != row["downloadSha256"]:
                raise ValueError(f"Photo hash differs from the manifest: {path}")
            data = {
                "id": row["id"],
                "source": row["sourcePage"],
                "file": row["file"],
                "sha256": digest,
                "species": row["speciesId"],
                "group": group,
                "split": row["split"],
                "views": {},
            }
            with Image.open(path) as photo:
                image = ImageOps.exif_transpose(photo).convert("RGB")
                start = perf_counter()
                for fit, raster in views(image):
                    feature = session.run(["embedding"], {"pixels": tensor(raster)})[0][0]
                    end = perf_counter()
                    data["views"][fit] = {"embedding": feature.tolist(), "ms": (end - start) * 1000}
                    start = end
            print(json.dumps(data, separators=(",", ":")), file=output, flush=True)
            if index % 30 == 0:
                print(f"{index}/{len(rows)} photos encoded", flush=True)


if __name__ == "__main__":
    main()
