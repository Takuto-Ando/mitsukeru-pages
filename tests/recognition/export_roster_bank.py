"""Build an INT8 BioCLIP bank with one vector for each adopted animal group."""

import argparse
from base64 import b64decode, b64encode
from hashlib import sha256
import json
from pathlib import Path
import re

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

from embed_roster_photos import ROOT, roster_ids


ENCODER_SHA = "bd84391a49fe76923dd5e72bd3a4b0ae05008090b0453517ccf699c1990a513e"
TOKENIZER_SHA = "a83e0809aa4c3af7208b2df632a7a69668c6d48775b3c3fe4e1b1199d1f8b8f4"
# The zoo's scientific names, including older synonyms used by the model.
SCIENTIFIC = {
    "meerkat": "Suricata suricatta", "giraffe": "Giraffa camelopardalis",
    "kyoto-h-cristata": "Hystrix cristata", "kyoto-g-eremita": "Geronticus eremita",
    "kyoto-n-meleagris": "Numida meleagris", "kyoto-p-chilensis": "Phoenicopterus chilensis",
    "kyoto-p-ruber": "Phoenicopterus ruber", "kyoto-p-roseus": "Phoenicopterus roseus",
    "fennec": "Vulpes zerda", "hippo": "Hippopotamus amphibius", "elephant": "Elephas maximus",
    "tapir": "Tapirus terrestris", "hyrax": "Procavia capensis", "mandrill": "Mandrillus sphinx",
    "gibbon": "Hylobates lar", "lemur": "Lemur catta", "gorilla": "Gorilla gorilla",
    "capuchin": "Sapajus apella", "macaque": "Macaca mulatta", "badger": "Meles anakuma",
    "bear": "Ursus thibetanus japonicus", "deer": "Cervus nippon", "bush-dog": "Speothos venaticus",
    "donkey": "Equus asinus", "goat": "Capra hircus", "sheep": "Ovis aries",
    "kyoto-g-senegalensis": "Galago senegalensis", "kyoto-c-didactylus": "Choloepus didactylus",
    "kyoto-l-lynx": "Lynx lynx", "kyoto-p-bengalensis": "Prionailurus bengalensis euptilurus",
    "kyoto-serval": "Leptailurus serval", "kyoto-p-giganteus": "Pteropus giganteus",
    "kyoto-a-fulgens": "Ailurus fulgens",
}
GROUP_CAPTIONS = {
    "goat": "a photo of a domestic goat or sheep",
    "kyoto-p-chilensis": "a photo of a flamingo",
}
DISTINCT = {
    "mandrill": "a photo of a mandrill with a long muzzle and colorful cheeks",
    "macaque": "a photo of a rhesus macaque with a pink face and brown-gray fur",
    "capuchin": "a photo of a tufted capuchin with dark head tufts and a pale face",
    "gibbon": "a photo of a white-handed gibbon with long arms and pale hands",
    "kyoto-a-fulgens": "a photo of a red panda with russet fur and a ringed tail",
    "bear": "a photo of an Asian black bear with a pale crescent on its chest",
    "kyoto-l-lynx": "a photo of a Eurasian lynx with tufted ears and a short tail",
    "kyoto-p-bengalensis": "a photo of a Tsushima leopard cat with small ears and facial stripes",
    "kyoto-serval": "a photo of a serval with long legs and large rounded ears",
}
# Reweight only the groups with a measured regression in the 30-group bank.
FOCUSED_CAPTIONS = {
    "bush-dog": "a photo of a bush dog",
    "kyoto-c-didactylus": "a photo of a two-toed sloth",
}
MANDRILL_REFERENCE_WEIGHT = 0.075

REJECTIONS = (
    "a person", "an empty zoo enclosure", "a landscape without animals", "a blurry photograph",
    "cage bars", "a zoo information board", "pebbles on the ground", "grass and leaves",
    "a rabbit hutch",
)


def captions():
    roster = roster_ids()
    source = (ROOT / "src/recognition/labels.ts").read_text()
    common = {
        "sheep" if label == "a sheep" else id_: label
        for id_, label in re.findall(r'\["([^"]+)", "([^"]+)"\]', source.split("export const rejectionLabels")[0])
    }
    catalog = json.loads((ROOT / "src/content/kyoto-catalog.json").read_text())
    common.update({entry["id"]: entry["prompt"] for entry in catalog if entry.get("prompt")})
    group_prompts = {}
    for id_, group in roster.items():
        name = common[id_]
        bare = re.sub(r"^an? ", "", name)
        animal_photo = f"a photo of {name}"
        prompts = group_prompts.setdefault(group, {"single": [GROUP_CAPTIONS.get(group, animal_photo)], "average": []})
        prompts["average"].extend([bare, animal_photo, SCIENTIFIC[id_], f"{SCIENTIFIC[id_]} ({bare})"])
    return group_prompts


