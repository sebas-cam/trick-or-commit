# Trick or Commit 🎃

Your [Petdex](https://petdex.dev) pet goes trick-or-treating through your GitHub repos, and you keep the video.

- Active repos (pushed in the last ~4 months, or 10+ stars and pushed within a year) hand out **treats** 🍬
- Abandoned repos play **tricks** 🕸️, and the most abandoned one is always the last door
- You get a verdict backed by a real stat ("Midnight Knocker", "Haunted House Keeper"…), a vertical video with sound, a share image and a share card
- Spanish and English, Halloween and Día de Muertos themes

## How it works

1. Enter a GitHub username → public repos, a commit sample and the contribution calendar via the GitHub APIs (server-side).
2. A starting pet is picked deterministically from a curated list in the public Petdex manifest (`/api/manifest`). You can switch to any other pet on that list.
3. The spritesheet is proxied same-origin so the `<canvas>` can be exported.
4. A canvas scene (`lib/scene.ts`) draws procedural pixel art around the pet's Petdex states (`running-right`, `waiting`, `jumping`, `failed`, `waving`). The soundtrack (`lib/audio.ts`) is synthesized from the same timeline.
5. `lib/export.ts` encodes a 1080×1920 MP4 frame by frame with WebCodecs ([Mediabunny](https://mediabunny.dev)), and falls back to real-time `MediaRecorder` in browsers without it.
6. `next/og` generates a share card for every `/u/<username>` link.

## Run locally

```bash
npm install
cp .env.example .env.local   # add a GITHUB_TOKEN for contributions and to avoid rate limits
npm run dev
```

Offline/mock mode (no GitHub or Petdex calls): `MOCK=1 npm run dev`.

## Deploy

One click on Vercel. Set these environment variables:

| Var | Why |
| --- | --- |
| `GITHUB_TOKEN` | Fine-grained token, no scopes needed. Raises the REST limit from 60 to 5,000 req/h and enables contributions and streaks, which GitHub only serves through GraphQL. Without it those stats are left out. |
| `NEXT_PUBLIC_SITE_URL` | Your deployed URL, used for share links and OG images. |

## Stack

Next.js 16 (App Router) · Canvas 2D · Web Audio · WebCodecs + Mediabunny · next/og. No database. Fonts: Creepster, JetBrains Mono, DM Sans.

## Credits

Pets come from [Petdex](https://petdex.dev) by [Crafter Station](https://crafter.run). Each pet belongs to its creator. Inspired by Crafter Station's Petdex Halloween experiment. Not affiliated with GitHub or Petdex.

## License

MIT (code only — pet assets keep their creators' licenses).
