# Overlays and the giveaway

StreamYard only takes still images: transparent JPG, PNG, or GIF at 1280×720, under 20MB. GIFs also have to stay under 3MB and under 108 frames. The ticker is a StreamYard banner with “Scroll across bottom” on, one line, up to 1,000 characters. StreamYard cannot load a browser-source URL. The `/live` pages are for screen share, or for OBS as a browser source sent in through OBS Virtual Camera.

## Regenerate the pack

```bash
npm run overlays
```

That script renders every PNG with headless Chromium from the sponsors and the schedule, then builds the snow GIFs. Booked Platinum and Gold blocks show up on the matching lower third as “presented by”. Run it again after the bookings change, and commit `public/overlays/`. Approved guests get a `guest-<id>.png` lower third that reads “Guest: Name, @handle”.

`/overlays` lists each file, a zip of the pack, the ticker, and the short banner lines.

## Live pages

| Page | What it shows |
| --- | --- |
| `/live/goal` | Progress toward $10,000 |
| `/live/alerts` | New donations |
| `/live/ticker` | Scrolling total and sponsor thank-yous |
| `/live/up-next` | Current and next segment in Eastern Time, plus an approved guest in that hour |
| `/guests` | 15-minute guest requests. Pending names stay off the public page. |
| `/draw/card` | Winner lower third. Admin only. Add `?name=` and `?prize=` |

Add `?mode=green` for a chroma-green background. Leave it off for a transparent page.

## Tiltify

The campaign page is https://tiltify.com/@tasonjorres/livestream-fundraiser-for-freecodecamporg.

Live totals need a Tiltify API token in `TILTIFY_TOKEN`. The server calls `https://v5api.tiltify.com/api/public/campaigns/by/slugs/tasonjorres/livestream-fundraiser-for-freecodecamporg` and, with the campaign id it gets back, the donations list. The token never goes to the browser. If the token is missing or Tiltify does not answer, `/live/goal` uses the `raised` number in `server/campaign.js` and the alerts stay empty.

Create an application token in the Tiltify dashboard. The public API uses `Authorization: Bearer <token>`.

## Giveaway

`/enter` takes a name, an email, an optional handle, and the prizes to enter. One email, one entry. A later submit updates that entry. The sponsor opt-in box starts unchecked. Checked entries are added to that sponsor’s lead CSV. A hidden honeypot field and a rate limit drop obvious spam.

`/rules` describes the draw, the claim, and the opt-in. The age and region line is a placeholder for Jason to replace. It is not a legal rule.

`/draw` is behind the admin code. It picks with `crypto.randomInt`, logs the time, and can re-draw. A winner is out of later drawings. The reveal shows a first name and last initial, or the handle. The email stays off that screen. `/admin` shows entry counts. Entrants export from `/admin/giveaway.csv`.
