# Maxisave — Privacy Policy

**Effective 7 August 2026 · Scalere Design**

Maxisave is a Chrome extension that saves an in-progress Maxient incident report
so it survives a refresh, a crash, or a closed tab.

## The short version

Maxisave does not collect, transmit, sell, or share any data. Nothing you type
ever leaves your computer. There are no servers, no analytics, no telemetry, no
third-party services, and no network requests of any kind.

## What is stored, and where

Everything is stored locally in your own browser profile, on your own machine:

| What | Where | Why |
|---|---|---|
| The text you have typed into the report form | `localStorage` on `https://cm.maxient.com` | To put the draft back after a refresh |
| Attachments, **only if you opt in** | IndexedDB (`maxisave` → `attachments`) | To restore staged files after a refresh |
| Whether you opted in to saving attachments | `localStorage` | To remember the choice |
| A record of reports you've submitted — everything you wrote, plus a report number if one could be found on the confirmation page | `localStorage` | So you can look back at what you submitted, and find the report number later |

Because this is ordinary browser storage tied to one site and one profile, a
draft saved on one computer cannot be read from another, by another browser, or
by another profile on the same computer.

## What is deliberately never stored

- Session security tokens (`x_requestor_token`, `x_requestor_ip`,
  `x_requestor_starttime`) and the reCAPTCHA response.
- Any field of type `password`.
- Attachments, unless you explicitly press "Save them too".

## How long it is kept

A draft is deleted when you submit the form, when you press **Clear**, or
automatically 14 days after it was last saved — whichever comes first. You can
also remove it at any time by clearing site data for `cm.maxient.com` in Chrome.

**Submission history is different: it does not expire on its own.** Its whole
purpose is to be a record you can come back to, so unlike a draft it isn't
deleted after 14 days — it's kept until you delete it yourself, either one
entry at a time or with "Clear all," or until it's pushed out by newer
submissions once the record holds 50. Each entry keeps everything you wrote
in that report, not only the report number, so weigh that the same way you'd
weigh keeping any other record of a report containing another person's name —
delete entries you don't need to keep referring back to.

## Permissions

Maxisave requests no Chrome permissions. It runs a single content script limited
to `https://cm.maxient.com/reportingform.php*` and cannot see any other site.

## A note on sensitive content

Incident reports contain personal information about named individuals. While
Maxisave is saving a draft, that text sits unencrypted in your browser profile
until you submit, clear it, or the 14 days elapse — the same way an unsent draft
sits in any application. On a shared or lab computer, press **Clear** before you
walk away.

## Changes

Any change to this policy will be published at this URL and reflected in the
extension's Chrome Web Store listing.

## Contact

Scalere Design — <!-- TODO: add the contact email you want published here -->

---

*Maxisave is an independent tool. It is not affiliated with, endorsed by, or
sponsored by Maxient LLC or Arizona State University.*
