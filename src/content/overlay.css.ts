// Styles for the in-page overlay (shadow DOM). The page's own light/dark
// decides the palette via the host's data-dark attribute.
export const OVERLAY_CSS = `
:host {
  --accent: #3b66ad; --accent-hi: #2f5594; --on-accent: #fff;
  --stop: #d9433f; --stop-ring: rgba(217, 67, 63, .28);
  --panel: #ffffff; --panel-line: rgba(30, 28, 36, .12); --ink: #1d1c21; --ink-2: #5b5866;
  --hl: rgba(59, 102, 173, .08); --hl-line: rgba(59, 102, 173, .35);
  --shadow: 0 10px 30px -8px rgba(20, 18, 30, .28), 0 2px 6px rgba(20, 18, 30, .12);
  font: 500 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
}
:host([data-dark="true"]) {
  --accent: #82a8ec; --accent-hi: #a3c0f3; --on-accent: #0c1830;
  --stop: #ff7a6e; --stop-ring: rgba(255, 122, 110, .3);
  --panel: #2a2826; --panel-line: rgba(255, 245, 235, .12); --ink: #f4efea; --ink-2: #bdb4ab;
  --hl: rgba(130, 168, 236, .09); --hl-line: rgba(130, 168, 236, .4);
  --shadow: 0 12px 34px -8px rgba(0, 0, 0, .6), 0 2px 6px rgba(0, 0, 0, .4);
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.eu-btn {
  position: fixed; width: 26px; height: 26px; border-radius: 50%; border: 0; padding: 0;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  background: var(--accent); color: var(--on-accent);
  box-shadow: 0 2px 6px -1px rgba(20, 30, 60, .35);
  opacity: .82; transition: opacity .16s, transform .16s cubic-bezier(.2,.8,.2,1), background .16s;
}
.eu-btn svg { width: 12px; height: 12px; fill: currentColor; margin-left: 1px; }
.eu-btn:hover { opacity: 1; transform: scale(1.12); }
.eu-btn:active { transform: scale(.94); }
.eu-btn.ghost { opacity: 0; pointer-events: none; transform: scale(.7); }
.eu-btn.playing { background: var(--stop); color: #fff; opacity: 1; animation: ring 1.6s ease-out infinite; }
.eu-btn.playing svg { margin-left: 0; }
@keyframes ring { 0% { box-shadow: 0 0 0 0 var(--stop-ring); } 100% { box-shadow: 0 0 0 9px transparent; } }

.hl {
  position: fixed; pointer-events: none; border-radius: 10px;
  background: var(--hl); box-shadow: inset 0 0 0 1px var(--hl-line);
}

.player {
  position: fixed; left: 50%; bottom: 20px; transform: translate(-50%, 16px);
  opacity: 0; transition: opacity .18s, transform .22s cubic-bezier(.2,.8,.2,1);
  display: flex; align-items: center; gap: 12px; width: min(520px, calc(100vw - 24px));
  padding: 8px 10px 8px 8px; border-radius: 18px;
  background: var(--panel); color: var(--ink); box-shadow: var(--shadow), inset 0 0 0 1px var(--panel-line);
  font: 500 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
  cursor: grab; touch-action: none; user-select: none;
}
.player.in { opacity: 1; transform: translate(-50%, 0); }
.player.placed { transform: translateY(10px); }
.player.placed.in { transform: none; }
.player.dragging { cursor: grabbing; transition: opacity .18s; box-shadow: 0 18px 40px -10px rgba(0,0,0,.45), inset 0 0 0 1px var(--panel-line); }
.player button { cursor: pointer; }
.mascot { width: 46px; height: 30px; object-fit: contain; flex: none; transform-origin: 50% 80%; }
.player:not(.paused):not(.err) .mascot { animation: bob 1.8s ease-in-out infinite; }
@keyframes bob { 50% { transform: translateY(-2px) rotate(-2deg); } }
.meta { flex: 1; min-width: 0; }
.title { font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.status { color: var(--ink-2); font-size: 12px; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.err .status { color: var(--stop); white-space: normal; }
.bar { height: 3px; border-radius: 2px; background: var(--panel-line); margin-top: 6px; overflow: hidden; }
.bar span { display: block; height: 100%; width: 100%; background: var(--accent); border-radius: 2px; transform: scaleX(0); transform-origin: left; transition: transform .3s cubic-bezier(.22,1,.36,1); }
.loading .bar span { animation: pulse 1s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; } }
.ctrls { display: flex; align-items: center; gap: 2px; flex: none; }
.ic { width: 32px; height: 32px; border: 0; border-radius: 10px; background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center; color: var(--ink-2); }
.ic svg { width: 14px; height: 14px; fill: currentColor; }
.ic:hover { background: var(--panel-line); color: var(--ink); }
.ic:disabled { opacity: .4; cursor: default; }
.ic.main { background: var(--accent); color: var(--on-accent); border-radius: 50%; width: 34px; height: 34px; margin: 0 2px; }
.ic.main:hover { background: var(--accent-hi); color: var(--on-accent); }
.speed { border: 0; background: transparent; cursor: pointer; height: 28px; min-width: 44px; padding: 0 6px;
  border-radius: 8px; color: var(--ink-2); font-weight: 650; font-size: 12px; font-variant-numeric: tabular-nums;
  box-shadow: inset 0 0 0 1px var(--panel-line); margin: 0 4px; }
.speed:hover { color: var(--ink); }
@media (max-width: 420px) { .mascot, .speed { display: none; } }
@media (prefers-reduced-motion: reduce) { *, .player { animation: none !important; transition: none !important; } }
`;

