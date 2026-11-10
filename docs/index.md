---
title: EarsUp
description: Press play on any heading and EarsUp reads that section aloud.
---

# EarsUp

![EarsUp](media/cover.png){ .shot }

EarsUp is a Chrome extension that puts a play button next to the headings on any page. Press it and EarsUp reads that heading and everything under it aloud, until the next heading of the same level. The word being spoken lights up as it goes.

It works on long docs, specs, wikis, articles, and chats, and it is free. It uses the voices already in Chrome, or Google Gemini voices if you add your own key.

## See it read

![EarsUp reading a section aloud](media/demo.gif){ .shot }

## Why EarsUp

- **One press per section.** Play buttons sit next to H1–H4 headings. Press one to hear that part only, not the whole page.
- **Follow along.** The sentence goes bright and the spoken word turns yellow (or green, pink, cyan). You can turn it off.
- **A player that stays out of the way.** Pause, skip, change speed, and drag it anywhere. **Space** pauses, **Esc** stops.
- **Your choice of voice.** Chrome voices work offline and send nothing anywhere. Gemini voices sound more natural and use your own API key.
- **History.** Every paragraph you listen to is saved in this browser, with a link back to where you read it.
- **Light and dark.** The settings panel and the highlight colours follow the page and your system theme.

## Get started

<div class="grid cards" markdown>

-   :material-download:{ .lg .middle } **Install**

    ---

    Download the zip from the latest release and load it in Chrome. It takes a minute.

    [:octicons-arrow-right-24: Installation](installation/index.md)

-   :material-play-circle:{ .lg .middle } **Press play**

    ---

    Play buttons, the floating player, and the keys you can use while it reads.

    [:octicons-arrow-right-24: Usage](usage/index.md)

-   :material-account-voice:{ .lg .middle } **Pick a voice**

    ---

    Choose a Chrome voice, or connect Gemini for more natural speech.

    [:octicons-arrow-right-24: Voices](usage/voices.md)

-   :material-shield-lock:{ .lg .middle } **Privacy**

    ---

    What EarsUp stores, what it sends, and when.

    [:octicons-arrow-right-24: Privacy](privacy.md)

</div>

## Stack

- [React](https://react.dev) and [Vite](https://vitejs.dev) for the settings panel
- [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3): content script, service worker, side panel
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) for Chrome voices, [Gemini TTS](https://ai.google.dev/gemini-api/docs/speech-generation) for Gemini voices
- [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API) for follow-along, so the page itself is never changed

## Source

EarsUp is open source on [GitHub](https://github.com/lovestaco/earsup). Issues, stars, and contributions are welcome.
