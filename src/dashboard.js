import "bootstrap/dist/css/bootstrap.min.css";
import { Modal } from "bootstrap";
import "./style.css";
import "./documents.css";
import { renderPagination } from "./pagination.js";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB (the server checks this too)
const ALLOWED_TYPES = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG"
};

const categoryNames = {
  budget: "Annual Budget",
  expenses: "Expenses & Financial Reports",
  projects: "Projects & Programs",
  accomplishments: "Accomplishment Reports"
};

const DOCS_PER_PAGE = 10;

let documents = [];
let editingId = null;
let deletingId = null;
let isLoading = true;
let docPage = 1;
let isSuperadmin = false;
let activityPage = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// Always escape text before putting it inside innerHTML.
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function todayLocal() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

// Talks to the server. Throws an Error with a readable message on failure.
// If the session has expired, sends the admin back to the login page.
async function apiRequest(url, options = {}) {
  let response;

  try {
    response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...options
    });
  } catch {
    throw new Error("Unable to contact the server. Please try again.");
  }

  if (response.status === 401) {
    window.location.replace("/admin.html");
    return new Promise(() => {}); // stop here while the page redirects
  }

  let data = null;

  try {
    data = await response.json();
  } catch {
    // Not JSON; handled below.
  }

  // Safety net: the server refuses everything until the temporary password
  // has been replaced.
  if (response.status === 403 && data && data.code === "password_change_required") {
    requirePasswordChange();
    return new Promise(() => {});
  }

  if (!response.ok || !data || !data.success) {
    throw new Error(
      (data && data.message) || "Something went wrong. Please try again."
    );
  }

  return data;
}

// Password boxes (used when adding a member and when resetting a password).
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

// Example: kT7m-Qx3N-pR9w-Ze4b (letters and digits without look-alikes).
function randomPassword() {
  const limit = 256 - (256 % PASSWORD_ALPHABET.length);
  let chars = "";

  while (chars.length < 16) {
    for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
      if (byte < limit && chars.length < 16) {
        chars += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
      }
    }
  }

  return chars.match(/.{4}/g).join("-");
}

