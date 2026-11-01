# Trick or Commit 🎃

Your [Petdex](https://petdex.dev) pet goes trick-or-treating through your GitHub repos.

- Active repos (pushed in the last ~4 months, or 10+ stars) hand out **treats** 🍬
- Abandoned repos play **tricks** 🕸️
- You get a verdict ("Sugar Rush Shipper", "Haunted House Keeper"…) and a video to post on X.

## How it works

1. Enter a GitHub username → public repos via the GitHub REST API (server-side).
2. Your pet is picked deterministically from the public Petdex manifest (`/api/manifest`). Same username, same pet.
3. The spritesheet is proxied same-origin so the `<canvas>` can be recorded.
4. A canvas scene animates the pet using its Petdex states (`running-right`, `waiting`, `jumping`, `failed`, `waving`).
5. `MediaRecorder` exports the run as MP4 (Chrome 126+ / Safari) or WebM.
6. `next/og` generates a share card for every `/u/<username>` link.

## Run locally

```bash
npm install
cp .env.example .env.local   # add a GITHUB_TOKEN to avoid rate limits
npm run dev
```

Offline/mock mode (no GitHub or Petdex calls): `MOCK=1 npm run dev`.

## Deploy

One click on Vercel. Set these environment variables:

| Var | Why |
| --- | --- |
| `GITHUB_TOKEN` | Fine-grained token, no scopes needed. Raises the limit from 60 to 5,000 req/h. |
| `NEXT_PUBLIC_SITE_URL` | Your deployed URL, used for share links and OG images. |

## Stack

Next.js 16 (App Router) · Canvas 2D · MediaRecorder · next/og. No database.

## Credits

Pets come from [Petdex](https://petdex.dev) by [Crafter Station](https://crafter.run). Each pet belongs to its creator. Inspired by Crafter Station's Petdex Halloween experiment. Not affiliated with GitHub or Petdex.

## License

MIT (code only — pet assets keep their creators' licenses).
