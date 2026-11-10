#!/usr/bin/env python3
"""Zip dist/ into release/earsup-v<version>.zip, ready for Load unpacked.

The version comes from dist/manifest.json, so run `npm run build` first.
"""

import json
import os
import sys
import zipfile

DIST = "dist"
OUT = "release"


def main() -> None:
    manifest = os.path.join(DIST, "manifest.json")
    if not os.path.exists(manifest):
        sys.exit("error: dist/manifest.json not found. Run `make build` first.")
    version = json.load(open(manifest))["version"]

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"earsup-v{version}.zip")
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(DIST):
            for f in sorted(files):
                full = os.path.join(root, f)
                # files sit at the zip root, so the extracted folder holds manifest.json
                z.write(full, os.path.relpath(full, DIST))
    print(path)


if __name__ == "__main__":
    main()
