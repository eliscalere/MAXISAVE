<p align="center">
  <img src="docs/assets/logo-transparent.png" alt="Maxisave" width="360">
</p>

<p align="center">
  <a href="https://maxisave.scaleredesign.com/">Homepage</a> ·
  <a href="https://maxisave.scaleredesign.com/support.html">Support</a> ·
  <a href="https://maxisave.scaleredesign.com/privacy.html">Privacy</a>
</p>

# Maxisave

*by Scalere Design*

A Chrome extension that autosaves the Maxient incident report form
(`cm.maxient.com/reportingform.php`) so a reload, crash, or accidental
back-button doesn't wipe a half-written report.

## Install (development)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and pick this `maxisave` folder
4. Reload the reporting form tab

## Publishing

See [store/LISTING.md](store/LISTING.md) for the Chrome Web Store submission
sheet — listing copy, privacy answers, and what's still outstanding. Build the
upload package with:

```bash
./store/build.sh
```

| File | Purpose |
|---|---|
| `manifest.json`, `maxisave.js`, `maxisave.css`, `icons/` | the extension itself; only these ship |
| `store/LISTING.md` | dashboard copy-paste sheet |
| `store/PRIVACY.md` | privacy policy source — hosted version is `docs/privacy.html` |
| `store/build.sh` | produces `store/maxisave-<version>.zip` |
| `store/frame-screenshot.py` | fits real screenshots to 1280×800 |
| `store/make-icons.py` | re-derives `icons/` from `store/logo-transparent.png`, aspect-ratio locked |
| `store/make-promo.py` | generates the 440×280 and 1400×560 store promo tiles from the real logo |
| `docs/` | the project site — homepage, support, privacy — published via GitHub Pages |
| `screenshots/` | real captures of the extension in use (see its own README) |

### GitHub Pages

`docs/index.html`, `docs/support.html`, and `docs/privacy.html` are meant to be
served at `https://maxisave.scaleredesign.com/` (via `docs/CNAME`, with
`maxisave.scaleredesign.com` CNAMEd to `eliscalere.github.io` in DNS). One-time
setup: repo **Settings → Pages → Source → Deploy from a branch → `main` /
`docs`**. That also gives the privacy policy its required public URL for the
Chrome Web Store listing — see the TODO in `store/LISTING.md`.

No sign-in, no permissions prompt, no network access — the extension only has a
content script scoped to `https://cm.maxient.com/reportingform.php*`.

## What it does

- Saves the form about 0.7s after you stop typing, plus every 20s as a backstop
  and once more when the tab closes.
- Restores the draft automatically the next time the form loads, including
  re-creating the extra **Involved Parties** rows you had added.
- Shows a small maroon/gold pill in the bottom-right corner: `Autosave on` →
  `Saving…` → `Saved 3:42 PM`, or `Draft restored from 3:12 PM` on return.
- **Clear** button next to the pill deletes the saved draft, empties every field,
  and removes the extra Involved Parties rows so you're back to a single blank
  row. It asks for confirmation first.
- Deletes the draft when you press **Submit**.
- Every institution and layout gets its own draft automatically; the **Saved**
  button next to Clear opens a list of all of them, with a delete per entry.
- **New report** saves the one you're on and starts a fresh, empty one — for
  when you're filing a second report on the same form. Both stay listed under
  **Saved**, and clicking the non-active one there switches back to it.
- Long-form narrative questions get a bigger, resizable textarea instead of
  the cramped 5-row default.
- After a real submission goes through, it's archived under a **Submitted**
  tab in the same panel as Saved — report number (when it can be found on the
  page) plus everything you'd written, so it's still there to look back at
  after the draft itself is gone.

## Works on every Maxient form, not just this one

The content script matches `cm.maxient.com/reportingform.php*` — the whole
path, any query string — and the storage key is built from the `institution`
and `layout_id` hidden fields the page itself sends, not from anything
hardcoded. That part was already true before v1.1.0; what's new is making it
*visible* and extending the UI additions to work the same way regardless of
which form you're on.

