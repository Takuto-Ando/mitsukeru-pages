"""Refresh the bundled UI vocabulary with Python and Janome 0.5.0."""
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from janome.tokenizer import Tokenizer

root = Path(__file__).resolve().parents[1]
han = re.compile(r"[々〇㐀-鿿]")
japanese = re.compile(r"[ぁ-ヺ㐀-鿿々〇ー、。！？・「」『』]+")
tokenizer = Tokenizer()
counts = defaultdict(Counter)
sources = {
    phrase
    for path in (root / "src").rglob("*")
    if path.suffix in (".ts", ".tsx", ".json") and "furigana" not in path.parts
    for phrase in japanese.findall(path.read_text())
    if han.search(phrase)
}
for phrase in sorted(sources):
    for token in tokenizer.tokenize(phrase):
        word = token.surface
        if not han.search(word) or token.reading == "*":
            continue
        reading = "".join(
            chr(ord(char) - 0x60) if "ァ" <= char <= "ヶ" else char
            for char in token.reading
        )
        while word and reading and word[-1] == reading[-1] and not han.match(word[-1]):
            word, reading = word[:-1], reading[:-1]
        if word and reading:
            counts[word][reading] += 1

readings = {word: entries.most_common(1)[0][0] for word, entries in sorted(counts.items())}
destination = root / "src/furigana/generated-readings.json"
destination.write_text(json.dumps(readings, ensure_ascii=False, indent=2) + "\n")
