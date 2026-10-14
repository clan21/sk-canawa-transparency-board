Suggestions + admin-chosen passwords update
===========================================
1. Extract this zip into your project folder (choose Replace when asked).
2. Create the new database table (this is NEW, do it before pushing):
     npx wrangler d1 migrations apply sk-canawa-transparency-db --local
     npx wrangler d1 migrations apply sk-canawa-transparency-db --remote
3. Test locally, then:  git add .  /  git commit  /  git push

New files:
  migrations/0002_create_suggestions.sql
  functions/lib/suggestions.js
  functions/api/suggestions.js
  functions/api/admin/suggestions/index.js
  functions/api/admin/suggestions/[id].js
  src/suggestions.js
  src/suggestions.css

Replaced files:
  functions/lib/accounts.js
  functions/api/admin/accounts/index.js
  functions/api/admin/accounts/[id].js
  src/main.js        (4 small changes: import, nav link, card, init call)
  src/dashboard.js