function passwordField(id) {
  return `
    <div class="mb-1">
      <label for="${id}" class="form-label fw-semibold">Password</label>
      <div class="input-group">
        <input id="${id}" type="password" class="form-control"
               autocomplete="new-password" minlength="12" required />
        <button type="button" class="btn btn-outline-secondary" data-password-toggle="${id}">Show</button>
        <button type="button" class="btn btn-outline-secondary" data-password-generate="${id}">Generate</button>
      </div>
      <div class="form-text">
        At least 12 characters. Type a temporary password for the member, or
        press Generate for a strong random one. They will choose their own at
        the first login.
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Page layout
// ---------------------------------------------------------------------------
const app = document.querySelector("#app");

app.innerHTML = `
  <nav class="navbar navbar-dark portal-navbar">
    <div class="container">
      <span class="navbar-brand fw-bold d-flex align-items-center gap-2 mb-0">
        <img src="/images/sk-logo.jpg" alt="SK Canawa logo" class="sk-logo" />
        <span>
          SK Canawa
          <span class="brand-accent">Admin</span>
        </span>
      </span>

      <div class="d-flex align-items-center gap-3">
        <div class="text-end text-white d-none d-sm-block lh-sm">
          <div class="fw-semibold" id="admin-name"></div>
          <small id="admin-role" class="text-uppercase" style="opacity:.8"></small>
        </div>
        <button type="button" id="change-password-button" class="btn btn-outline-light btn-sm">
          Change password
        </button>
        <a href="/" class="btn btn-outline-light btn-sm" target="_blank" rel="noopener">
          View public page
        </a>
        <button id="logout-button" class="btn btn-light btn-sm">Log Out</button>
      </div>
    </div>
  </nav>

  <main class="container py-4">
    <div id="dashboard-message" class="alert alert-info" role="status">
      Checking your session...
    </div>

    <div id="toast-area" aria-live="polite"></div>

    <section id="dashboard-content" class="d-none">
      <!-- Documents and Suggestions are for every admin. Recent Activity and
           Admin Accounts are only shown to the superadmin (see checkSession). -->
      <ul class="nav nav-pills dashboard-tabs gap-2 mb-4" id="dashboard-tabs">
        <li class="nav-item">
          <button type="button" class="nav-link active" data-tab="documents">Documents</button>
        </li>
        <!-- SUGGESTIONS-DISABLED: Suggestions tab
        <li class="nav-item">
          <button type="button" class="nav-link" data-tab="suggestions">
            Suggestions
            <span class="badge rounded-pill text-bg-warning ms-1 d-none" id="pending-badge"></span>
          </button>
        </li>
        -->
        <li class="nav-item d-none" data-superadmin-tab>
          <button type="button" class="nav-link" data-tab="activity">Recent Activity</button>
        </li>
        <li class="nav-item d-none" data-superadmin-tab>
          <button type="button" class="nav-link" data-tab="accounts">Admin Accounts</button>
        </li>
      </ul>

      <div id="panel-documents">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 class="h3 mb-1">Document Management</h1>
          <p class="text-secondary mb-0">
            Upload, edit, hide and delete the documents shown on the public board.
          </p>
        </div>
        <button id="upload-button" class="btn btn-portal">+ Upload Document</button>
      </div>

      <div class="row g-3 mb-2" id="summary-cards"></div>
      <p class="text-secondary small mb-4">
        Views and downloads count each visitor once per day for each document.
        Your own previews and search-engine robots are not counted. Counting
        started when this feature was added.
      </p>

      <div class="document-tools mb-4">
        <div class="row g-3">
          <div class="col-md-4">
            <label for="adminSearch" class="form-label fw-semibold">Search</label>
            <input id="adminSearch" type="search" class="form-control"
                   placeholder="Search by title..." />
          </div>
          <div class="col-md-3">
            <label for="adminCategory" class="form-label fw-semibold">Category</label>
            <select id="adminCategory" class="form-select">
              <option value="all">All Categories</option>
              ${Object.entries(categoryNames)
                .map(([value, name]) => `<option value="${value}">${name}</option>`)
                .join("")}
            </select>
          </div>
          <div class="col-md-2">
            <label for="adminStatus" class="form-label fw-semibold">Status</label>
            <select id="adminStatus" class="form-select">
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
          <div class="col-md-3">
            <label for="adminSort" class="form-label fw-semibold">Sort by</label>
            <select id="adminSort" class="form-select">
              <option value="newest">Newest first</option>
              <option value="views">Most viewed</option>
              <option value="downloads">Most downloaded</option>
            </select>
          </div>
        </div>
      </div>

      <p id="results-count" class="text-secondary small mb-2" aria-live="polite"></p>

      <div class="card border-0 shadow-sm">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Document</th>
                <th>Category</th>
                <th>Date</th>
                <th>File</th>
                <th>Status</th>
                <th>Views / Downloads</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody id="document-rows"></tbody>
          </table>
        </div>
      </div>

      <div class="mt-4" id="docPagination"></div>
      </div>

      <!-- SUGGESTIONS-DISABLED: Suggestions panel (delete these comment markers to switch back on)
      <div id="panel-suggestions" class="d-none">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h1 class="h3 mb-1">Public Suggestions</h1>
            <p class="text-secondary mb-0">
              Ideas sent by the public. Only the ones you approve are shown
              on the home page.
            </p>
          </div>
          <button type="button" id="refresh-suggestions" class="btn btn-outline-secondary btn-sm">
            Refresh
          </button>
        </div>

        <details class="card border-0 shadow-sm mb-4">
          <summary class="card-body py-3 fw-semibold" style="cursor:pointer">
            Review guidelines (read before approving)
          </summary>
          <div class="card-body pt-0 small">
            <p class="mb-2"><strong>Approve</strong> a suggestion only if it:</p>
            <ul class="mb-3">
              <li>is about SK projects, programs or how SK funds could be used;</li>
              <li>is respectful, with no insults, vulgar words or threats;</li>
              <li>has no private details such as phone numbers, home addresses or
                  names of private individuals;</li>
              <li>is not an advertisement, a chain message or political campaigning;</li>
              <li>does not accuse a named person of wrongdoing without proof.</li>
            </ul>
            <p class="mb-0 text-secondary">
              <strong>Reject</strong> anything else. A rejected suggestion is hidden
              from the public and can still be approved later. Delete obvious spam
              from the Rejected list. (These rules are only a starting point. Follow
              your council's own policy.)
            </p>
          </div>
        </details>

        <ul class="nav nav-pills gap-2 mb-3" id="suggestion-filters">
          <li class="nav-item"><button type="button" class="nav-link active" data-status="pending">Pending <span data-count="pending"></span></button></li>
          <li class="nav-item"><button type="button" class="nav-link" data-status="approved">Approved <span data-count="approved"></span></button></li>
          <li class="nav-item"><button type="button" class="nav-link" data-status="rejected">Rejected <span data-count="rejected"></span></button></li>
        </ul>

        <p id="suggestion-count" class="text-secondary small mb-2" aria-live="polite"></p>
        <div class="d-grid gap-3" id="suggestion-items"></div>
        <div class="mt-4" id="suggestionAdminPagination"></div>
      </div>
      -->

      <div id="panel-activity" class="d-none">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <div>
            <h1 class="h3 mb-1">Recent Activity</h1>
            <p class="text-secondary mb-0">
              Who uploaded, edited, hid or deleted documents, newest first.
            </p>
          </div>
          <button type="button" id="refresh-activity" class="btn btn-outline-secondary btn-sm">
            Refresh
          </button>
        </div>

        <p id="activity-count" class="text-secondary small mb-2" aria-live="polite"></p>

        <div class="card border-0 shadow-sm">
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>When</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Document</th>
                </tr>
              </thead>
              <tbody id="activity-rows"></tbody>
            </table>
          </div>
        </div>

        <div class="mt-4" id="activityPagination"></div>
      </div>

      <div id="panel-accounts" class="d-none">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <div>
            <h1 class="h3 mb-1">Admin Accounts</h1>
            <p class="text-secondary mb-0">
              Create accounts for SK members, reset forgotten passwords and
              deactivate members who leave the council.
            </p>
          </div>
          <button type="button" id="add-account-button" class="btn btn-portal">+ Add Member</button>
        </div>

        <div class="card border-0 shadow-sm">
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th class="text-end">Actions</th>
                </tr>
              </thead>
              <tbody id="account-rows"></tbody>
            </table>
          </div>
        </div>

        <p class="text-secondary small mt-3 mb-0">
          Members can upload, edit, hide and delete documents. Only the
          superadmin sees this tab and Recent Activity. Deactivating a member
          signs them out right away and keeps their past activity in the log.
        </p>
      </div>
    </section>
  </main>

  <!-- Upload / Edit modal -->
  <div class="modal fade" id="documentModal" tabindex="-1" aria-labelledby="documentModalTitle" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
      <form class="modal-content" id="document-form" novalidate>
        <div class="modal-header">
          <h2 class="modal-title h5" id="documentModalTitle">Upload Document</h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>

        <div class="modal-body">
          <div id="form-error" class="alert alert-danger d-none" role="alert"></div>

          <div class="mb-3">
            <label for="docTitle" class="form-label fw-semibold">Title</label>
            <input id="docTitle" class="form-control" maxlength="150" required />
          </div>

          <div class="row g-3 mb-3">
            <div class="col-md-7">
              <label for="docCategory" class="form-label fw-semibold">Category</label>
              <select id="docCategory" class="form-select" required>
                <option value="">Choose a category...</option>
                ${Object.entries(categoryNames)
                  .map(([value, name]) => `<option value="${value}">${name}</option>`)
                  .join("")}
              </select>
            </div>
            <div class="col-md-5">
              <label for="docDate" class="form-label fw-semibold">Publication date</label>
              <input id="docDate" type="date" class="form-control" required />
            </div>
          </div>

          <div class="mb-3">
            <label for="docDescription" class="form-label fw-semibold">Description</label>
            <textarea id="docDescription" class="form-control" rows="3" maxlength="500"></textarea>
            <div class="form-text">Optional. Up to 500 characters.</div>
          </div>

          <div class="mb-3">
            <label for="docFile" class="form-label fw-semibold" id="docFileLabel">File</label>
            <input id="docFile" type="file" class="form-control"
                   accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" />
            <div class="form-text" id="docFileHelp">
              PDF, JPG or PNG. Maximum 10 MB.
            </div>
          </div>

          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" role="switch" id="docPublished" checked />
            <label class="form-check-label" for="docPublished">
              Show this document on the public board
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="submit" class="btn btn-portal" id="save-button">Save</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Delete confirmation modal -->
  <div class="modal fade" id="deleteModal" tabindex="-1" aria-labelledby="deleteModalTitle" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title h5" id="deleteModalTitle">Delete document?</h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <p class="mb-1">You are about to delete:</p>
          <p class="fw-semibold mb-2" id="delete-title"></p>
          <p class="text-secondary small mb-0">
            It will be removed from the public board immediately.
          </p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-danger" id="confirm-delete">Delete</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Add member modal -->
  <div class="modal fade" id="accountModal" tabindex="-1" aria-labelledby="accountModalTitle" aria-hidden="true">
    <div class="modal-dialog">
      <form class="modal-content" id="account-form" novalidate>
        <div class="modal-header">
          <h2 class="modal-title h5" id="accountModalTitle">Add Member</h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div id="account-form-error" class="alert alert-danger d-none" role="alert"></div>

          <div class="mb-3">
            <label for="accountName" class="form-label fw-semibold">Display name</label>
            <input id="accountName" class="form-control" maxlength="60" autocomplete="off" required />
            <div class="form-text">Shown on the dashboard and in Recent Activity.</div>
          </div>

          <div class="mb-1">
            <label for="accountUsername" class="form-label fw-semibold">Username</label>
            <input id="accountUsername" class="form-control" maxlength="30"
                   autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" required />
            <div class="form-text">
              Lowercase letters, numbers, dots, dashes or underscores, for
              example juan.delacruz
            </div>
          </div>

          <div class="mt-3">
            ${passwordField("accountPassword")}
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="submit" class="btn btn-portal" id="account-save-button">Create account</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Reset password modal -->
  <div class="modal fade" id="resetModal" tabindex="-1" aria-labelledby="resetModalTitle" aria-hidden="true">
    <div class="modal-dialog">
      <form class="modal-content" id="reset-form" novalidate>
        <div class="modal-header">
          <h2 class="modal-title h5" id="resetModalTitle">Reset password</h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div id="reset-form-error" class="alert alert-danger d-none" role="alert"></div>
          <p class="fw-semibold mb-1" id="reset-subject"></p>
          <p class="text-secondary small">
            Their old password stops working and they are signed out right away.
            At their next login they will be asked to choose their own password.
          </p>
          ${passwordField("resetPassword")}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="submit" class="btn btn-portal" id="reset-save-button">Reset password</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Login details modal (shown once after creating or resetting) -->
  <div class="modal fade" id="credentialsModal" tabindex="-1" aria-labelledby="credentialsModalTitle"
       aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title h5" id="credentialsModalTitle">Login details</h2>
        </div>
        <div class="modal-body">
          <p id="credentials-intro" class="mb-3"></p>

          <dl class="row mb-3">
            <dt class="col-4">Name</dt>
            <dd class="col-8" id="credentials-name"></dd>
            <dt class="col-4">Username</dt>
            <dd class="col-8"><code id="credentials-username"></code></dd>
            <dt class="col-4">Password</dt>
            <dd class="col-8 mb-0"><code class="fs-6 user-select-all" id="credentials-password"></code></dd>
          </dl>

          <button type="button" class="btn btn-outline-secondary btn-sm mb-3" id="copy-credentials">
            Copy username and password
          </button>

          <div class="alert alert-warning small mb-0" role="alert">
            This password is shown <strong>only now</strong> and is not saved
            anywhere (only a scrambled version is). Give it to the member
            privately, not in a group chat. At their first login they will be
            asked to choose their own password, so you will not know it.
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-portal" data-bs-dismiss="modal">Done</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Confirm modal (reset password / deactivate / reactivate) -->
  <div class="modal fade" id="confirmModal" tabindex="-1" aria-labelledby="confirmModalTitle" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title h5" id="confirmModalTitle"></h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <p class="fw-semibold mb-2" id="confirm-subject"></p>
          <p class="text-secondary small mb-0" id="confirm-text"></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-portal" id="confirm-action"></button>
        </div>
      </div>
    </div>
  </div>

  <!-- Change my password modal -->
  <div class="modal fade" id="passwordModal" tabindex="-1" aria-labelledby="passwordModalTitle" aria-hidden="true">
    <div class="modal-dialog">
      <form class="modal-content" id="password-form" novalidate>
        <div class="modal-header">
          <h2 class="modal-title h5" id="passwordModalTitle">Change your password</h2>
          <button type="button" class="btn-close" id="password-close-x" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div id="password-forced-note" class="alert alert-warning d-none" role="alert">
            The password you were given is only temporary. Please choose your
            own password to continue.
          </div>
          <div id="password-form-error" class="alert alert-danger d-none" role="alert"></div>

          <div class="mb-3">
            <label for="currentPassword" class="form-label fw-semibold">Current password</label>
            <input id="currentPassword" type="password" class="form-control"
                   autocomplete="current-password" required />
          </div>
          <div class="mb-3">
            <label for="newPassword" class="form-label fw-semibold">New password</label>
            <input id="newPassword" type="password" class="form-control"
                   autocomplete="new-password" minlength="12" required />
            <div class="form-text">At least 12 characters. A few words with numbers works well.</div>
          </div>
          <div class="mb-1">
            <label for="confirmPassword" class="form-label fw-semibold">Type the new password again</label>
            <input id="confirmPassword" type="password" class="form-control"
                   autocomplete="new-password" required />
          </div>
          <div class="form-text">You will be signed out and asked to log in with the new password.</div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal" id="password-cancel">Cancel</button>
          <button type="submit" class="btn btn-portal" id="password-save-button">Change password</button>
        </div>
      </form>
    </div>
  </div>
`;

// ---------------------------------------------------------------------------
// Element references
// ---------------------------------------------------------------------------
const message = document.querySelector("#dashboard-message");
const content = document.querySelector("#dashboard-content");
const adminName = document.querySelector("#admin-name");
const adminRole = document.querySelector("#admin-role");
const logoutButton = document.querySelector("#logout-button");
const toastArea = document.querySelector("#toast-area");

const searchInput = document.querySelector("#adminSearch");
const categoryFilter = document.querySelector("#adminCategory");
const statusFilter = document.querySelector("#adminStatus");
const sortSelect = document.querySelector("#adminSort");
const rows = document.querySelector("#document-rows");
const resultsCount = document.querySelector("#results-count");
const summaryCards = document.querySelector("#summary-cards");
const docPagination = document.querySelector("#docPagination");
const dashboardTabs = document.querySelector("#dashboard-tabs");
const panelDocuments = document.querySelector("#panel-documents");
const panelActivity = document.querySelector("#panel-activity");
const activityRows = document.querySelector("#activity-rows");
const activityCount = document.querySelector("#activity-count");
const activityPagination = document.querySelector("#activityPagination");

const form = document.querySelector("#document-form");
const formError = document.querySelector("#form-error");
const fieldTitle = document.querySelector("#docTitle");
const fieldCategory = document.querySelector("#docCategory");
const fieldDate = document.querySelector("#docDate");
const fieldDescription = document.querySelector("#docDescription");
const fieldFile = document.querySelector("#docFile");
const fieldFileLabel = document.querySelector("#docFileLabel");
const fieldFileHelp = document.querySelector("#docFileHelp");
const fieldPublished = document.querySelector("#docPublished");
const modalTitle = document.querySelector("#documentModalTitle");
const saveButton = document.querySelector("#save-button");
const confirmDeleteButton = document.querySelector("#confirm-delete");

const documentModal = new Modal(document.querySelector("#documentModal"));
const deleteModal = new Modal(document.querySelector("#deleteModal"));

const panelAccounts = document.querySelector("#panel-accounts");
// SUGGESTIONS-DISABLED: const panelSuggestions = document.querySelector("#panel-suggestions");
// SUGGESTIONS-DISABLED: const suggestionItems = document.querySelector("#suggestion-items");
// SUGGESTIONS-DISABLED: const suggestionCount = document.querySelector("#suggestion-count");
// SUGGESTIONS-DISABLED: const suggestionPagination = document.querySelector("#suggestionAdminPagination");
// SUGGESTIONS-DISABLED: const pendingBadge = document.querySelector("#pending-badge");
const accountRows = document.querySelector("#account-rows");
const accountForm = document.querySelector("#account-form");
const accountFormError = document.querySelector("#account-form-error");
const accountSaveButton = document.querySelector("#account-save-button");
const fieldAccountName = document.querySelector("#accountName");
const fieldAccountUsername = document.querySelector("#accountUsername");
const accountModalEl = document.querySelector("#accountModal");
const credentialsModalEl = document.querySelector("#credentialsModal");
const confirmModalEl = document.querySelector("#confirmModal");
const accountModal = new Modal(accountModalEl);
const credentialsModal = new Modal(credentialsModalEl);
const confirmModal = new Modal(confirmModalEl);
const resetModalEl = document.querySelector("#resetModal");
const resetModal = new Modal(resetModalEl);
const resetForm = document.querySelector("#reset-form");
const resetFormError = document.querySelector("#reset-form-error");
const resetSaveButton = document.querySelector("#reset-save-button");
// "static": a click outside or the Esc key does not close it by accident.
const passwordModal = new Modal(document.querySelector("#passwordModal"), {
  backdrop: "static",
  keyboard: false
});
const passwordForm = document.querySelector("#password-form");
const passwordFormError = document.querySelector("#password-form-error");
const passwordSaveButton = document.querySelector("#password-save-button");

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
function showMessage(text, type = "info") {
  message.textContent = text;
  message.className = `alert alert-${type}`;
}

function showToast(text, type = "success") {
  const el = document.createElement("div");
  el.className = `alert alert-${type} alert-dismissible fade show`;
  el.setAttribute("role", "status");
  el.textContent = text;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "btn-close";
  close.setAttribute("data-bs-dismiss", "alert");
  close.setAttribute("aria-label", "Close");
  el.appendChild(close);

  toastArea.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderSummary() {
  const total = documents.length;
  const published = documents.filter((d) => d.is_published === 1).length;

  const cards = [
    { label: "Total documents", value: total },
    { label: "Published", value: published },
    { label: "Hidden", value: total - published },
    {
      label: "Total views",
      value: documents.reduce((sum, d) => sum + (Number(d.view_count) || 0), 0)
    },
    {
      label: "Total downloads",
      value: documents.reduce((sum, d) => sum + (Number(d.download_count) || 0), 0)
    }
  ];

  summaryCards.innerHTML = cards
    .map(
      (card) => `
      <div class="col-6 col-lg">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="text-secondary small">${card.label}</div>
            <div class="display-6 fw-bold">${card.value}</div>
          </div>
        </div>
      </div>`
    )
    .join("");
}

function renderRows() {
  docPagination.innerHTML = "";

  if (isLoading) {
    resultsCount.textContent = "";
    rows.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-secondary py-5">
          Loading documents...
        </td>
      </tr>`;
    return;
  }

  const term = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  const status = statusFilter.value;

  const filtered = documents
    .filter((d) => d.title.toLowerCase().includes(term))
    .filter((d) => category === "all" || d.category === category)
    .filter(
      (d) =>
        status === "all" ||
        (status === "published" ? d.is_published === 1 : d.is_published === 0)
    );

  // "Newest first" is the order the server sends. The other two put the most
  // read documents on top (ties: newest first).
  const sortMode = sortSelect.value;

  if (sortMode === "views" || sortMode === "downloads") {
    const field = sortMode === "views" ? "view_count" : "download_count";

    filtered.sort(
      (a, b) =>
        (Number(b[field]) || 0) - (Number(a[field]) || 0) ||
        b.publication_date.localeCompare(a.publication_date) ||
        b.id - a.id
    );
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / DOCS_PER_PAGE));
  docPage = Math.min(docPage, totalPages);

  const start = (docPage - 1) * DOCS_PER_PAGE;
  const pageItems = filtered.slice(start, start + DOCS_PER_PAGE);

  resultsCount.textContent =
    filtered.length === 0
      ? "0 documents"
      : `Showing ${start + 1}–${start + pageItems.length} of ${filtered.length} document(s)`;

  if (filtered.length === 0) {
    rows.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-secondary py-5">
          ${
            documents.length === 0
              ? 'No documents yet. Use "Upload Document" to add the first one.'
              : "No documents match your search."
          }
        </td>
      </tr>`;
    return;
  }

  rows.innerHTML = pageItems
    .map((d) => {
      const isPublished = d.is_published === 1;
      const typeLabel = ALLOWED_TYPES[d.mime_type] || "FILE";
      const views = Number(d.view_count) || 0;
      const downloads = Number(d.download_count) || 0;

      return `
      <tr>
        <td style="min-width:240px">
          <div class="fw-semibold">${esc(d.title)}</div>
          <div class="text-secondary small admin-description">${esc(d.description)}</div>
        </td>
        <td><span class="document-category">${esc(categoryNames[d.category])}</span></td>
        <td class="text-nowrap">${esc(formatDate(d.publication_date))}</td>
        <td class="text-nowrap small">
          ${esc(typeLabel)} &middot; ${esc(formatSize(d.file_size))}
          <div class="text-secondary">${esc(d.original_filename)}</div>
        </td>
        <td>
          <span class="badge ${isPublished ? "text-bg-success" : "text-bg-secondary"}">
            ${isPublished ? "Published" : "Hidden"}
          </span>
        </td>
        <td class="text-nowrap small">
          <div><strong>${esc(views)}</strong> ${views === 1 ? "view" : "views"}</div>
          <div class="text-secondary"><strong class="text-body">${esc(downloads)}</strong> ${downloads === 1 ? "download" : "downloads"}</div>
        </td>
        <td class="text-end text-nowrap">
          <a class="btn btn-sm btn-outline-secondary"
             href="/api/documents/${d.id}/file" target="_blank" rel="noopener">View</a>
          <button class="btn btn-sm btn-outline-secondary" data-action="edit" data-id="${d.id}">Edit</button>
          <button class="btn btn-sm btn-outline-secondary" data-action="toggle" data-id="${d.id}">
            ${isPublished ? "Hide" : "Show"}
          </button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${d.id}">Delete</button>
        </td>
      </tr>`;
    })
    .join("");

  renderPagination(docPagination, {
    page: docPage,
    totalPages,
    label: "Document pages",
    onChange: (page) => {
      docPage = page;
      renderRows();
      panelDocuments.scrollIntoView({ block: "start" });
    }
  });
}

function renderAll() {
  renderSummary();
  renderRows();
}

async function loadDocuments() {
  isLoading = true;
  renderAll();

  try {
    const result = await apiRequest("/api/admin/documents");
    documents = result.documents;
  } catch (error) {
    showToast(error.message, "danger");
  } finally {
    isLoading = false;
    renderAll();
  }
}

// ---------------------------------------------------------------------------
// Upload / Edit form
// ---------------------------------------------------------------------------
function showFormError(text) {
  formError.textContent = text;
  formError.classList.remove("d-none");
}

function openUploadForm() {
  editingId = null;
  form.reset();
  formError.classList.add("d-none");
  modalTitle.textContent = "Upload Document";
  fieldFileLabel.textContent = "File";
  fieldFileHelp.textContent = "PDF, JPG or PNG. Maximum 10 MB.";
  fieldDate.value = todayLocal();
  fieldPublished.checked = true;
  documentModal.show();
}

function openEditForm(id) {
  const doc = documents.find((d) => d.id === id);
  if (!doc) return;

  editingId = id;
  form.reset();
  formError.classList.add("d-none");
  modalTitle.textContent = "Edit Document";
  fieldTitle.value = doc.title;
  fieldCategory.value = doc.category;
  fieldDate.value = doc.publication_date;
  fieldDescription.value = doc.description;
  fieldPublished.checked = doc.is_published === 1;
  fieldFileLabel.textContent = "Replace file (optional)";
  fieldFileHelp.textContent =
    `Current file: ${doc.original_filename}. Leave empty to keep it.`;
  documentModal.show();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.classList.add("d-none");

  const title = fieldTitle.value.trim();
  const category = fieldCategory.value;
  const date = fieldDate.value;
  const description = fieldDescription.value.trim();
  const file = fieldFile.files[0];

  // Quick checks for a friendly message. The server checks everything again.
  if (!title) return showFormError("Please enter a title.");
  if (!categoryNames[category]) return showFormError("Please choose a category.");
  if (!date) return showFormError("Please choose a publication date.");
  if (!editingId && !file) return showFormError("Please choose a file to upload.");

  if (file) {
    if (file.size > MAX_FILE_SIZE) {
      return showFormError(
        `That file is ${formatSize(file.size)}. The limit is 10 MB.`
      );
    }
    if (!ALLOWED_TYPES[file.type]) {
      return showFormError("Only PDF, JPG and PNG files are allowed.");
    }
  }

  const data = new FormData();
  data.append("title", title);
  data.append("category", category);
  data.append("publication_date", date);
  data.append("description", description);
  data.append("is_published", fieldPublished.checked ? "1" : "0");
  if (file) data.append("file", file);

  saveButton.disabled = true;
  saveButton.textContent = file ? "Uploading..." : "Saving...";

  try {
    if (editingId) {
      await apiRequest(`/api/admin/documents/${editingId}`, {
        method: "PUT",
        body: data
      });
      showToast("Document updated.");
    } else {
      await apiRequest("/api/admin/documents", {
        method: "POST",
        body: data
      });
      showToast("Document uploaded.");
    }

    documentModal.hide();
    await loadDocuments();
  } catch (error) {
    showFormError(error.message);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save";
  }
});

// ---------------------------------------------------------------------------
// Table buttons (edit / hide-show / delete)
// ---------------------------------------------------------------------------
rows.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = Number(button.dataset.id);
  const doc = documents.find((d) => d.id === id);
  if (!doc) return;

  if (button.dataset.action === "edit") {
    openEditForm(id);
  }

  if (button.dataset.action === "toggle") {
    const next = doc.is_published === 1 ? 0 : 1;
    button.disabled = true;

    try {
      await apiRequest(`/api/admin/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: next })
      });
      showToast(next === 1 ? "Document is now published." : "Document is now hidden.");
      await loadDocuments();
    } catch (error) {
      showToast(error.message, "danger");
      button.disabled = false;
    }
  }

  if (button.dataset.action === "delete") {
    deletingId = id;
    document.querySelector("#delete-title").textContent = doc.title;
    deleteModal.show();
  }
});

