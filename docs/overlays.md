# Overlays and the giveaway

StreamYard only takes still images: transparent JPG, PNG, or GIF at 1280×720, under 20MB. GIFs also have to stay under 3MB and under 108 frames. The ticker is a StreamYard banner with “Scroll across bottom” on, one line, up to 1,000 characters. StreamYard cannot load a browser-source URL. The `/live` pages are for screen share, or for OBS as a browser source sent in through OBS Virtual Camera.

## Regenerate the pack

```bash
npm run overlays
```

That script renders every PNG with headless Chromium from the sponsors and the schedule, then builds the snow GIFs. Each lower third is a 104px bar just above the 42px ticker zone: segment title, time, and the sponsor logo when a Platinum or Gold block overlaps that hour. Run it again after the bookings change, and commit `public/overlays/`. Approved guests get a `guest-<id>.png` lower third in the same bar, with the guest’s name and handle.

`/overlays` lists each file, a zip of the pack, the ticker, and the short banner lines.

## Live pages

| Page | What it shows |
| --- | --- |
| `/live/goal` | Progress toward $10,000 |
| `/live/alerts` | New donations |
| `/live/ticker` | Scrolling total and sponsor thank-yous |
| `/live/up-next` | Current and next segment in Eastern Time, plus an approved guest in that hour |
| `/games` | The six hours. Call Santa at 2:00 PM ET, Christmasaire 2.0 at 7:00 PM ET. |
| `/games/movie/display` | Name That Christmas Movie, for screen share. Host controls are at `/host`. |
| `/games/price/display` | Holiday Price is Right. |
| `/games/feud/display` | Christmas Family Feud. |
| `/games/sweater/display` | Ugly Sweater Showdown and donation dares. |
| `/guests` | 12 half-hour guest slots, 2:00–8:00 PM ET. Pending names stay off the public page. |
| `/draw/card` | Winner lower third. Admin only. Add `?name=` and `?prize=` |

Add `?mode=green` for a chroma-green background. Leave it off for a transparent page.

## Tiltify

The campaign page is https://tiltify.com/@tasonjorres/livestream-fundraiser-for-freecodecamporg.

Live totals need a Tiltify API token in `TILTIFY_TOKEN`. The server calls `https://v5api.tiltify.com/api/public/campaigns/by/slugs/tasonjorres/livestream-fundraiser-for-freecodecamporg` and, with the campaign id it gets back, the donations list. The token never goes to the browser. If the token is missing or Tiltify does not answer, `/live/goal` uses the `raised` number in `server/campaign.js` and the alerts stay empty.

Create an application token in the Tiltify dashboard. The public API uses `Authorization: Bearer <token>`.

## Giveaway

`/enter` takes a name, an email, an optional handle, the prizes to enter, and a required confirmation that the person lives in the United States. One email, one entry. A later submit updates that entry. The sponsor opt-in box starts unchecked. Checked entries are added to that sponsor’s lead CSV. A hidden honeypot field and a rate limit drop obvious spam. The page, the ticker, the short banners, and the enter-giveaway overlay say the giveaway is open to US residents only.

`/rules` is the plain-English official rules page. The minimum age and the 72-hour claim window are marked placeholders for Jason to confirm. They are not rules yet.

`/draw` is behind the admin code. It picks with `crypto.randomInt`, logs the time, and can re-draw. A current winner is out of every later drawing, and the pool count on `/admin` and `/draw` leaves that person out. The reveal shows a first name and last initial, or the handle. The email stays off that screen. Entrants export from `/admin/giveaway.csv`.
