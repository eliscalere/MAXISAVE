# Chrome Web Store submission — Maxisave

Copy-paste sheet for the Developer Dashboard. Everything below is ready to use
except the items marked **TODO**.

---

## Before you upload

- [ ] **Developer account** — one-time $5 USD registration fee at
      <https://chrome.google.com/webstore/devconsole>.
- [ ] **Publisher display name** — set this to **Scalere Design** under
      *Account → Publisher settings*. This is what appears as "Offered by" on the
      listing. It does **not** come from the manifest, so there is nothing to
      change in the code.
- [ ] **Verify a contact email** — required before you can publish.
- [ ] **Enable GitHub Pages.** Repo → Settings → Pages → Source →
      `main` / `docs`. This publishes `docs/privacy.html`, which is the URL to
      paste into the Privacy tab below — see its TODO.
- [ ] **TODO: contact email.** `docs/privacy.html` and `store/PRIVACY.md` both
      have a placeholder where the real contact email goes.

## Package

```bash
./store/build.sh
```

Produces `store/maxisave-1.0.0.zip`. Upload that. The zip must contain
`manifest.json` at its root — the script handles that.

---

## Store listing fields

**Name**
```
Maxisave
```

**Summary** (132 char limit — this is 112)
```
Autosaves your Maxient report draft to this browser, restores it after a refresh, and clears it when you submit.
```

**Category** — Workflow & Planning

**Language** — English (United States)

**Description**
```
Maxisave keeps the incident report you are writing from disappearing.

Maxient's reporting forms have no draft feature. A refresh, an accidental
back-button, a browser crash, or a timed-out session takes a half-written
report with it — including every Involved Parties row you had added.

Maxisave fixes that. It saves quietly as you type and puts everything back the
next time the form loads.

WHAT IT DOES

• Saves about 0.7 seconds after you stop typing, every 20 seconds as a backup,
  and once more when the tab closes.
• Restores the whole form on the next load — including re-creating the extra
  Involved Parties rows you had added, with their names, ID numbers and roles.
• Shows a small status pill in the corner: "Saving…", "Saved 3:42 PM", or
  "Draft restored from 3:12 PM".
• A Clear button wipes the draft and empties the form when you want a fresh
  start.
• Deletes the draft automatically when you press Submit.
• Attachments are opt-in. Staged files are not saved unless you choose to keep
  them, and you are warned before closing the tab with unsaved attachments.

YOUR DATA STAYS ON YOUR COMPUTER

There are no servers and no accounts. Maxisave makes no network requests at
all. Drafts live in your own browser profile, so a draft saved on one computer
cannot be opened on another. Session security tokens and reCAPTCHA responses
are deliberately never saved. Drafts are deleted on submit, on Clear, or after
14 days.

PERMISSIONS

Maxisave requests no Chrome permissions. It runs only on
cm.maxient.com/reportingform.php and cannot see any other website.

---
Maxisave is an independent tool from Scalere Design. It is not affiliated with,
endorsed by, or sponsored by Maxient LLC.
```

---

## Privacy tab

**Single purpose**
```
Maxisave saves an in-progress Maxient incident report form to local browser
storage so the draft survives a page refresh, and restores it the next time the
form is opened.
```

**Host permission justification** (`https://cm.maxient.com/reportingform.php*`)
```
The extension reads and restores the values of the report form on this page.
This host match is the form itself; the extension has no function on any other
page and requests access to no other site.
```

**Are you using remote code?** — No. All code is in the package; the extension
loads no external scripts.

**Data usage disclosures** — tick nothing. Then certify all three:
- Not being sold to third parties ✅
- Not being used or transferred for purposes unrelated to the single purpose ✅
- Not being used or transferred to determine creditworthiness / lending ✅

Data never leaves the device, so no collection categories apply.

**Privacy policy URL**
```
https://eliscalere.github.io/MAXISAVE/privacy.html
```
Only live once GitHub Pages is enabled (see checklist above) and the push has
landed — give it a minute after enabling before it resolves.

---

## Graphics

| Asset | Required | Status |
|---|---|---|
| Store icon 128×128 | Yes | `icons/icon-128.png` ✅ |
| Screenshot 1280×800, 1–5 | Yes, at least 1 | `store/screenshot-1-1280x800.png`, `store/screenshot-2-1280x800.png` ✅ |
| Small promo tile 440×280 | No | `store/small-promo-440x280.png` ✅ |
| Marquee 1400×560 | No | `store/marquee-1400x560.png` ✅ (only used if featured) |

Both promo tiles are generated from the real logo (`store/logo-transparent.png`)
via `python3 store/make-promo.py`, flattened to RGB — Chrome rejects promo art
with an alpha channel.

The two screenshots are genuine captures of the live form with the extension's
real markup and fictional test data — see [screenshots/README.md](../screenshots/README.md)
for how they were made. Up to 3 more can be added the same way:

1. `Cmd+Shift+4`, then Space, then click the Chrome window.
2. Capture whatever's missing — the Clear confirmation, a before/after pair, etc.
3. Run it through the framer to get exact store dimensions:

```bash
python3 store/frame-screenshot.py ~/Desktop/Screenshot*.png
```

That writes `store/screenshot-1-1280x800.png` and so on — also, like all promo
art, flattened with no alpha. Copy the ones you like into `screenshots/`. Use
obviously fictional names in the form before capturing.

---

## Distribution

Consider **Unlisted** rather than Public. Maxisave is useful to people who
already use a specific Maxient form; unlisted keeps it installable by link
without putting it in public search results. You can switch to Public later.

Review usually takes a few days. A first submission that touches form data on a
third-party site sometimes draws a manual review, so expect up to a week or two.

---

## One thing to check before you publish

The name **Maxisave** is one letter off **Maxient**, and the extension works
only on Maxient's own domain. Chrome Web Store policy prohibits listings that
imply an affiliation or endorsement that doesn't exist, and Maxient may hold
trademark rights in its name.

I've added "not affiliated with, endorsed by, or sponsored by Maxient LLC" to
the description, the privacy policy, and the source header, which is the normal
way to handle nominative use. That is usually enough — but it is a real risk
worth a moment's thought, and worth asking your university's licensing or legal
contact about, especially if this is going Public rather than Unlisted. If you
want to sidestep it entirely, a name that doesn't echo the vendor's would do it.