confirmDeleteButton.addEventListener("click", async () => {
  if (!deletingId) return;

  confirmDeleteButton.disabled = true;

  try {
    await apiRequest(`/api/admin/documents/${deletingId}`, {
      method: "DELETE"
    });
    deleteModal.hide();
    showToast("Document deleted.");
    deletingId = null;
    await loadDocuments();
  } catch (error) {
    deleteModal.hide();
    showToast(error.message, "danger");
  } finally {
    confirmDeleteButton.disabled = false;
  }
});

document.querySelector("#upload-button").addEventListener("click", openUploadForm);
// Changing the search or a filter goes back to page 1.
function showFirstDocPage() {
  docPage = 1;
  renderRows();
}

searchInput.addEventListener("input", showFirstDocPage);
categoryFilter.addEventListener("change", showFirstDocPage);
statusFilter.addEventListener("change", showFirstDocPage);
sortSelect.addEventListener("change", showFirstDocPage);

// ---------------------------------------------------------------------------
// Tabs and the Recent Activity panel (superadmin only)
// The server also refuses /api/admin/activity for anyone else.
// ---------------------------------------------------------------------------
const ACTION_LABELS = {
  upload: { text: "Uploaded", badge: "text-bg-success" },
  edit: { text: "Edited", badge: "text-bg-primary" },
  edit_and_replace_file: { text: "Edited & replaced file", badge: "text-bg-primary" },
  publish: { text: "Published", badge: "text-bg-info" },
  hide: { text: "Hidden", badge: "text-bg-secondary" },
  delete: { text: "Deleted", badge: "text-bg-danger" },
  account_create: { text: "Account created", badge: "text-bg-success" },
  password_reset: { text: "Password reset", badge: "text-bg-warning" },
  account_deactivate: { text: "Account deactivated", badge: "text-bg-danger" },
  account_activate: { text: "Account reactivated", badge: "text-bg-info" },
  password_change: { text: "Changed own password", badge: "text-bg-secondary" },
  login: { text: "Logged in", badge: "text-bg-light text-dark border" },
  login_failed: { text: "Failed login", badge: "text-bg-warning" },
  login_locked: { text: "Account locked", badge: "text-bg-danger" },
  suggestion_approve: { text: "Suggestion approved", badge: "text-bg-success" },
  suggestion_reject: { text: "Suggestion rejected", badge: "text-bg-secondary" },
  suggestion_delete: { text: "Suggestion deleted", badge: "text-bg-danger" }
};

