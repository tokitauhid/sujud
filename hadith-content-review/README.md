# Sujud Hadith Content Review

A standalone Cloudflare Worker review site for community feedback on hadith candidates used by Sujud. This project is designed to live in its own GitHub repository.

## What It Does

- Serves a small static review interface.
- Lists hadith candidates from Cloudflare D1.
- Lets reviewers mark a candidate relevant or not relevant.
- Lets reviewers choose controlled tags.
- Lets reviewers add editorial notes.
- Requires an explicit Save review action so relevance, tags, and notes are submitted together.
- Stores one review per browser reviewer and candidate.
- Shows aggregate review counts without publishing content automatically.

Community reviews are not scholarly verification. Candidate text, grading, translation, licensing, and attribution must be separately reviewed before content is released to Sujud.

## Local Setup

Requirements: Node.js 18+ and a Cloudflare account for D1 deployment.

```bash
npm install
npx wrangler login
npx wrangler d1 create sujud-hadith-content-review
```

Copy the returned database ID into `wrangler.toml`, then initialize the local database:

```bash
npx wrangler d1 execute sujud-hadith-content-review --local --file=./schema.sql
npm run dev
```

Open the local URL printed by Wrangler.

## Add Candidates

The repository intentionally does not automatically publish imported hadith. Seed candidates only after checking source, reference, translation, grading, and licensing.

Insert reviewed candidate records into D1 using a prepared SQL import or an admin-only seed script. A candidate should initially use:

```text
status = community-review
```

Do not expose a public endpoint that can insert arbitrary candidate text.

To generate a seed file from a reviewed JSON export:

```bash
node scripts/generate-seed-sql.mjs ./path/to/reviewed-candidates.json seed-candidates.sql
npx wrangler d1 execute sujud-hadith-content-review --local --file=./seed-candidates.sql
```

Use `--remote` instead of `--local` when you are ready to seed the production database. Review the generated SQL before running it.

## Deploy From GitHub

1. Create a separate GitHub repository and push this folder's contents to it.
2. Create the production D1 database:

```bash
npx wrangler d1 create sujud-hadith-content-review
npx wrangler d1 execute sujud-hadith-content-review --remote --file=./schema.sql
```

3. Put the production database ID in `wrangler.toml`.
4. Connect the GitHub repository to Cloudflare Workers & Pages, or deploy from CI with Wrangler.
5. Configure the build command as `npm install && npm run typecheck`.
6. Configure the deploy command as `npx wrangler deploy`.

For GitHub Actions, store `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets. Use a token limited to Workers and D1 deployment.

## Review Workflow

```text
candidate import
  -> community-review
  -> moderator review
  -> scholarly verification
  -> license verification
  -> approved release export
  -> Sujud app dataset
```

The current API accepts community reviews but does not promote candidates to `approved`. Add an authenticated moderator dashboard before using this in production.

## Moderator Dashboard

The moderator dashboard is available at `/moderator.html`. It uses server-side Worker authentication and D1 data. It can:

- Inspect every candidate and all community reviews.
- Search and filter candidates by status.
- Review aggregate relevance counts, tags, notes, and reports.
- Move candidates through `community-review`, `needs-moderation`, `approved`, and `rejected` states.
- Export approved candidates as JSON for editorial review and later Sujud import.

Configure the moderator token as a Cloudflare secret. Do not put it in `wrangler.toml`, frontend code, or GitHub:

```bash
npx wrangler secret put MODERATOR_TOKEN
npx wrangler deploy
```

Open `https://YOUR_WORKER_DOMAIN/moderator.html` and enter the same token. The local setup stores the generated token at `~/.config/sujud/hadith-content-review-moderator-token`; read it from your terminal when needed with `cat ~/.config/sujud/hadith-content-review-moderator-token`. The token is kept only in the current browser session after entry.

Community review remains separate from scholarly and licensing approval. An approved dashboard status means a moderator selected it for export; it does not by itself prove authenticity or grant translation redistribution rights.

## Fixed Tags

The UI uses these tags:

- consistency
- patience
- good-deeds
- prayer
- jamaah
- returning-after-difficulty
- time-and-prayer
- hope
- general
- not-relevant
- needs-context
- possible-duplicate
- translation-review

## Security Notes

The browser reviewer ID is for deduplication, not authentication. Add Cloudflare Turnstile, rate limiting, and authenticated moderator access before public launch. Do not put admin tokens in frontend code.
