Admin Accounts update
=====================
Extract this zip into your project folder and choose "Replace" when asked.
No database change is needed.

New files:
  functions/lib/accounts.js
  functions/api/admin/accounts/index.js
  functions/api/admin/accounts/[id].js
  functions/api/admin/password.js

Replaced files:
  functions/lib/api.js      (adds a small readJson helper)
  src/dashboard.js          (Admin Accounts tab + Change password button)
