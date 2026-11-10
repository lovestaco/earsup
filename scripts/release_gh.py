#!/usr/bin/env python3
"""
Render release notes and publish a GitHub release with the extension zip.

IMG:media/file.png  ->  https://raw.githubusercontent.com/lovestaco/earsup/refs/heads/main/media/file.png

Usage:
    python3 scripts/release_gh.py <version>          # publish (tag must exist)
    python3 scripts/release_gh.py <version> --render # just print rendered notes
"""

import os
import re
import subprocess
import sys
import tempfile

REPO = "lovestaco/earsup"
BRANCH = "main"
BASE = f"https://raw.githubusercontent.com/{REPO}/refs/heads/{BRANCH}"

IMG_RE = re.compile(r"IMG:([^\s)\"]+)")


def render(version: str) -> str:
    path = f"docs/releases/{version}.md"
    if not os.path.exists(path):
        sys.exit(f"error: {path} not found. Run 'make release-notes-init VERSION={version}' first.")
    text = open(path).read()
    return IMG_RE.sub(lambda m: f"{BASE}/{m.group(1)}", text)


def publish(version: str, notes: str) -> None:
    tags = subprocess.run(["git", "tag", "-l", version], capture_output=True, text=True).stdout.split()
    if version not in tags:
        sys.exit(f"error: tag {version} not found.")

    asset = f"release/earsup-{version}.zip"
    if not os.path.exists(asset):
        sys.exit(f"error: {asset} not found. Run 'make package' first.")

    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as f:
        f.write(notes)
        tmp = f.name

    try:
        subprocess.run(
            ["gh", "release", "create", version, asset,
             "--repo", REPO,
             "--title", f"EarsUp {version}",
             "--notes-file", tmp,
             "--latest"],
            check=True,
        )
        print(f"released {version}")
    finally:
        os.unlink(tmp)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: release_gh.py <version> [--render]")

    version = sys.argv[1]
    rendered = render(version)

    if "--render" in sys.argv:
        print(rendered)
    else:
        publish(version, rendered)
