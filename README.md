# xmas-stream

Landing page and sponsor portal for Jason Torres' Christmas Birthday Livestream (Friday, Dec 18, 2026, 2:00–8:00 PM ET). The public page lives in `public/`. Sponsors book time and send assets at `/portal`. Jason runs the show from `/portal/admin`.

## How this deploys

Unkey Compute builds the `Dockerfile` and runs the container. A push to `main` redeploys production. Any other branch gets a preview URL. The app has to listen on the `PORT` Unkey injects (default 8080). The image command is `node server/index.js` with the SQLite flag. Leave that command as the image default.

Unkey's disk does not last. `/tmp` is a small memory scratch space, and `/data` exists only if you turn on ephemeral storage. Nothing on either survives a restart, a new deployment, or a preview going to sleep (previews shut down after an hour with no requests). Two replicas would also each have their own disk. Bookings cannot live in the container.

Production should use Postgres via `DATABASE_URL`. Without it, the portal still runs (handy for a preview) and keeps a SQLite file until that instance is replaced. The admin page says so when it is in that mode.

`GET /health` returns `ok` and does not touch the database. If you set a health check in the Unkey runtime settings, use that path. A probe that depends on the database will restart the app whenever the database blips.

## Environment

Set these in the Unkey environment (production and preview are separate). Mark the secrets write-only.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Production | Postgres connection string, for example `postgres://user:pass@host:5432/xmas?sslmode=require`. This is what makes bookings and logos survive a deploy. |
| `SESSION_SECRET` | With `DATABASE_URL` | At least 16 characters. Signs the login cookie and encrypts invite codes. Changing it logs everyone out and makes old links unreadable until you generate new ones. |
| `ADMIN_CODE` | With `DATABASE_URL` | Jason's login. Letters and numbers, at least 8. Dashes and case don't matter. |
| `APP_BASE_URL` | No | Public origin for copied invite links, such as `https://jetdemo-xmas-stream-jetbrain.unkey.app`. When unset, links use the request host. |
| `DATA_DIR` | No | SQLite directory when `DATABASE_URL` is unset. Defaults to `/tmp/xmas-stream`. |
| `PLATINUM_SPOTS` | No | Default `3`. |
| `GOLD_SPOTS` | No | Default `4`. |
| `PORT` | Injected | Unkey sets this. Local default is 8080. |

On a preview with none of the secrets set, the process writes an admin code into the log once: `Admin code for Jason: ...`. Set `ADMIN_CODE` yourself so it is not in the logs. Sponsor links are not printed. Open the admin desk and copy each one. Treat a link like a password. "New link" on a sponsor's card retires the old one.

Invite codes are stored as an HMAC. The admin desk can show them because a second copy is encrypted with `SESSION_SECRET`.

Keep production at one replica unless `DATABASE_URL` is set. With Postgres, more than one replica is fine. Booking writes take a transaction lock so two sponsors can't grab the same block.

## Run locally

```bash
npm install
npm test
ADMIN_CODE=local-admin-code SESSION_SECRET=local-session-secret npm start
```

Open [http://localhost:8080](http://localhost:8080) and [http://localhost:8080/portal](http://localhost:8080/portal). Log in with `local-admin-code`, then copy a sponsor link from the desk.

Docker, same contract Unkey uses:

```bash
docker build -t xmas-stream .
docker run --rm -p 8080:8080 -e ADMIN_CODE=local-admin-code -e SESSION_SECRET=local-session-secret xmas-stream
```

## Portal rules

The grid is every half hour from 2:00 PM to 8:00 PM ET. Platinum books 1 hour (two blocks). Gold books 30 minutes. A block that overlaps someone else is refused. Jason can override from the admin desk, which clears the other booking. Silver and Community don't book time. They still send assets.

Assets are due Friday, Nov 20, 2026. Everyone sends a logo, one URL, talking points, an X handle, and a credit line. Platinum, Gold, and prize sponsors also send prize details and shipping. Silver and Community are cash for freeCodeCamp, so their form stops there. The desk shows how many of those fields are in.

Seeded sponsors: Laravel and Unkey (Platinum, one Platinum spot left open), Coder, Luke (@LukeCFPLevelUp, no earlier than 2:00 PM ET), Kunal (@kunalstwt), and Tighten (Gold), CodeRabbit and Torc (Silver), and RenderATL (prize sponsor, tier not set). Tighten's mark and wordmark are already on file. A missing seed sponsor is added on startup. Existing rows are left alone.

## The public fundraiser

`server/campaign.js` is the only file for the public numbers. Set `raised` (it starts at `4000`) and `goal`. Add a locked prize by appending to `prizes`. Put the live campaign link in `tiltifyUrl`. The homepage reads that file on each request. The primary button is "Sponsor with cash" and it goes to https://tilt.fyi/9va4uz7GEn.
