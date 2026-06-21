# Rename `agenda` → `portal` — Human Action Checklist

This document is the human-side runbook for renaming the public agenda to
portal. The code-side changes (GitHub repo rename, package name, BFF
function directory, Vercel config, `x-client-id`, environment files) are
already committed and pushed in commit `TBD` — see the commit log.

## What's done (no action required)

- [x] GitHub repo renamed: `RobertoCarrera/simplifica-agenda-frontend` →
      `RobertoCarrera/simplify-portal-frontend`. The old URL still
      redirects via GitHub's automatic 301.
- [x] `package.json` `name` field: `simplify-portal-frontend`
- [x] `vercel.json`: added a 301 redirect from `agenda.simplificacrm.es`
      to `portal.simplificacrm.es` (host-based, preserves path + query)
- [x] Supabase Edge Function renamed: `booking-public` →
      `portal-public` (source directory moved with `git mv`)
- [x] `x-client-id` in `BookingPublicService` and environments:
      `simplifica-portal-frontend` (the old id `simplifica-agenda-frontend`
      is still accepted by the BFF `VALID_CLIENT_IDS` allowlist for
      backward compatibility)
- [x] Vercel `outputDirectory` still points to the existing build
      output path; will rename in a follow-up

## What the human needs to do in the Vercel dashboard

1. **Open the Vercel project** for the frontend (currently named
   `simplifica-agenda-frontend` or `simplify-agenda-frontend`).
2. **Settings → General → Project Name**: rename to
   `simplify-portal-frontend` (matches the GitHub repo).
3. **Settings → Domains**:
   - Add `portal.simplificacrm.es` (new custom domain)
   - Configure the DNS: CNAME `portal` → `cname.vercel-dns.com`
   - Wait for SSL provisioning (~5 min)
   - Keep `agenda.simplificacrm.es` assigned for now (the 301 redirect
     in `vercel.json` only fires when the request hits Vercel; before
     DNS is updated, traffic still goes to the old domain and the
     redirect kicks in)
4. **Settings → Environment Variables**: confirm the BFF_BASE_URL and
   SUPABASE_ANON_KEY are still pointing to the private project
   (`ufutyjbqfjrlzkprvyvs`). The script's default is now correct, but
   Vercel env vars override it and may be stale.
5. **Deployments**: trigger a fresh deploy of the latest commit to
   propagate the new `vercel.json` redirect.

## What the human needs to do in Cloudflare / DNS

1. **Cloudflare DNS for `simplificacrm.es`**:
   - Add a CNAME: `portal` → `cname.vercel-dns.com`
   - (The old `agenda` CNAME stays in place until step 3 below)
2. After Vercel has `portal.simplificacrm.es` provisioned, test it
   manually with `curl -I https://portal.simplificacrm.es/` — should
   return 200.
3. **Cutover** (only after step 2 succeeds):
   - Remove the `agenda` CNAME (or change it to point to a parking page)
   - Traffic now flows to `portal.simplificacrm.es`
4. **Optional**: keep `agenda.simplificacrm.es` as a parked domain
   pointing to `portal.simplificacrm.es` (with a CNAME or redirect)
   so old bookmarks don't 404.

## Optional follow-ups (not blocking)

- Rename the BFF project reference: in Supabase, the EF is now
  `portal-public` on project `ufutyjbqfjrlzkprvyvs`. The `supabase`
  CLI command-line `functions list` will show the new name after the
  next deploy.
- Update the BFF_BASE_URL env var in Vercel to point to
  `https://ufutyjbqfjrlzkprvyvs.supabase.co/functions/v1/portal-public`
  (the function name in the URL is the directory name).
- Update any internal docs / Linear tickets / Notion pages that
  reference the old name.
- Decide what to do with the `simplifica-portal-frontend` local
  directory (the with-login one) — it's a separate project, this
  rename doesn't affect it. But the name collision is now confusing;
  consider renaming it to `simplifica-client-portal-frontend` in a
  follow-up.

## Rollback

If anything goes wrong, the rollback is:
1. Revert the Vercel domain back to `agenda.simplificacrm.es`
2. The GitHub repo can be renamed back to `simplifica-agenda-frontend`
   (GitHub allows the rename to "the name it had previously")
3. The BFF directory can be `git mv` back to `booking-public`
4. The 301 redirect in `vercel.json` will gracefully send people from
   `portal.simplificacrm.es` back to `agenda.simplificacrm.es`

The 301 redirect at the Vercel level means even mid-migration users
land on the right domain — there's no broken window.
