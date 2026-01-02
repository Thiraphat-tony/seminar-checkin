Deployment to Vercel — quick guide

1) What this workflow does
- On push to `main`, GitHub Actions will run `npm ci` and `npm run build` then call Vercel to deploy the project to production.

2) Required GitHub repository secrets
- `VERCEL_TOKEN` — personal token from your Vercel account (Settings → Tokens)
- `VERCEL_ORG_ID` — your Vercel organization id
- `VERCEL_PROJECT_ID` — the Vercel project id for this repo
- `SUPABASE_URL` — your Supabase project URL (used as NEXT_PUBLIC_SUPABASE_URL)
- `SUPABASE_ANON_KEY` — public anon key (used as NEXT_PUBLIC_SUPABASE_ANON_KEY)

3) Required Vercel environment variables (set these in your Vercel project Dashboard)
- `NEXT_PUBLIC_SUPABASE_URL` = same as `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = same as `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` = the service role key (server-only secret; DO NOT expose as `NEXT_PUBLIC_`)

4) How to get Vercel IDs
- Create a Vercel project and connect to this GitHub repository (recommended). After creation you can find `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` via the project settings or by using the Vercel CLI:
  - `vercel projects ls --token <VERCEL_TOKEN>`

5) Notes & recommendations
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in Vercel environment variables (Production / Preview as needed) and **do not** expose it to browser (no `NEXT_PUBLIC_` prefix).
- If you prefer not to use the action, you can also connect the repo directly in Vercel and rely on Vercel automatic builds.

6) Next steps I can do for you
- Add the repo to Vercel (requires access), or
- Help you obtain the `VERCEL_*` IDs and add the example secrets to GitHub if you grant access, or
- Set up a GitHub Action variant that runs only on tags, branches, or PR merges.
