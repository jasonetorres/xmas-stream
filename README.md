# xmas-stream

Landing page for Jason Torres' Christmas Birthday Livestream (Fri Dec 18, 2026, 2–8 PM ET), raising $10,000 for freeCodeCamp.

- `public/` is the site: `index.html`, sponsor logos, cover art, and the sponsor packet PDF.
- `Dockerfile` serves it with nginx on `$PORT` (default 8080), which is what Unkey expects.

Run locally:

```bash
docker build -t xmas-stream . && docker run -p 8080:8080 xmas-stream
```

Pushes to `main` redeploy production on Unkey.
