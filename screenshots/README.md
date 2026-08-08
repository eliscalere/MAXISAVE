# Screenshots

Two real captures of the extension running, with fictional test data:

| File | Shows |
|---|---|
| `01-involved-parties-restored.png` | A restored draft: two Involved Parties rows (names, ASUID, role) filled back in against the live ASU form |
| `02-status-pill-and-attachment-notice.png` | The status pill and the attachment opt-in card |

Framed, store-ready (1280×800) versions of both are in `../store/screenshot-1-1280x800.png`
and `../store/screenshot-2-1280x800.png`.

These are genuine renders of the live Maxient form and the extension's own
markup — not mockups. They were captured by serializing the real, live-valued
DOM into an SVG `foreignObject` and rasterizing it to a canvas, since this
environment has no direct screen-capture-to-file path. All test data
("Jordan Rivera", "Alex Chen", "Sam Whitfield", fake ASUIDs) is fictional.

## Adding more

1. Open the Maxient reporting form with the extension loaded, fill in a few
   fields with **obviously fictional** names, and trigger the moment you want
   to show — a different pill state, the Clear confirmation, etc.
2. Capture the Chrome window: `Cmd+Shift+4`, then Space, then click the window.
3. Fit it to the store's required canvas:

   ```bash
   python3 ../store/frame-screenshot.py ~/Desktop/Screenshot*.png
   ```

   This writes `../store/screenshot-N-1280x800.png`. Copy the ones you like
   into this folder.

## Ideas for more (up to 5 total for the store listing)

3. The Clear button / confirmation dialog
4. Before/after: a blank form next to the restored one
5. The "Draft restored from …" pill state specifically