def encode(encoder, tokenizer_path, inputs):
    for path, expected in [(encoder, ENCODER_SHA), (tokenizer_path, TOKENIZER_SHA)]:
        if sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError(f"Unexpected checksum for {path}")
    tokenizer = Tokenizer.from_file(str(tokenizer_path))
    tokenizer.enable_padding(length=77, pad_id=0)
    tokenizer.enable_truncation(max_length=77)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    session = ort.InferenceSession(str(encoder), sess_options=options, providers=["CPUExecutionProvider"])
    tokens = np.array([entry.ids for entry in tokenizer.encode_batch(inputs)], dtype=np.int64)
    embeddings = np.concatenate([
        session.run(None, {"input_ids": tokens[i:i + 16]})[0]
        for i in range(0, len(tokens), 16)
    ]).astype(np.float32)
    embeddings /= np.linalg.norm(embeddings, axis=1, keepdims=True)
    return dict(zip(inputs, embeddings))


def unit(vector):
    return vector / np.linalg.norm(vector)


def quantize(rows):
    return np.rint(rows * (127 / np.abs(rows).max(axis=-1, keepdims=True))).astype(np.int8)


def focus_bank(labels, bank, features, reference_labels, reference_vectors):
    focused = bank.copy()
    for group, caption in FOCUSED_CAPTIONS.items():
        index = labels.index(group)
        text = unit(bank[index].astype(np.float32))
        focused[index] = quantize(0.5 * text + 0.5 * features[caption])
    index = labels.index("mandrill")
    existing = unit(bank[index].astype(np.float32))
    refs = [unit(vector.astype(np.float32)) for label, vector in zip(reference_labels, reference_vectors)
            if label == "mandrill"]
    reference = unit(np.mean(refs, axis=0))
    weight = MANDRILL_REFERENCE_WEIGHT
    focused[index] = quantize((1 - weight) * existing + weight * reference)
    return focused


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("encoder", type=Path)
    parser.add_argument("tokenizer", type=Path)
    parser.add_argument("outdir", type=Path)
    args = parser.parse_args()
    prompt_lists = captions()
    for group, prompts in prompt_lists.items():
        prompts["distinct"] = prompts["average"] + ([DISTINCT[group]] if group in DISTINCT else [])
    for label in REJECTIONS:
        prompt = "a photo of a " + re.sub(r"^an? ", "", label)
        prompt_lists[label] = {mode: [prompt] for mode in ("single", "average", "distinct")}
    strings = list(dict.fromkeys(
        caption for prompts in prompt_lists.values() for mode in prompts.values() for caption in mode
    ))
    strings.extend(caption for caption in FOCUSED_CAPTIONS.values() if caption not in strings)
    features = encode(args.encoder, args.tokenizer, strings)
    args.outdir.mkdir(parents=True, exist_ok=True)
    roster = roster_ids()
    original = json.loads((ROOT / "src/recognition/bioclip-photo-references.json").read_text())
    originals = np.frombuffer(b64decode(original["vectors"]), dtype=np.int8).reshape(-1, 512)
    selected = [(index, id_) for index, id_ in enumerate(original["speciesIds"]) if id_ in roster]
    photo_bank = {"speciesIds": [id_ for _, id_ in selected],
                  "vectors": b64encode(originals[[index for index, _ in selected]].tobytes()).decode("ascii")}
    (args.outdir / "bioclip-photo-references-30.json").write_text(
        json.dumps(photo_bank, separators=(",", ":")) + "\n", encoding="utf-8",
    )
    labels = list(prompt_lists)
    banks = {}
    for mode in ("single", "average", "distinct"):
        bank = np.stack([np.mean([features[prompt] for prompt in prompts[mode]], axis=0)
                         for prompts in prompt_lists.values()])
        banks[mode] = quantize(bank)
    banks["focused"] = focus_bank(labels, banks["distinct"], features, original["speciesIds"], originals)
    for mode, quantized in banks.items():
        content = {"labels": labels, "vectors": b64encode(quantized.tobytes()).decode("ascii")}
        (args.outdir / f"bioclip-labels-30-{mode}.json").write_text(
            json.dumps(content, separators=(",", ":")) + "\n", encoding="utf-8",
        )


if __name__ == "__main__":
    main()
