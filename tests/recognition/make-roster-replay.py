"""Build camera-replay fixtures from the fixed evaluation photos."""

import argparse
import hashlib
import json
import subprocess
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("coverage_report", type=Path)
    parser.add_argument("photos_directory", type=Path)
    parser.add_argument("output_directory", type=Path)
    args = parser.parse_args()
    report = json.loads(args.coverage_report.read_text())["reports"][-1]
    args.output_directory.mkdir(parents=True, exist_ok=True)

    manifest = []
    for group in report["groups"]:
        group_id = group["id"]
        # Exercise the camera with a known positive when available. Groups
        # without one still get a replay so the missing name is visible.
        row = group.get("example") or next(
            (row for row in report["outcomes"] if row["group"] == group_id),
            None,
        )
        if not row:
            raise ValueError(f"No fixed photo for {group_id}")
        source = args.photos_directory / row["file"]
        target = args.output_directory / f"{group_id}.mp4"
        subprocess.run(
            [
                "ffmpeg", "-loglevel", "error", "-y", "-loop", "1", "-i",
                str(source), "-t", "16", "-vf",
                "scale=540:676:force_original_aspect_ratio=decrease:force_divisible_by=2,"
                "pad=540:676:(ow-iw)/2:(oh-ih)/2:color=0x7b7568,fps=12",
                "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(target),
            ],
            check=True,
        )
        manifest.append(
            {
                "id": group_id,
                "groupId": group_id,
                "name": group["name"],
                "photoId": row["id"],
                "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            }
        )

    (args.output_directory / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    )


if __name__ == "__main__":
    main()
