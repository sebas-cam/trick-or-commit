# Trick or Commit 🎃

Your [Petdex](https://petdex.dev) pet goes trick-or-treating through your GitHub repos, and you keep the video.

- Active repos (a real commit on the default branch in the last ~4 months, or 10+ stars and one within a year) hand out **treats** 🍬. Pushes to other branches and empty commits don't count.
- Abandoned repos play **tricks** 🕸️, and the most abandoned one is always the last door
- Archived repos **rest in peace** 🪦: finished on purpose isn't abandoned
- **Exorcism mode** 👻: commit to a haunted repo, hit "Knock again", and its ghost leaves on video
- You get a verdict backed by a real stat ("Midnight Knocker", "Haunted House Keeper"…), a vertical video with sound, a share image and a share card
- Spanish and English, Halloween and Día de Muertos themes

## How it works

1. Enter a GitHub username → every public repo (paginated, up to 500) with its last non-empty default-branch commit, a commit sample and the contribution calendar via the GitHub APIs (server-side). Without a token it falls back to REST and the last push.
2. A starting pet is picked deterministically from a curated list in the public Petdex manifest (`/api/manifest`). You can switch to any other pet on that list.
3. The spritesheet is proxied same-origin so the `<canvas>` can be exported.
4. A canvas scene (`lib/scene.ts`) draws procedural pixel art around the pet's Petdex states (`running-right`, `waiting`, `jumping`, `failed`, `waving`). The soundtrack (`lib/audio.ts`) is synthesized from the same timeline.
5. `lib/export.ts` encodes a 1080×1920 MP4 frame by frame with WebCodecs ([Mediabunny](https://mediabunny.dev)), and falls back to real-time `MediaRecorder` in browsers without it.
6. `next/og` generates a share card for every `/u/<username>` link.
7. Exorcisms need no database: the browser remembers which doors were haunted (`lib/exorcism.ts`, public repos only), and "Knock again" drops that user's cached GitHub data with `updateTag`.

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
| `GITHUB_TOKEN` | Fine-grained token, no scopes needed. Raises the REST limit from 60 to 5,000 req/h and enables GraphQL: real default-branch commits, contributions and streaks. Without it, repos are judged by their last push and those stats are left out. |
| `NEXT_PUBLIC_SITE_URL` | Your deployed URL, used for share links and OG images. |

### Private repos (optional)

People can sign in with a GitHub App and add private repos they choose to their run. It only reads metadata, never code, so private repos are judged by their last push. The token lives in an encrypted cookie for an hour and is revoked on sign-out, and there's no database. Private names are hidden until the owner reveals them, and that run only exists at `/me`: `/u/<username>` always stays public data.

Register a [GitHub App](https://github.com/settings/apps/new) with:

| Setting | Value |
| --- | --- |
| Callback URL | `<site>/api/auth/github/callback` |
| Setup URL | `<site>/api/auth/github/setup`, with **Redirect on update** on |
| Request user authorization during installation | Off |
| Webhook | Inactive |
| Permissions | Repository → Metadata: Read-only. Nothing else. |
| Where can it be installed | Any account |

Then set `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG` (the name in the app's URL) and `SESSION_SECRET` (`openssl rand -base64 32`). Without all four, the option stays hidden.

## Stack

Next.js 16 (App Router) · Canvas 2D · Web Audio · WebCodecs + Mediabunny · next/og. No database. Fonts: Creepster, JetBrains Mono, DM Sans.

## Credits

Pets come from [Petdex](https://petdex.dev) (https://crafter.run). Each pet belongs to its creator. Not affiliated with GitHub or Petdex.

## License

MIT (code only — pet assets keep their creators' licenses).