// The database stores UTC times; show them in the viewer's own time zone.
function formatDateTime(value) {
  const date = new Date(`${String(value).replace(" ", "T")}Z`);

  if (Number.isNaN(date.getTime())) return String(value ?? "");

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

async function loadActivity(page = activityPage) {
  activityPage = page;
  activityPagination.innerHTML = "";
  activityRows.innerHTML = `
    <tr>
      <td colspan="4" class="text-center text-secondary py-5">Loading activity...</td>
    </tr>`;

  try {
    const result = await apiRequest(`/api/admin/activity?page=${page}`);
    const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

    // The log got shorter since this page was opened; go to the last page.
    if (page > totalPages) return loadActivity(totalPages);

    if (result.activity.length === 0) {
      activityCount.textContent = "";
      activityRows.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-secondary py-5">
            No activity recorded yet.
          </td>
        </tr>`;
      return;
    }

    const first = (page - 1) * result.pageSize + 1;
    activityCount.textContent =
      `Showing ${first}–${first + result.activity.length - 1} of ${result.total} entries`;

    activityRows.innerHTML = result.activity
      .map((entry) => {
        const label = ACTION_LABELS[entry.action] || {
          text: entry.action,
          badge: "text-bg-secondary"
        };
        const who = entry.display_name || entry.username || "Unknown admin";

        return `
        <tr>
          <td class="text-nowrap small">${esc(formatDateTime(entry.created_at))}</td>
          <td class="text-nowrap">${esc(who)}</td>
          <td class="text-nowrap">
            <span class="badge ${label.badge}">${esc(label.text)}</span>
          </td>
          <td style="min-width:220px">
            <div class="admin-description">${esc(entry.details) || "&ndash;"}</div>
            ${
              entry.document_id
                ? `<div class="text-secondary small">Document #${esc(entry.document_id)}</div>`
                : ""
            }
          </td>
        </tr>`;
      })
      .join("");

    renderPagination(activityPagination, {
      page,
      totalPages,
      label: "Activity pages",
      onChange: (next) => {
        loadActivity(next);
        panelActivity.scrollIntoView({ block: "start" });
      }
    });
  } catch (error) {
    activityCount.textContent = "";
    activityRows.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-danger py-5">${esc(error.message)}</td>
      </tr>`;
  }
}

function showTab(requested) {
  // Activity and Accounts are superadmin only (the server checks too).
  const allowed = ["documents"]; // SUGGESTIONS-DISABLED: add "suggestions" back here
  if (isSuperadmin) allowed.push("activity", "accounts");
  const name = allowed.includes(requested) ? requested : "documents";

  panelDocuments.classList.toggle("d-none", name !== "documents");
  // SUGGESTIONS-DISABLED: panelSuggestions.classList.toggle("d-none", name !== "suggestions");
  panelActivity.classList.toggle("d-none", name !== "activity");
  panelAccounts.classList.toggle("d-none", name !== "accounts");

  dashboardTabs.querySelectorAll("[data-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });

  // SUGGESTIONS-DISABLED: if (name === "suggestions") loadSuggestions(suggestionStatus, 1);
  if (name === "activity") loadActivity(1);
  if (name === "accounts") loadAccounts();
}

dashboardTabs.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-tab]");
  if (tab) showTab(tab.dataset.tab);
});

