# Screenshots

Empty on purpose. Chrome Web Store screenshots have to be genuine captures of
the extension running — a mockup here would misrepresent the listing and risks
rejection in review, so none are faked.

## Add real ones

1. Open the Maxient reporting form with the extension loaded, fill in a few
   fields with **obviously fictional** names, and trigger the moment you want
   to show — the "Draft restored" pill, the Involved Parties rows coming back,
   the attachment opt-in card.
2. Capture the Chrome window: `Cmd+Shift+4`, then Space, then click the window.
3. Fit them to the store's required canvas:

   ```bash
   python3 ../store/frame-screenshot.py ~/Desktop/Screenshot*.png
   ```

   This writes `../store/screenshot-N-1280x800.png`. Copy the ones you like
   into this folder.

## What to capture (suggested, up to 5)

1. The status pill reading "Draft restored from …"
2. Multiple Involved Parties rows restored after a refresh
3. The attachment opt-in card ("N attachments won't be saved — Save them too")
4. The Clear button / confirmation
5. Before/after: a blank form next to the restored one
