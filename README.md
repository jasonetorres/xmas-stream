# xmas-stream

Landing page and sponsor portal for Jason Torres' Christmas Birthday Livestream (Friday, Dec 18, 2026, 2:00–8:00 PM ET). The public page lives in `public/`. Companies that want to sponsor get `/sponsor`. Each sponsor opens `/portal?s=<slug>` with their own access code. Jason runs the show from `/admin` with `ADMIN_CODE`.

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
| `ADMIN_CODE` | Production | Jason's login for `/admin`. Any characters. The server trims spaces and one pair of wrapping quotes. Not the sponsor code. |
| `SPONSOR_CODE` | No | Optional fallback while sponsors switch to their own codes. Any characters, different from `ADMIN_CODE`. Each sponsor’s real code is random, stored hashed in the database, and shown on the admin desk. |
| `APP_BASE_URL` | No | Public origin for copied invite links, such as `https://jetdemo-xmas-stream-jetbrain.unkey.app`. When unset, links use the request host. |
| `DATA_DIR` | No | SQLite directory when `DATABASE_URL` is unset. Defaults to `/tmp/xmas-stream`. |
| `PLATINUM_SPOTS` | No | Default `3`. |
| `GOLD_SPOTS` | No | Default `4`. |
| `PORT` | Injected | Unkey sets this. Local default is 8080. |

`GET /health` reports `adminCodeSet` and `sponsorCodeSet` as true or false. It never includes the codes. Unkey applies environment variables on the next deployment, so after changing either code, redeploy. If a code is missing, the login page says so instead of pretending the password was wrong.

Keep production at one replica unless `DATABASE_URL` is set. With Postgres, more than one replica is fine. Booking writes take a transaction lock so two sponsors can't grab the same block.

## Run locally

```bash
npm install
npm test
ADMIN_CODE=local-admin-code SPONSOR_CODE=local-sponsor-code SESSION_SECRET=local-session-secret npm start
```

Open [http://localhost:8080](http://localhost:8080), [http://localhost:8080/portal](http://localhost:8080/portal), and [http://localhost:8080/admin](http://localhost:8080/admin). Sponsors pick their name, then enter the access code from the admin desk (or `local-sponsor-code` while that fallback is set). Jason uses `local-admin-code`.

To print every current sponsor code once, from a machine that should see them:

```bash
curl -s https://jetdemo-xmas-stream-jetbrain.unkey.app/admin/api/sponsor-codes \
  -H "x-admin-code: YOUR_ADMIN_CODE"
```

The header is the only way in. A wrong or missing code returns 401. An admin browser session is not enough. The JSON is `{ "sponsors": [{ "slug", "name", "code" }] }`. `/health` still reports only whether the env codes are set.

Docker, same contract Unkey uses:

```bash
docker build -t xmas-stream .
docker run --rm -p 8080:8080 -e ADMIN_CODE=local-admin-code -e SPONSOR_CODE=local-sponsor-code -e SESSION_SECRET=local-session-secret xmas-stream
```

## Portal rules

The grid is every half hour from 2:00 PM to 8:00 PM ET. Platinum books 1 hour (two blocks). Gold books 30 minutes. A block that overlaps someone else is refused. Jason can override from the admin desk, which clears the other booking. Silver and Community don't book time. They still send assets.

Assets are due Friday, Nov 20, 2026. Everyone sends a logo, a website, talking points, an X handle, and a credit line. Logo files and the websites on file are listed in `docs/sponsors.md`. Platinum, Gold, and prize sponsors also send prize details and shipping. Silver and Community are cash for freeCodeCamp, so their form stops there. The desk shows how many of those fields are in.

Seeded sponsors: Laravel and Unkey (Platinum, one Platinum spot left open), Coder, Luke (@LukeCFPLevelUp, no earlier than 2:00 PM ET), Kunal (@kunalstwt), and Tighten (Gold), CodeRabbit, Torc, and RenderATL (Silver). RenderATL’s giveaway is one all-access ticket. A RenderATL row still marked prize is confirmed as Silver on startup. Tighten's mark and wordmark are already on file. A missing seed sponsor is added on startup. Existing rows are left alone.

## The public page

`/` is the stream hub: Friday, December 18, 2026, 2:00–8:00 PM ET, the sponsor lineup, and one game per hour. `/sponsor` is the one-pager to send a company. Openings there are counted from the database against the original caps (Platinum 3, Gold 4). Silver and Community were not capped. `server/campaign.js` is the only file for the public numbers. Set `raised` (it starts at `4000`) and `goal`. The donate button uses `tiltifyUrl` (https://tilt.fyi/9va4uz7GEn). Sponsor login is a small link to `/portal`. `/admin` is not linked from the public page.
