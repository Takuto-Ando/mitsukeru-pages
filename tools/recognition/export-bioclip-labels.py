"""Rebuild the BioCLIP prompt bank using the pinned OpenCLIP text export.

Requires numpy, onnxruntime, and tokenizers. From the repository root, run:
  python tools/recognition/export-bioclip-labels.py TEXT_ENCODER TOKENIZER
The pinned model export and tokenizer links are recorded in docs/BIOCLIP.md.
"""
import base64
import json
from pathlib import Path
import re
import sys

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer


def read_labels():
    labels_source = Path("src/recognition/labels.ts").read_text()
    animal_labels = re.findall(
        r'\["([^"]+)", "([^"]+)"\]',
        labels_source.split("export const rejectionLabels")[0],
    )
    catalog = json.loads(Path("src/content/kyoto-catalog.json").read_text())
    known = dict.fromkeys(
        [prompt for _, prompt in animal_labels]
        + [entry["prompt"] for entry in catalog if entry.get("prompt")]
    )
    rejection = re.findall(
        r'"([^"]+)"',
        labels_source.split("export const rejectionLabels = [", 1)[1].split("];", 1)[0],
    )
    return [*known, *rejection]


def main(encoder, tokenizer_path):
    labels = read_labels()
    tokenizer = Tokenizer.from_file(tokenizer_path)
    tokenizer.enable_padding(length=77, pad_id=0)
    tokenizer.enable_truncation(max_length=77)
    captions = ["a photo of a " + re.sub(r"^an? ", "", label) for label in labels]
    tokens = np.array([entry.ids for entry in tokenizer.encode_batch(captions)], dtype=np.int64)
    session = ort.InferenceSession(encoder, providers=["CPUExecutionProvider"])
    vectors = np.concatenate(
        [session.run(None, {"input_ids": tokens[i : i + 16]})[0] for i in range(0, len(tokens), 16)]
    )
    quantized = np.rint(vectors * (127 / np.abs(vectors).max(axis=1, keepdims=True))).astype(np.int8)
    payload = {"labels": labels, "vectors": base64.b64encode(quantized.tobytes()).decode("ascii")}
    Path("src/recognition/bioclip-labels.json").write_text(
        json.dumps(payload, separators=(",", ":")) + "\n"
    )


if __name__ == "__main__":
    main(*sys.argv[1:])
