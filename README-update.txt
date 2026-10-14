Login protection + view/download counts + suggestions switched off
==================================================================

ORDER MATTERS (the new code needs the new database tables):

 1. Extract this zip into your project folder (choose Replace when asked).

 2. Update the databases FIRST, before you push:
      npx wrangler d1 migrations apply sk-canawa-transparency-db --local
      npx wrangler d1 migrations apply sk-canawa-transparency-db --remote
    (type y when asked). This only ADDS columns and tables, so the live
    website keeps working normally while you do it.

 3. Test locally (npm run dev / your usual command), then:
      git add .
      git commit -m "Add login protection, view/download counts, switch off suggestions"
      git push

 If you ever get locked out while testing, this clears all lockouts at once:
      npx wrangler d1 execute sk-canawa-transparency-db --remote --command "DELETE FROM login_failures"
 (use --local instead of --remote for your test copy). Locks also end by
 themselves after about 15 minutes.

New files
  migrations/0003_login_protection_and_counts.sql
  functions/lib/login-guard.js
  functions/lib/hits.js
  functions/api/admin/profile.js

Replaced files
  functions/api/login.js                       (lockout, login history, any capitals)
  functions/lib/session.js                     (also reads the first-login flag)
  functions/lib/api.js                         (blocks the dashboard until the password is changed)
  functions/api/admin/password.js
  functions/api/admin/accounts/index.js
  functions/api/admin/accounts/[id].js
  functions/api/documents/[id]/file.js         (counts views and downloads)
  functions/api/admin/documents/index.js       (sends the counts to the dashboard)
  scripts/create-admin.mjs                     (new members choose their own password)
  src/dashboard.js
  src/main.js                                  (suggestions card commented out)
  functions/api/suggestions.js                 (suggestions commented out)
  functions/api/admin/suggestions/index.js     (suggestions commented out)
  functions/api/admin/suggestions/[id].js      (suggestions commented out)

Switching the suggestions feature back on later: search for
SUGGESTIONS-DISABLED in src/main.js and src/dashboard.js, and read the note at
the top of the three files under functions/api/ listed above.