document.querySelector("#refresh-activity").addEventListener("click", () => {
  loadActivity(1);
});

/* SUGGESTIONS-DISABLED: Suggestions tab logic (delete this opening marker and the closing marker below to switch back on)
// ---------------------------------------------------------------------------
// Suggestions tab (every admin; the server checks every request)
// ---------------------------------------------------------------------------
let suggestionStatus = "pending";
let suggestionPage = 1;

const STATUS_BADGES = {
  pending: { text: "Pending", badge: "text-bg-warning" },
  approved: { text: "Approved", badge: "text-bg-success" },
  rejected: { text: "Rejected", badge: "text-bg-secondary" }
};

function showCounts(counts) {
  document.querySelectorAll("[data-count]").forEach((el) => {
    el.textContent = `(${counts[el.dataset.count] ?? 0})`;
  });

  pendingBadge.textContent = counts.pending;
  pendingBadge.classList.toggle("d-none", !counts.pending);
}

async function loadSuggestions(status = suggestionStatus, page = 1) {
  suggestionStatus = status;
  suggestionPage = page;
  suggestionPagination.innerHTML = "";

  document.querySelectorAll("#suggestion-filters [data-status]").forEach((button) => {
    button.classList.toggle("active", button.dataset.status === status);
  });

  suggestionItems.innerHTML = `<div class="text-center text-secondary py-5">Loading suggestions...</div>`;

  try {
    const result = await apiRequest(
      `/api/admin/suggestions?status=${status}&page=${page}`
    );
    showCounts(result.counts);

    const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

    // Items were handled since this page was opened; go to the last page.
    if (page > totalPages) return loadSuggestions(status, totalPages);

    if (result.suggestions.length === 0) {
      suggestionCount.textContent = "";
      suggestionItems.innerHTML = `
        <div class="card border-0 shadow-sm">
          <div class="card-body text-center text-secondary py-5">
            ${
              status === "pending"
                ? "Nothing waiting for review."
                : `No ${esc(status)} suggestions.`
            }
          </div>
        </div>`;
      return;
    }

    const first = (page - 1) * result.pageSize + 1;
    suggestionCount.textContent =
      `Showing ${first}–${first + result.suggestions.length - 1} of ${result.total}`;

    suggestionItems.innerHTML = result.suggestions
      .map((item) => {
        const label = STATUS_BADGES[item.status] || STATUS_BADGES.pending;
        const reviewed =
          item.status !== "pending" && item.reviewed_at
            ? `<div class="text-secondary small mb-3">
                 ${item.status === "approved" ? "Approved" : "Rejected"}
                 ${item.reviewed_by_name ? `by ${esc(item.reviewed_by_name)}` : ""}
                 on ${esc(formatDateTime(item.reviewed_at))}
               </div>`
            : "";

        const buttons = [];

        if (item.status !== "approved") {
          buttons.push(
            `<button class="btn btn-sm btn-portal" data-suggestion-action="approve" data-id="${item.id}">Approve</button>`
          );
        }

        if (item.status === "pending") {
          buttons.push(
            `<button class="btn btn-sm btn-outline-secondary" data-suggestion-action="reject" data-id="${item.id}">Reject</button>`
          );
        }

        if (item.status === "approved") {
          buttons.push(
            `<button class="btn btn-sm btn-outline-secondary" data-suggestion-action="reject" data-id="${item.id}">Remove from public page</button>`
          );
        }

        if (item.status === "rejected") {
          buttons.push(
            `<button class="btn btn-sm btn-outline-danger" data-suggestion-action="delete" data-id="${item.id}">Delete</button>`
          );
        }

        return `
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
              <div>
                <strong>${esc(item.name)}</strong>
                <span class="text-secondary small ms-2">${esc(formatDateTime(item.created_at))}</span>
              </div>
              <span class="badge ${label.badge}">${esc(label.text)}</span>
            </div>
            <p class="mb-3 text-break" style="white-space:pre-line">${esc(item.message)}</p>
            ${reviewed}
            <div class="d-flex flex-wrap gap-2">${buttons.join("")}</div>
          </div>
        </div>`;
      })
      .join("");

    renderPagination(suggestionPagination, {
      page,
      totalPages,
      label: "Suggestion pages",
      onChange: (next) => {
        loadSuggestions(status, next);
        panelSuggestions.scrollIntoView({ block: "start" });
      }
    });
  } catch (error) {
    suggestionCount.textContent = "";
    suggestionItems.innerHTML = `<div class="text-center text-danger py-5">${esc(error.message)}</div>`;
  }
}

// Only the number for the tab badge (used when the dashboard opens).
async function refreshPendingBadge() {
  try {
    const result = await apiRequest("/api/admin/suggestions?status=pending&page=1");
    showCounts(result.counts);
  } catch {
    // The badge is a convenience; ignore problems here.
  }
}

document.querySelector("#suggestion-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-status]");
  if (button) loadSuggestions(button.dataset.status, 1);
});

document.querySelector("#refresh-suggestions").addEventListener("click", () => {
  loadSuggestions(suggestionStatus, 1);
});

suggestionItems.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-suggestion-action]");
  if (!button) return;

  const id = Number(button.dataset.id);
  const action = button.dataset.suggestionAction;

  if (action === "delete") {
    askToConfirm({
      title: "Delete suggestion?",
      subject: "This permanently removes the suggestion.",
      text: "It cannot be undone. Use this for spam; anything else can simply stay rejected.",
      label: "Delete",
      danger: true,
      run: async () => {
        await apiRequest(`/api/admin/suggestions/${id}`, { method: "DELETE" });
        hideThen(confirmModal, confirmModalEl, () => showToast("Suggestion deleted."));
        loadSuggestions(suggestionStatus, suggestionPage);
      }
    });
    return;
  }

  button.disabled = true;

  try {
    await apiRequest(`/api/admin/suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action === "approve" ? "approved" : "rejected" })
    });
    showToast(
      action === "approve"
        ? "Approved. It is now on the public page."
        : "Rejected. It is hidden from the public page."
    );
    await loadSuggestions(suggestionStatus, suggestionPage);
  } catch (error) {
    showToast(error.message, "danger");
    button.disabled = false;
  }
});
*/ // end SUGGESTIONS-DISABLED

