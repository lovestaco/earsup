# Development

## Setup

```bash
git clone https://github.com/lovestaco/earsup
cd earsup
npm install
```

## Commands

```bash
make build               # type-check and build the extension into dist/
make dev                 # rebuild the settings panel on every save
make install             # bump the patch version, build, copy to your install folder
make package             # zip dist/ into release/earsup-vX.Y.Z.zip
make docs                # serve these docs at http://127.0.0.1:8000
make release-notes-init  # create docs/releases/vX.Y.Z.md from the template
make release             # tag, push, and publish a GitHub release with the zip
```

After `make build`, load `dist/` with **Load unpacked** in `chrome://extensions`. After a change, click the reload arrow on the EarsUp card and refresh the page.

`make install` copies the build to `$EARSUP_INSTALL_DIR`. Set it to the folder Chrome loads EarsUp from, for example:

```bash
export EARSUP_INSTALL_DIR=/mnt/c/Users/<you>/Downloads/EarsUp
```

## Project layout

```
public/            manifest.json, icons, bunny artwork (copied into dist/ as is)
src/background/    service worker: Gemini calls, history, side panel, shortcuts
src/content/       runs on every page: play buttons, reading, player, follow-along
src/options/       React settings panel (General, Voices, Sites, History, About)
src/shared/        settings, site rules, text chunking, tooltips
scripts/           release and docs helpers
docs/              this site (MkDocs Material)
media/             screenshots and artwork for the README, docs, and releases
```

The settings panel is built as a normal Vite page. The content script and the service worker are each built as one IIFE file (`vite.scripts.config.ts`), because Chrome does not load ES modules in content scripts.

## How reading works

1. The content script finds headings, and draws play buttons in a shadow DOM overlay. The page DOM is not changed.
2. On play, it walks the page from the heading to the next heading of the same level or higher. It collects the visible text and keeps a map from each character back to its text node.
3. The text is split into paragraphs, then into parts of one or two sentences.
4. Chrome voices use `speechSynthesis`. Their `boundary` events drive the word highlight. Gemini voices are fetched by the service worker, and the word is estimated from audio progress.
5. The sentence and word are painted with `CSS.highlights`, using the character map.

## Docs

The docs use [MkDocs Material](https://squidfunk.github.io/mkdocs-material/). They deploy to GitHub Pages from `.github/workflows/docs.yml` on every push to `main` that touches `docs/`, `media/`, or `mkdocs.yml`.

```bash
pip install mkdocs==1.6.1 mkdocs-material==9.7.6
mkdocs serve
```

`docs/media` is a link to `media/`, so the README, the docs, and the release notes share the same images.

## Releases

1. `make release-notes-init VERSION=v1.2.3` and fill in `docs/releases/v1.2.3.md`. Write images as `IMG:media/file.png`.
2. Add the new page to the `Releases` nav in `mkdocs.yml`.
3. Set `"version"` in `public/manifest.json` and `package.json` to `1.2.3`, and commit.
4. `make release VERSION=v1.2.3`. This builds, zips, tags, pushes, and publishes the GitHub release with the zip attached. `IMG:` links become raw GitHub URLs in the release, and relative paths on the docs site.
