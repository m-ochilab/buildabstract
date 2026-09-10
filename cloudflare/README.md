# BuildAbstract Cloudflare deployment source

This directory preserves the Cloudflare Workers/D1 application that was deployed
on 2026-09-10. The Worker and frontend bundle were recovered from the live
deployment because the repository's existing FastAPI source does not match the
public application.

The 2026-09-10 change adds:

- an 11-item abstract rubric, with background first and cross-section logical
  consistency last;
- explicit completion snapshots linking the first full generation to the final
  11-item evaluation;
- normalized item-score history for each section assessment and adopted
  candidate;
- `completions` and `section_scores` research exports.

The minified frontend patch is reproducible with:

```sh
node scripts/patch-frontend.mjs
```

Do not run it twice against an already-patched bundle; the script deliberately
fails unless every expected original string occurs exactly once.

Validate the deployment bundle with:

```sh
node --check src/index.js
node --check public/assets/completion.js
npx wrangler deploy --dry-run --config wrangler.jsonc
```

Apply pending D1 migrations before deploying the Worker:

```sh
npx wrangler d1 migrations apply buildabstract --remote --config wrangler.jsonc
npx wrangler deploy --config wrangler.jsonc
```