// ---------------------------------------------------------------------------
// Admin Accounts tab (superadmin only; the server checks every request)
// ---------------------------------------------------------------------------
let accounts = [];
let pendingConfirm = null;
let resetTarget = null;

// Hide one modal, and only then run the next step (two modals cannot
// animate at the same time).
function hideThen(modal, element, next) {
  if (!element.classList.contains("show")) return next();

  element.addEventListener("hidden.bs.modal", next, { once: true });
  modal.hide();
}

function showCredentials({ title, intro, name, username, password }) {
  document.querySelector("#credentialsModalTitle").textContent = title;
  document.querySelector("#credentials-intro").textContent = intro;
  document.querySelector("#credentials-name").textContent = name;
  document.querySelector("#credentials-username").textContent = username;
  document.querySelector("#credentials-password").textContent = password;
  document.querySelector("#copy-credentials").textContent =
    "Copy username and password";
  credentialsModal.show();
}

// Do not keep the password in the page after the window is closed.
credentialsModalEl.addEventListener("hidden.bs.modal", () => {
  document.querySelector("#credentials-password").textContent = "";
});

document.querySelector("#copy-credentials").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const text =
    `Username: ${document.querySelector("#credentials-username").textContent}\n` +
    `Password: ${document.querySelector("#credentials-password").textContent}`;

  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied!";
  } catch {
    button.textContent = "Could not copy: select the password and copy it";
  }
});

