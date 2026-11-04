# Sponsor logos and websites

Checked November 4, 2026. There is no logo URL column. A logo is either a file in the repo or bytes in the `logos` table. The website is the `url` column. Empty websites for the companies below are filled on startup. A website someone already saved is left alone. Luke and Kunal stay blank.

Sites below were requested and answered over HTTPS. `unkey.com`, `coderabbit.ai`, `torc.dev`, and `renderatl.com` redirect to their `www` host. The stored link is the name that was requested.

| Sponsor | Website | Logo | Path |
| --- | --- | --- | --- |
| Laravel | https://laravel.com | Present | `public/logos/laravel-wordmark.png` (hub). Also `public/logos/laravel-mark.png`. None in the database until someone uploads. |
| Unkey | https://unkey.com | Present | `public/logos/unkey.svg`. None in the database until someone uploads. |
| Coder | https://coder.com | Present | `public/logos/coder.png`. None in the database until someone uploads. |
| Luke | Blank. X: https://x.com/LukeCFPLevelUp | Missing | No file in the repo and none in the database. The hub uses a text badge. |
| Kunal | Blank. X: https://x.com/kunalstwt | Missing | No file in the repo and none in the database. The hub uses a text badge. |
| Tighten | https://tighten.com | Present | Hub: `public/logos/tighten-mark.png`. Seeded into the database from `server/seed-logos/tighten-mark.png` and `server/seed-logos/tighten-wordmark.png`. |
| CodeRabbit | https://coderabbit.ai | Present | `public/logos/coderabbit.png`. None in the database until someone uploads. |
| Torc | https://torc.dev | Present | `public/logos/randstad.png`. That file is the Randstad mark. The stream credits Torc. None in the database until someone uploads. |
| RenderATL | https://renderatl.com | Present, not on the hub | Prize sponsor, so the public showcase does not include them yet. Ready for a dark page: `public/logos/renderatl-wordmark-dark.svg` (white wordmark, pink X) and `public/logos/renderatl-mark-dark.svg` (pink peach, white rings). Ready for a light page: `public/logos/renderatl-wordmark-light.svg` (black wordmark, pink X) and `public/logos/renderatl-mark-light.svg` (pink peach, dark rings). None in the database until someone uploads. |

The admin desk shows this same status on each sponsor: present or missing, the path, and how many logo rows are in the database. A sponsor edits Website on their portal. Jason can edit it from the sponsor card.
