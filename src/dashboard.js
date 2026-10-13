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

  if (!response.ok || !data || !data.success) {
    throw new Error(
      (data && data.message) || "Something went wrong. Please try again."
    );
  }

  return data;
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
      <!-- Tabs are only shown to the superadmin (see checkSession). -->
      <ul class="nav nav-pills dashboard-tabs gap-2 mb-4 d-none" id="dashboard-tabs">
        <li class="nav-item">
          <button type="button" class="nav-link active" data-tab="documents">Documents</button>
        </li>
        <li class="nav-item">
          <button type="button" class="nav-link" data-tab="activity">Recent Activity</button>
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

      <div class="row g-3 mb-4" id="summary-cards"></div>

      <div class="document-tools mb-4">
        <div class="row g-3">
          <div class="col-md-5">
            <label for="adminSearch" class="form-label fw-semibold">Search</label>
            <input id="adminSearch" type="search" class="form-control"
                   placeholder="Search by title..." />
          </div>
          <div class="col-md-4">
            <label for="adminCategory" class="form-label fw-semibold">Category</label>
            <select id="adminCategory" class="form-select">
              <option value="all">All Categories</option>
              ${Object.entries(categoryNames)
                .map(([value, name]) => `<option value="${value}">${name}</option>`)
                .join("")}
            </select>
          </div>
          <div class="col-md-3">
            <label for="adminStatus" class="form-label fw-semibold">Status</label>
            <select id="adminStatus" class="form-select">
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="hidden">Hidden</option>
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
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody id="document-rows"></tbody>
          </table>
        </div>
      </div>

      <div class="mt-4" id="docPagination"></div>
      </div>

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
      label: "Categories in use",
      value: new Set(documents.map((d) => d.category)).size
    }
  ];

  summaryCards.innerHTML = cards
    .map(
      (card) => `
      <div class="col-6 col-lg-3">
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
        <td colspan="6" class="text-center text-secondary py-5">
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
        <td colspan="6" class="text-center text-secondary py-5">
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
  delete: { text: "Deleted", badge: "text-bg-danger" }
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

function showTab(name) {
  const showActivity = name === "activity" && isSuperadmin;

  panelDocuments.classList.toggle("d-none", showActivity);
  panelActivity.classList.toggle("d-none", !showActivity);

  dashboardTabs.querySelectorAll("[data-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === (showActivity ? "activity" : "documents"));
  });

  if (showActivity) loadActivity(1);
}

dashboardTabs.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-tab]");
  if (tab) showTab(tab.dataset.tab);
});

document.querySelector("#refresh-activity").addEventListener("click", () => {
  loadActivity(1);
});

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
    dashboardTabs.classList.toggle("d-none", !isSuperadmin);

    message.classList.add("d-none");
    content.classList.remove("d-none");
    loadDocuments();
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