function renderAccounts() {
  if (accounts.length === 0) {
    accountRows.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-secondary py-5">No accounts found.</td>
      </tr>`;
    return;
  }

  accountRows.innerHTML = accounts
    .map((account) => {
      const isMember = account.role === "admin";
      const isActive = account.is_active === 1;

      const actions = isMember
        ? `
          <button class="btn btn-sm btn-outline-secondary" data-account-action="reset" data-id="${account.id}">
            Reset password
          </button>
          <button class="btn btn-sm ${isActive ? "btn-outline-danger" : "btn-outline-success"}"
                  data-account-action="toggle" data-id="${account.id}">
            ${isActive ? "Deactivate" : "Reactivate"}
          </button>`
        : `<span class="text-secondary small">Protected</span>`;

      return `
      <tr>
        <td style="min-width:200px">
          <div class="fw-semibold">${esc(account.display_name)}</div>
          <div class="text-secondary small">${esc(account.username)}</div>
        </td>
        <td class="text-capitalize">${esc(account.role)}</td>
        <td>
          <span class="badge ${isActive ? "text-bg-success" : "text-bg-secondary"}">
            ${isActive ? "Active" : "Deactivated"}
          </span>
        </td>
        <td class="text-end text-nowrap">${actions}</td>
      </tr>`;
    })
    .join("");
}

async function loadAccounts() {
  accountRows.innerHTML = `
    <tr>
      <td colspan="4" class="text-center text-secondary py-5">Loading accounts...</td>
    </tr>`;

  try {
    const result = await apiRequest("/api/admin/accounts");
    accounts = result.accounts;
    renderAccounts();
  } catch (error) {
    accountRows.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-danger py-5">${esc(error.message)}</td>
      </tr>`;
  }
}

// Add member -----------------------------------------------------------------
function showAccountFormError(text) {
  accountFormError.textContent = text;
  accountFormError.classList.remove("d-none");
}

document.querySelector("#add-account-button").addEventListener("click", () => {
  accountForm.reset();
  resetPasswordBox("accountPassword");
  accountFormError.classList.add("d-none");
  accountModal.show();
});

accountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  accountFormError.classList.add("d-none");

  const displayName = fieldAccountName.value.trim().replace(/\s+/g, " ");
  const username = fieldAccountUsername.value.trim().toLowerCase();

  if (!displayName) return showAccountFormError("Please enter the member's name.");
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    return showAccountFormError(
      "Username: 3 to 30 lowercase letters, numbers, dots, dashes or underscores (no spaces)."
    );
  }

  const password = document.querySelector("#accountPassword").value;

  if (password.length < 12) {
    return showAccountFormError("The password must be at least 12 characters.");
  }

  accountSaveButton.disabled = true;
  accountSaveButton.textContent = "Creating...";

  try {
    const result = await apiRequest("/api/admin/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, display_name: displayName, password })
    });

    hideThen(accountModal, accountModalEl, () => {
      showCredentials({
        title: "Account created",
        intro: "Give these login details to the new member.",
        name: result.account.display_name,
        username: result.account.username,
        password: result.password
      });
    });
    loadAccounts();
  } catch (error) {
    showAccountFormError(error.message);
  } finally {
    accountSaveButton.disabled = false;
    accountSaveButton.textContent = "Create account";
  }
});

// Reset password / deactivate / reactivate ---------------------------------
function askToConfirm({ title, subject, text, label, danger, run }) {
  document.querySelector("#confirmModalTitle").textContent = title;
  document.querySelector("#confirm-subject").textContent = subject;
  document.querySelector("#confirm-text").textContent = text;

  const button = document.querySelector("#confirm-action");
  button.textContent = label;
  button.className = `btn ${danger ? "btn-danger" : "btn-portal"}`;
  button.disabled = false;

  pendingConfirm = run;
  confirmModal.show();
}

