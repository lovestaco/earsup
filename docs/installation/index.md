# Installation

EarsUp is not in the Chrome Web Store yet. You load it from a zip file. This works in Chrome, Edge, Brave, and other Chromium browsers.

## From a release (recommended)

1. Download `earsup-vX.Y.Z.zip` from the [latest release](https://github.com/lovestaco/earsup/releases/latest).
2. Extract it to a folder you will keep, for example `Downloads\EarsUp`. Chrome loads the extension from this folder every time it starts, so do not delete it.
3. Open `chrome://extensions`.
4. Turn on **Developer mode** (top right).
5. Click **Load unpacked** and select the extracted folder. It is the folder that contains `manifest.json`.
6. Click the puzzle icon in the toolbar and pin **EarsUp**.

The settings panel opens on its own the first time. Open any page with headings and you will see the play buttons.

!!! tip "Use a folder outside WSL"
    If you build EarsUp in WSL, copy the build to a Windows folder such as `C:\Users\<you>\Downloads\EarsUp`. Chrome on Windows cannot keep a `\\wsl$` folder loaded reliably.

## Build from source

You need Node.js 18 or later.

```bash
git clone https://github.com/lovestaco/earsup
cd earsup
npm install
npm run build
```

Then load the `dist` folder with **Load unpacked**, as in steps 3–6 above.

## Open the settings

Click the EarsUp icon in the toolbar. The settings open in Chrome's side panel on the right, next to the page you are reading.

## Next steps

<div class="grid cards" markdown>

-   [:material-update: **Update**](update.md)

    Get a new version without losing your settings or history.

-   [:material-trash-can: **Uninstall**](uninstall.md)

    Remove EarsUp and everything it stored.

</div>