export const TIP_CSS = `
.tip {
  position: fixed; pointer-events: none; max-width: 240px; padding: 6px 10px; border-radius: 8px;
  font: 600 12px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--ink); color: var(--panel); box-shadow: 0 6px 18px -6px rgba(0,0,0,.4);
  opacity: 0; transform: translateY(3px); transition: opacity .14s, transform .18s cubic-bezier(.22,1,.36,1);
}
.tip[data-below="true"] { transform: translateY(-3px); }
.tip.in { opacity: 1; transform: none; }
`;

export const SNACK_CSS = `
.snack {
  position: fixed; left: 50%; bottom: 20px; transform: translate(-50%, 14px); opacity: 0;
  transition: opacity .18s, transform .22s cubic-bezier(.22,1,.36,1);
  display: flex; align-items: center; gap: 10px; max-width: min(560px, calc(100vw - 24px));
  padding: 8px 8px 8px 16px; border-radius: 14px;
  background: var(--ink); color: var(--panel); box-shadow: var(--shadow);
  font: 500 13px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
}
.snack.in { opacity: 1; transform: translate(-50%, 0); }
.snack-text { flex: 1; }
.snack-act { flex: none; border: 0; cursor: pointer; height: 32px; padding: 0 12px; border-radius: 9px;
  background: var(--accent); color: var(--on-accent); font: 650 13px/1 system-ui, -apple-system, "Segoe UI", sans-serif; }
.snack-act:hover { background: var(--accent-hi); }
.snack .ic { color: inherit; opacity: .75; }
.snack .ic:hover { opacity: 1; background: rgba(127,127,127,.25); color: inherit; }
`;

export const MENU_CSS = `
.speed-wrap { position: relative; }
.speed { display: inline-flex; align-items: center; gap: 2px; padding: 0 4px 0 8px; }
.speed .caret { width: 13px; height: 13px; opacity: .7; }
.speed[aria-expanded="true"] { color: var(--ink); box-shadow: inset 0 0 0 1px var(--accent); }
.speed-menu {
  position: absolute; right: 0; bottom: calc(100% + 10px); min-width: 128px; padding: 5px;
  border-radius: 12px; background: var(--panel); box-shadow: var(--shadow), inset 0 0 0 1px var(--panel-line);
  display: flex; flex-direction: column; gap: 1px; cursor: default;
}
.speed-menu.down { bottom: auto; top: calc(100% + 10px); }
.speed-menu[hidden] { display: none; }
.speed-menu button {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 30px; padding: 0 10px;
  border: 0; border-radius: 8px; background: transparent; cursor: pointer; text-align: left;
  font: 600 13px/1 system-ui, -apple-system, "Segoe UI", sans-serif; font-variant-numeric: tabular-nums; color: var(--ink);
}
.speed-menu button span { font-weight: 500; font-size: 12px; color: var(--ink-2); }
.speed-menu button:hover, .speed-menu button:focus-visible { background: var(--panel-line); outline: none; }
.speed-menu button[aria-checked="true"] { background: var(--accent); color: var(--on-accent); }
.speed-menu button[aria-checked="true"] span { color: inherit; opacity: .8; }
`;