accountRows.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-account-action]");
  if (!button) return;

  const account = accounts.find((a) => a.id === Number(button.dataset.id));
  if (!account) return;

  const subject = `${account.display_name} (${account.username})`;

  if (button.dataset.accountAction === "reset") {
    resetTarget = account;
    resetForm.reset();
    resetPasswordBox("resetPassword");
    resetFormError.classList.add("d-none");
    document.querySelector("#reset-subject").textContent = subject;
    resetModal.show();
  }

  if (button.dataset.accountAction === "toggle") {
    const turnOff = account.is_active === 1;

    askToConfirm({
      title: turnOff ? "Deactivate account?" : "Reactivate account?",
      subject,
      text: turnOff
        ? "They will be signed out right away and cannot log in. Their past uploads and activity stay as they are. You can reactivate the account later."
        : "They will be able to log in again with their current password. If they forgot it, reset it afterwards.",
      label: turnOff ? "Deactivate" : "Reactivate",
      danger: turnOff,
      run: async () => {
        await apiRequest(`/api/admin/accounts/${account.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: turnOff ? 0 : 1 })
        });

        hideThen(confirmModal, confirmModalEl, () => {
          showToast(turnOff ? "Account deactivated." : "Account reactivated.");
        });
        loadAccounts();
      }
    });
  }
});

document.querySelector("#confirm-action").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  if (!pendingConfirm) return;

  button.disabled = true;

  try {
    await pendingConfirm();
  } catch (error) {
    hideThen(confirmModal, confirmModalEl, () => showToast(error.message, "danger"));
  } finally {
    pendingConfirm = null;
  }
});

// Show / Generate buttons next to the password boxes.
function resetPasswordBox(id) {
  const input = document.querySelector(`#${id}`);
  input.type = "password";
  document.querySelector(`[data-password-toggle="${id}"]`).textContent = "Show";
}

document.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-password-toggle]");
  const generate = event.target.closest("[data-password-generate]");

  if (toggle) {
    const input = document.querySelector(`#${toggle.dataset.passwordToggle}`);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    toggle.textContent = show ? "Hide" : "Show";
  }

  if (generate) {
    const id = generate.dataset.passwordGenerate;
    const input = document.querySelector(`#${id}`);
    input.value = randomPassword();
    input.type = "text"; // show it so it can be read out or copied
    document.querySelector(`[data-password-toggle="${id}"]`).textContent = "Hide";
  }
});

// Reset password form
resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetFormError.classList.add("d-none");

  const password = document.querySelector("#resetPassword").value;

  if (!resetTarget) return;

  if (password.length < 12) {
    resetFormError.textContent = "The password must be at least 12 characters.";
    resetFormError.classList.remove("d-none");
    return;
  }

  resetSaveButton.disabled = true;
  resetSaveButton.textContent = "Saving...";

  try {
    const result = await apiRequest(`/api/admin/accounts/${resetTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_password", password })
    });

    hideThen(resetModal, resetModalEl, () => {
      showCredentials({
        title: "Password reset",
        intro: "Give this new password to the member.",
        name: result.account.display_name,
        username: result.account.username,
        password: result.password
      });
    });
  } catch (error) {
    resetFormError.textContent = error.message;
    resetFormError.classList.remove("d-none");
  } finally {
    resetSaveButton.disabled = false;
    resetSaveButton.textContent = "Reset password";
  }
});

// Change my own password (every admin) ----------------------------------------
function showPasswordFormError(text) {
  passwordFormError.textContent = text;
  passwordFormError.classList.remove("d-none");
}

document.querySelector("#change-password-button").addEventListener("click", () => {
  passwordForm.reset();
  passwordFormError.classList.add("d-none");
  passwordModal.show();
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  passwordFormError.classList.add("d-none");

  const current = document.querySelector("#currentPassword").value;
  const next = document.querySelector("#newPassword").value;
  const again = document.querySelector("#confirmPassword").value;

  if (!current) return showPasswordFormError("Please enter your current password.");
  if (next.length < 12) return showPasswordFormError("The new password must be at least 12 characters.");
  if (next !== again) return showPasswordFormError("The two new passwords do not match.");
  if (next === current) return showPasswordFormError("The new password must be different from the current one.");

  passwordSaveButton.disabled = true;
  passwordSaveButton.textContent = "Saving...";

  try {
    await apiRequest("/api/admin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: current, new_password: next })
    });

    passwordForm.reset();
    passwordModal.hide();
    showMessage("Password changed. Taking you to the login page...", "success");
    message.classList.remove("d-none");
    content.classList.add("d-none");
    setTimeout(() => window.location.replace("/admin.html"), 1500);
  } catch (error) {
    showPasswordFormError(error.message);
    passwordSaveButton.disabled = false;
    passwordSaveButton.textContent = "Change password";
  }
});

// First login after the superadmin created the account or reset the password:
// nothing else can be used until the member has chosen their own password.
function requirePasswordChange() {
  content.classList.add("d-none");
  message.classList.remove("d-none");
  showMessage("Please choose your own password to continue.", "warning");

  document.querySelector("#password-forced-note").classList.remove("d-none");
  document.querySelector("#password-close-x").classList.add("d-none");
  document.querySelector("#password-cancel").classList.add("d-none");
  document.querySelector("#change-password-button").classList.add("d-none");

  passwordForm.reset();
  passwordFormError.classList.add("d-none");
  passwordModal.show();
}

// ---------------------------------------------------------------------------
// Session check and logout
// ---------------------------------------------------------------------------
async function checkSession() {
  try {
    const response = await fetch("/api/session", {
      credentials: "same-origin",
      cache: "no-store"
    });

    if (response.status === 401) {
      window.location.replace("/admin.html");
      return;
    }

    const result = await response.json();

    if (!response.ok || !result.success || !result.admin) {
      showMessage("Unable to verify your session. Please try again.", "danger");
      return;
    }

    adminName.textContent = result.admin.displayName;
    adminRole.textContent = result.admin.role;

    isSuperadmin = result.admin.role === "superadmin";
    dashboardTabs
      .querySelectorAll("[data-superadmin-tab]")
      .forEach((item) => item.classList.toggle("d-none", !isSuperadmin));

    // Does this member still have to choose their own password?
    try {
      const profile = await apiRequest("/api/admin/profile");

      if (profile.profile.must_change_password === 1) {
        requirePasswordChange();
        return;
      }
    } catch {
      // If this check fails, the server still blocks everything that is not allowed.
    }

    message.classList.add("d-none");
    content.classList.remove("d-none");
    loadDocuments();
    // SUGGESTIONS-DISABLED: refreshPendingBadge();
  } catch {
    showMessage("Unable to contact the server. Please try again.", "danger");
  }
}

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;

  try {
    const response = await fetch("/api/logout", {
      method: "POST",
      credentials: "same-origin"
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      message.classList.remove("d-none");
      showMessage("Unable to log out. Please try again.", "danger");
      logoutButton.disabled = false;
      return;
    }

    window.location.replace("/admin.html");
  } catch {
    message.classList.remove("d-none");
    showMessage("Unable to contact the server. Please try again.", "danger");
    logoutButton.disabled = false;
  }
});

checkSession();