Verified directly, not just by reading the code: the same `#IR` / `#involvedPersons`
/ `#section3` / `#btnAdd` / `#btnDel` structure showed up identically on two
completely different Maxient forms — an anonymous public "Student Conduct
Incident Report" and an authenticated "University Housing Staff Incident
Report Form" behind ASU's SSO. That's Maxient's shared template, not an
ASU-specific quirk, which is why the textarea enhancement below targets "every
textarea" generically rather than anything layout-specific.

One layout (a login-gated staff form) couldn't be fully exercised end-to-end
here — reaching it requires signing in as you, which this project won't do.
The generic selectors above are the reason that's a minor gap rather than a
real one: nothing about them assumes a specific layout.

## Working on more than one report

Originally, `institution:layout_id` was the whole key — one draft per form.
That's fine until you need to file two Student Conduct reports about two
different incidents on the same day, and the second one starts overwriting
the first as you type. v1.2.0 adds a slot to the key
(`institution:layout_id:slot`) so more than one report can exist for the same
form at once, and the **Saved** button next to Clear is how you move between
them:

- **New report** saves whatever's on screen, then clears the form and starts
  a new, separate draft. The one you were just on doesn't go anywhere — it's
  still there, still autosaving independently under its own slot.
- The **Saved** panel lists every draft in this browser: institution, layout,
  a preview (the reporter's name or first party listed, if there is one), and
  when it was last saved. Entries for the *same* institution+layout as the
  page you're on are clickable — click one to switch to it, which saves your
  current report first, then swaps the visible form for that one.
- Entries for a *different* form only offer delete, not switch — restoring a
  Housing form's fields onto a Conduct form's layout wouldn't mean anything.

Drafts saved before v1.2.0 still work with no migration: the unslotted key
(`institution:layout_id`, no trailing slot) is exactly what every draft
already used, so it's just "the first report" now rather than "the only one."

## Submission history

Maxient's form POSTs back to the exact same URL it's already on — verified
directly (`FORM.action` equals `location.href`) — so whatever it serves after
a real submission, success or validation error, loads under this same content
script match with no manifest change needed. That response is a genuine
server render, not a client-side transition, which gives a reliable signal:
if `#IR` is gone, the submission actually went through rather than being
blocked. `localStorage` persists across that navigation, so the draft parked
the instant Submit was pressed is still there for the fresh page load to pick
up and archive.

**The report-number extraction is an unverified best-effort guess.** This
project has never seen Maxient's real confirmation page and never will — the
only way to check would be filing an actual report, which it won't do. So
instead of matching real wording, it scans the page's visible text for a
label ("report/reference/confirmation/tracking/case/incident" + "number" or
"#") followed within about 40 characters by something that looks like a code
— has a digit, and isn't an ordinary lowercase word. Verified against
eleven synthetic cases, including phrasing with a connector word in between
("report number **is** R-2026-004821" — a single combined regex missed this;
splitting label-finding from code-extraction fixed it), a label with no real
code following it, and plain form-page text that must **not** false-positive.
All eleven passed, but "handles invented examples" and "handles Maxient's
actual wording" are different claims — if it comes back "Report number not
detected" on a real submission, the submission is still archived with
whatever was written, just without a number attached; the pattern can be
retuned once someone reports what the real page actually says.

Each entry keeps the full field snapshot, not just the number, since that was
the actual ask — "history to see the details of the report." Field keys are
raw storage keys (`person[]#0`, `aq[2][answer]#0`), not question text, since
the text only exists on the live form and history has to outlive it; a light
generic cleanup turns those into "Person 2" and "Question 2" rather than
showing the raw keys. History is capped at 50 entries (oldest drop first) —
see [Stress test results](#stress-test-results) for why that number, not a
bigger one.

## Bigger textareas

Every `<textarea>` on the page gets a taller default height (220px vs the
~5-row default), a bigger line-height, and `resize: vertical`, so writing a
multi-paragraph incident description doesn't mean scrolling inside a
postage-stamp box. Applied generically to "every textarea" rather than
anything layout-specific, for the same reason as everything else on this
page: it has to hold up on forms this project has never seen.

An earlier version of this also added a small panel that mirrored the
Involved Parties rows in the corner, live-updating as you typed, as an
additive alternative to physically repositioning Maxient's own section into a
sidebar (which risks breaking layouts this project can't test against — see
above). In practice its "live" update didn't reliably keep up with typing
without a page refresh, which defeated the point, so it was pulled rather
than left half-working.

## The "Draft restored" message used to vanish almost instantly

`applyDraft()` fills the form during restore by dispatching synthetic
`input`/`change` events (so the page's own listeners react normally to each
field). Those events were also picked up by autosave's own listener, which
scheduled a save regardless of whether the event was a real edit — so restoring
a draft immediately re-saved it, overwriting the "Draft restored from …"
message well before its intended 6-second display. Measured on the live form:
visible for ~700ms instead of 6000ms.

Fixed by checking `event.isTrusted` before scheduling a save — restore's own
synthetic events no longer count as edits, only ones the browser marks as
originating from a real user action do. Re-measured after the fix: 5994ms,
matching the intended window.

## The invisible-row bug (a page bug, fixed here)

The page fades a newly added Involved Parties row in with jQuery, which drives
its animations off `requestAnimationFrame`. In a tab that is backgrounded or
still loading, rAF never fires, so the fade is **started and abandoned** — the
row ends up fully laid out at `opacity: 0`. It is present, focusable, and would
be submitted with the form, but you cannot see it. It shows up as a tall blank
gap where a row should be, and nothing ever finishes the animation.

Measured on the live form: six rows, four stuck at `opacity: 0`, with
`jQuery.timers.length === 0` (no animation still pending to finish them).

This is not caused by autosave — it can happen when you add rows by hand and
switch tabs — but restore made it much easier to hit, since it adds rows during
page load. `normalizeRows()` clears the abandoned inline `opacity`, `display`,
and stalled slide styles. It runs during restore, after a manual click on **Add
another party** / **Remove last party**, whenever the tab becomes visible again,
and on the 20s backstop.

Rows are also added one per tick now instead of in a tight loop, because the
page clones the *last* row — cloning mid-fade copies half-faded inline styles
onto the new row.

## Why multiple parties used to come back short

The extra **Involved Parties** rows only exist because a separate page script
(`clone-form-td2.js`) clones them one click at a time. Two things follow from
that, and v1.0.0 got both wrong:

1. If our restore ran before that script had bound its handler, the clicks did
   nothing and only the first row came back.
2. Worse, autosave then armed itself against the short form and overwrote the
   good draft on the next keystroke or 20s tick. The rows weren't just missing
   on screen — they were gone from storage, so every later refresh was short
   too. Measured directly: a 5-party draft was rewritten to 3 and the other two
   were unrecoverable.

v1.1.0 fixes both:

- Restore re-runs at 0/120/350/800/1600/3000/5000ms until the form matches the
  draft. Retry passes only fill fields that are still blank, so they can't
  clobber the page or anything you've typed, and they stop the moment you make a
  real edit.
- Autosave refuses to write while a restore is incomplete — if the form has
  fewer party rows than the draft and you haven't touched anything, the draft is
  left alone. Once you genuinely edit (including using **Remove last party**),
  saving resumes as normal.
- Restore now starts at `DOMContentLoaded` instead of waiting for `load`, so the
  form doesn't sit visibly empty while fonts and the upload widget finish
  loading.

Also fixed: **Remove last party** is animated and ignores clicks mid-animation,
so clearing now steps through removals one at a time (a tight click loop removed
only one row), and `<select>` restore now scans the option list directly instead
of building a CSS attribute selector — the Role options contain literal
newlines (`"\nRespondent"`), which made the old selector check fragile.

## Where the data lives

`localStorage` on the origin `https://cm.maxient.com`, under the key
`maxient-autosave:<institution>:<layout_id>` — for the ASU conduct form that's
`maxient-autosave:ArizonaStateUniv:0` — plus `:<slot>` when it's not the first
report on that form (see [Working on more than one report](#working-on-more-than-one-report)).
Submission history lives at the single key `maxient-autosave:history`, shared
across every institution and layout, since browsing "everything I've
submitted" is the point of it.

That's per-browser and per-machine: a draft saved on your laptop is not visible
in another browser, another profile, or another computer. Nothing is transmitted
anywhere. Each form layout gets its own key, so different Maxient forms don't
overwrite each other.

## What is deliberately not saved

- **File attachments.** Re-attach them after a reload. This is a deliberate
  choice, not a technical wall — see below.
- **Session fields** — `x_requestor_token`, `x_requestor_ip`,
  `x_requestor_starttime`, `recaptcha_response`, and the other hidden inputs.
  These are issued per page load; restoring stale values would break the submit.
- Any `password` input, should a layout ever add one.

## Never call form.reset() on this page

This is a Foundation **Abide** form (`<form data-abide>`). Abide hooks the native
`reset` event and its `resetForm()` runs `.val('')` across every input —
*including radios and checkboxes*, whose `value` attribute it wipes permanently.

The damage is worse than it looks. Abide's `requiredCheck()` falls through to a
`.val().length` test for radios, so once the values are blank the group can never
validate: picking an answer to "Were police notified regarding this incident?"
leaves it red with "This field is required" until a refresh re-fetches the
markup. And because the value attribute is what actually gets submitted, an
answer chosen after a reset would have **submitted blank** — the police question,
the agency question, and the "email me a copy" checkbox all silently emptied.

Verified on the live form: the server sends `value="Yes"` / `"No"` /
`"I don't know"`; one `form.reset()` leaves all three as `""`.

v1.3.0 replaces `form.reset()` with `clearFields()`, which sets each control back
to its own default (`defaultChecked` for radios and checkboxes, so their values
are never touched), clears Abide's `is-invalid-*` classes by hand, and snapshots
the choice values at load so `repairChoiceValues()` can put back anything the
page blanks through its own reset paths.

## Stress test results

Measured on the live form, on this machine:

| | |
|---|---|
| Storage ceiling (localStorage, this origin) | **5.00 MB** (5,240,320 chars) |
| Worst realistic draft — 30 party rows fully filled + 9,600-word narrative | **64.3 KB** |
| That draft as a share of the quota | **1.26%** |
| Time to collect + serialize + write it | **0.5 ms** |
| Party rows | capped at **30** by the page itself |

So capacity is not a practical limit — roughly 80 maximal drafts would fit, and
only one is ever stored per form layout. The narrative would need to reach about
five million characters to fill the quota.

If the quota ever is exhausted, `setItem` throws `QuotaExceededError`, `write()`
catches it and returns false, and the pill shows **"Could not save"** rather than
failing silently or losing the existing draft.

Corrupt or tampered payloads (`not json`, `{}`, `null`, `[]`, `{"fields":null}`)
are all rejected safely and treated as "no draft" — none throw.

**Submission history's cap is set from this same measurement.** Unlike a
draft, history keeps growing rather than staying at one entry per form, so it
can't lean on "only 1.26% of quota" the way a draft does. 50 entries at the
worst-case 64.3KB each is 3.2MB — about 64% of the 5MB quota, leaving room for
active drafts and other institutions' history alongside it. Real reports run
far smaller than the worst case, but the cap has to hold even if every single
one doesn't.

## How long does it save for?

**Indefinitely, with one deliberate exception.** `localStorage` has no built-in
expiry: a draft survives closing the tab, quitting Chrome, and rebooting. The
only expiry is this extension's own 14-day rule. Verified at the boundary — a
draft aged 13.9 days is restored, 14.1 days is discarded.

A draft does not survive: pressing **Submit** or **Clear**, clearing "Cookies and
other site data" for the site, an Incognito window closing, or Chrome evicting
site data under storage pressure (this origin is not marked `persisted`, so
eviction is possible in principle, though it takes real disk pressure).

## Attachments

**Off by default, opt-in per draft.** Attach a file and a white card appears
above the pill:

> 2 attachments won't be saved — you'd need to re-attach after a refresh.
> **[ Save them too ]**

Press **Save them too** and they're kept with the draft; the card turns green and
the button becomes **Stop saving**. The choice is remembered per form layout and
is reset by Submit and by Clear.

Off by default on purpose: attachments here are photos and documents about named
students, and persisting them puts real files in browser storage on that machine
for up to 14 days, readable by anyone with the profile. That's a step beyond the
text draft, so it's a decision rather than a default.

### Closing the tab with unsaved attachments

If files are staged and you haven't opted in, closing or reloading triggers
Chrome's "Leave site?" confirmation. Note that **`beforeunload` cannot carry a
custom message** — Chrome replaces any text with its own generic wording. So the
dialog only *stops* the close; the actual explanation is the in-page card, which
is already on screen. The prompt does not fire when you opt in, or on Submit.

### How it works, and why it's trustworthy

- Files go to **IndexedDB** (`maxient-autosave` → `attachments`), which stores
  `Blob`s directly. `localStorage` couldn't: it's strings only and capped at 5 MB.
- Restore builds a `DataTransfer`, assigns `input.files`, and dispatches `change`
  so the uploader re-renders. The old "a script can't repopulate a file input"
  rule no longer holds in Chrome.
- Verified across a genuine page reload: two files (11 B and 4,096 B) restored
  byte-exact, the jQuery.filer UI rendered both with correct names, sizes and
  types, and `FormData` carried both. **What the uploader shows is what would
  upload** — the mismatch that would matter most on a real report does not occur.
- Same 14-day expiry as the text draft, and cleared on Submit and Clear.

## Draft lifetime

A draft is deleted when you submit, when you press **Clear**, or automatically
once it is more than 14 days old (`MAX_AGE_DAYS` in `maxisave.js`).

Because report narratives contain names, ASU IDs, and incident details, the
draft sits unencrypted in browser storage on that machine until one of those
happens. On a shared or lab computer, press **Clear** before walking away.

## Submit safety net

Pressing Submit doesn't destroy the draft outright. It is parked under a
`:pending` key first. If the submit is blocked — a missing required field, a
failed captcha — and the page is still open six seconds later, the draft is put
back. If the submit goes through and the page navigates away, the parked copy is
discarded the next time the form is opened.

## Tuning

The knobs are at the top of `maxisave.js`: `SAVE_DELAY`, `BACKSTOP_INTERVAL`,
`SUBMIT_GRACE`, `MAX_AGE_DAYS`. Colors are in `maxisave.css` (`#8c1d40` maroon,
`#ffc627` gold) — change those two if you point this at a non-ASU Maxient form.

## Verified against the live form

Tested on the ASU Student Conduct Incident Report (`layout_id=0`) without
submitting anything:

- Text, textarea, select, and radio fields round-trip through both a fresh
  navigation and a real `reload()`.
- Five Involved Parties rows — names, ASU IDs, and Role selects — were recreated
  and refilled, and stayed stable when sampled at 0/150/450/1050/2250ms after
  load (ruling out a late script wiping the cloned rows).
- The truncation guard was tested head to head against the old logic on a
  throwaway storage key: old rewrote a 5-party draft down to 3, new left it at 5
  and still saved normally once a real edit was flagged.
- Clear wiped storage and form; the submit handler removed the draft and the
  safety net restored it when no navigation followed.

Note on attachments: **Clear** empties the file input and removes the upload
widget's rendered file list, but the widget keeps its own internal state, so
double-check the attachments area after clearing if you had files staged.
