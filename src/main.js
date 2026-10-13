
import 'bootstrap/dist/css/bootstrap.min.css';
import './style.css';
import './documents.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { renderPagination } from './pagination.js';

// Documents are loaded from the server (GET /api/documents).
let documents = [];
let loadState = 'loading'; // 'loading' | 'ready' | 'error'

// Documents per page. Fewer on small screens so phones scroll less:
// 4 on phones, 6 on tablets (2 columns), 8 on large screens (4 columns).
function getPageSize() {
  if (window.innerWidth >= 1200) return 8;
  if (window.innerWidth >= 768) return 6;
  return 4;
}

let pageSize = getPageSize();
let currentPage = 1;

const categoryNames = {
  budget: 'Annual Budget',
  expenses: 'Expenses & Financial Reports',
  projects: 'Projects & Programs',
  accomplishments: 'Accomplishment Reports'
};


const categoryIcons = {
  budget: '💰',
  expenses: '📊',
  projects: '🏗️',
  accomplishments: '🏆'
};

const fileTypeNames = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG'
};

// Always escape text from the server before putting it inside innerHTML.
const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDate = (dateString) => {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(
    'en-PH',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }
  );
};

const formatSize = (bytes) => {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

document.querySelector('#app').innerHTML = `
  <nav class="navbar navbar-expand-lg navbar-dark portal-navbar">
    <div class="container">
    <a class="navbar-brand fw-bold d-flex align-items-center gap-2" href="#home">
      <img
        src="/images/sk-logo.jpg"
        alt="SK Canawa logo"
        class="sk-logo"
      />
      <span>
        SK Canawa
      <span class="brand-accent">Transparency Board</span>
      </span>
    </a>

      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#mainNavigation"
        aria-controls="mainNavigation"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse" id="mainNavigation">
        <ul class="navbar-nav ms-auto align-items-lg-center gap-lg-2">
          <li class="nav-item">
            <a class="nav-link active" href="#home">Home</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#documents">Documents</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#documents" data-category="projects">
              Projects
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="#about">About</a>
          </li>
        </ul>
      </div>
    </div>
  </nav>

  <main>
    <section class="hero-section" id="home">
      <div class="container py-5">
        <div class="row align-items-center g-4 py-lg-4">
          <div class="col-lg-7">
            <span class="portal-label">
              PUBLIC INFORMATION PORTAL
            </span>

            <h1 class="display-4 fw-bold mt-3">
              Transparency builds
              <span class="text-accent">public trust.</span>
            </h1>

            <p class="hero-description mt-3">
              Access public SK Canawa documents, financial reports,
              project updates, and accomplishment reports in one place.
            </p>

            <a href="#documents" class="btn btn-portal btn-lg mt-3">
              Browse Documents
            </a>

            <p class="small mt-3 text-secondary">
              Public information, accessible to everyone.
            </p>
          </div>

          <div class="col-lg-5">
            <figure class="hero-photo-card mb-0">
              <img
                src="/images/sk-council-1200.jpg"
                srcset="/images/sk-council-600.jpg 600w, /images/sk-council-1200.jpg 1200w"
                sizes="(min-width: 992px) 40vw, 100vw"
                width="1200"
                height="901"
                alt="Members of the SK Canawa council standing together on the barangay stage"
                class="hero-photo"
                fetchpriority="high"
              />
              <figcaption class="hero-photo-caption">
                <div>
                  <strong class="d-block">Your SK. Your Information.</strong>
                  <span class="text-secondary small">
                    Sangguniang Kabataan of Barangay Canawa
                  </span>
                </div>
                <div class="text-end">
                  <span class="d-block fw-bold fs-5 lh-1" id="publishedCount">&ndash;</span>
                  <span class="text-secondary small">documents</span>
                </div>
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>


<section class="py-5" id="categories">
  <div class="container">
    <div class="section-heading mb-4">
      <span class="section-eyebrow">BROWSE BY CATEGORY</span>
      <h2 class="fw-bold mt-2">Explore Our Records</h2>
      <p class="text-secondary mb-0">
        Find public documents based on their type.
      </p>
    </div>

    <div class="row g-4">
      <div class="col-md-6 col-xl-3">
        <a href="#documents" class="category-card" data-category="budget">
          <div class="category-icon">💰</div>
          <h3 class="h5 fw-bold mt-3">Annual Budget</h3>
          <p class="text-secondary mb-0">
            Budget plans and allocations.
          </p>
          <span class="category-link">Browse documents →</span>
        </a>
      </div>

      <div class="col-md-6 col-xl-3">
        <a href="#documents" class="category-card" data-category="expenses">
          <div class="category-icon">📊</div>
          <h3 class="h5 fw-bold mt-3">Expenses & Reports</h3>
          <p class="text-secondary mb-0">
            Financial statements and expense reports.
          </p>
          <span class="category-link">Browse documents →</span>
        </a>
      </div>

      <div class="col-md-6 col-xl-3">
        <a href="#documents" class="category-card" data-category="projects">
          <div class="category-icon">🏗️</div>
          <h3 class="h5 fw-bold mt-3">Projects & Programs</h3>
          <p class="text-secondary mb-0">
            Community projects and program reports.
          </p>
          <span class="category-link">Browse documents →</span>
        </a>
      </div>

      <div class="col-md-6 col-xl-3">
        <a href="#documents" class="category-card" data-category="accomplishments">
          <div class="category-icon">🏆</div>
          <h3 class="h5 fw-bold mt-3">Accomplishments</h3>
          <p class="text-secondary mb-0">
            Reports on completed activities and achievements.
          </p>
          <span class="category-link">Browse documents →</span>
        </a>
      </div>
    </div>
  </div>
</section>


    <section class="py-5" id="documents">
      <div class="container">
        <div class="section-heading mb-4">
          <span class="section-eyebrow">DOCUMENT CENTER</span>
          <h2 class="fw-bold mt-2">Public Documents</h2>
          <p class="text-secondary mb-0">
            Search and browse documents by category.
          </p>
        </div>

        <div class="document-tools">
          <div class="row g-3">
            <div class="col-lg-5">
              <label for="documentSearch" class="form-label fw-semibold">
                Search documents
              </label>
              <input
                type="search"
                class="form-control form-control-lg"
                id="documentSearch"
                placeholder="Search by document title..."
              />
            </div>

            <div class="col-lg-4">
              <label for="categoryFilter" class="form-label fw-semibold">
                Filter by category
              </label>
              <select
                class="form-select form-select-lg"
                id="categoryFilter"
              >
                <option value="all">All Categories</option>
                <option value="budget">Annual Budget</option>
                <option value="expenses">Expenses & Financial Reports</option>
                <option value="projects">Projects & Programs</option>
                <option value="accomplishments">Accomplishment Reports</option>
              </select>
            </div>

            <div class="col-lg-3">
              <label for="yearFilter" class="form-label fw-semibold">
                Year
              </label>
              <select
                class="form-select form-select-lg"
                id="yearFilter"
              >
                <option value="all">All Years</option>
              </select>
            </div>
          </div>
        </div>

        <div class="my-4">
          <p class="mb-0 text-secondary" id="resultsCount" aria-live="polite"></p>
        </div>

        <div class="row g-4" id="documentList"></div>

        <div class="mt-5" id="documentPagination"></div>
      </div>
    </section>

    <section class="about-section py-5" id="about">
      <div class="container">
        <div class="row g-4 align-items-center">
          <div class="col-lg-8">
            <span class="section-eyebrow">ABOUT THIS PORTAL</span>
            <h2 class="fw-bold mt-2">Information for everyone</h2>
            <p class="text-secondary mb-0">
              The SK Canawa Transparency Board is intended to provide
              convenient public access to official documents published
              by the Sangguniang Kabataan.
            </p>
          </div>

          <div class="col-lg-4">
            <div class="about-highlight">
              <h3 class="h5 fw-bold">Our commitment</h3>
              <p class="mb-0">
                Clear information, accessible records, and responsible
                public service.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer py-4">
    <div class="container d-flex flex-column flex-md-row justify-content-between gap-2">
      <p class="mb-0">
        &copy; ${new Date().getFullYear()} SK Canawa Transparency Board
      </p>
      <p class="mb-0">Public information and transparency</p>
    </div>
  </footer>
`;

function getFilteredDocuments() {
  const searchTerm = document.querySelector('#documentSearch').value.trim().toLowerCase();
  const selectedCategory = document.querySelector('#categoryFilter').value;
  const selectedYear = document.querySelector('#yearFilter').value;

  return documents.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm);
    const matchesCategory =
      selectedCategory === 'all' || doc.category === selectedCategory;
    const matchesYear =
      selectedYear === 'all' || doc.publication_date.startsWith(selectedYear);

    return matchesSearch && matchesCategory && matchesYear;
  });
}

// Shows the "Read more" button only on descriptions that are actually cut off.
function updateReadMoreButtons() {
  document.querySelectorAll('.doc-description:not(.expanded)').forEach((text) => {
    const button = text.nextElementSibling;

    if (button && button.matches('.read-more-button')) {
      button.classList.toggle('d-none', text.scrollHeight <= text.clientHeight + 1);
    }
  });
}

function renderDocuments() {
  const documentList = document.querySelector('#documentList');
  const resultsCount = document.querySelector('#resultsCount');
  const publishedCount = document.querySelector('#publishedCount');
  const pagination = document.querySelector('#documentPagination');

  pagination.innerHTML = '';

  if (loadState === 'loading') {
    resultsCount.textContent = '';
    documentList.innerHTML = `
      <div class="col-12">
        <div class="empty-state">
          <p class="text-secondary mb-0">Loading documents...</p>
        </div>
      </div>
    `;
    return;
  }

  if (loadState === 'error') {
    resultsCount.textContent = '';
    publishedCount.textContent = '–';
    documentList.innerHTML = `
      <div class="col-12">
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3 class="h5 fw-bold mt-3">Unable to load documents</h3>
          <p class="text-secondary mb-0">
            Please check your connection and refresh the page.
          </p>
        </div>
      </div>
    `;
    return;
  }

  publishedCount.textContent = documents.length;

  const filteredDocuments = getFilteredDocuments();
  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);

  const start = (currentPage - 1) * pageSize;
  const shownDocuments = filteredDocuments.slice(start, start + pageSize);

  resultsCount.textContent =
    filteredDocuments.length === 0
      ? '0 documents found'
      : `Showing ${start + 1}–${start + shownDocuments.length} of ${filteredDocuments.length} document(s)`;

  if (filteredDocuments.length === 0) {
    const noDocumentsYet = documents.length === 0;

    documentList.innerHTML = `
      <div class="col-12">
        <div class="empty-state">
          <div class="empty-state-icon">${noDocumentsYet ? '📄' : '🔎'}</div>
          <h3 class="h5 fw-bold mt-3">
            ${noDocumentsYet ? 'No documents published yet' : 'No documents found'}
          </h3>
          <p class="text-secondary mb-0">
            ${
              noDocumentsYet
                ? 'Please check back soon.'
                : 'Try another search term or choose a different category or year.'
            }
          </p>
        </div>
      </div>
    `;
    return;
  }

  documentList.innerHTML = shownDocuments.map((doc) => `
    <div class="col-md-6 col-xl-3">
      <article class="document-card h-100">
        <div class="document-card-top">
          <span class="document-icon" aria-hidden="true">
            ${categoryIcons[doc.category] || '📄'}
          </span>
          <span class="document-category">
            ${esc(categoryNames[doc.category])}
          </span>
        </div>

        <h3 class="h5 fw-bold mt-3">${esc(doc.title)}</h3>

        <p class="text-secondary small mb-2 doc-description" id="description-${doc.id}">${esc(doc.description)}</p>
        <button
          type="button"
          class="read-more-button d-none"
          data-read-more="description-${doc.id}"
          aria-expanded="false"
          aria-controls="description-${doc.id}"
        >
          Read more
        </button>

        <div class="document-date mt-auto">
          <span class="text-secondary small">Published</span>
          <span class="fw-semibold small">${esc(formatDate(doc.publication_date))}</span>
          <span class="text-secondary small">
            ${esc(fileTypeNames[doc.mime_type] || 'File')} &middot; ${esc(formatSize(doc.file_size))}
          </span>
        </div>

        <div class="d-flex gap-2 mt-3">
          <a
            class="btn btn-success flex-fill"
            href="/api/documents/${doc.id}/file"
            target="_blank"
            rel="noopener"
            aria-label="View ${esc(doc.title)}"
          >
            View
          </a>
          <a
            class="btn btn-outline-success flex-fill"
            href="/api/documents/${doc.id}/file?download=1"
            aria-label="Download ${esc(doc.title)}"
          >
            Download
          </a>
        </div>
      </article>
    </div>
  `).join('');

  renderPagination(pagination, {
    page: currentPage,
    totalPages,
    label: 'Document pages',
    onChange: goToPage
  });

  updateReadMoreButtons();
}

// Used by the numbered page buttons. Scrolls back to the top of the list,
// so someone who tapped "Next" at the bottom is not left looking at the end.
function goToPage(page) {
  currentPage = page;
  renderDocuments();

  const section = document.querySelector('#documents');
  if (section && typeof section.scrollIntoView === 'function') {
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    section.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  }
}

function populateYearFilter() {
  const years = [...new Set(documents.map((doc) => doc.publication_date.slice(0, 4)))]
    .sort()
    .reverse();

  document.querySelector('#yearFilter').innerHTML =
    '<option value="all">All Years</option>' +
    years.map((year) => `<option value="${esc(year)}">${esc(year)}</option>`).join('');
}


async function loadDocuments() {
  try {
    const response = await fetch('/api/documents', { cache: 'no-store' });
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error('Request failed');
    }

    documents = result.documents;
    loadState = 'ready';
    populateYearFilter();
  } catch {
    loadState = 'error';
  }

  renderDocuments();
}

// Any change to the search or filters starts again from page 1.
function showFirstPage() {
  currentPage = 1;
  renderDocuments();
}

document.querySelector('#documentSearch')
  .addEventListener('input', showFirstPage);

document.querySelector('#categoryFilter')
  .addEventListener('change', showFirstPage);

document.querySelector('#yearFilter')
  .addEventListener('change', showFirstPage);

// "Read more" / "Show less" on a card's description.
document.querySelector('#documentList')
  .addEventListener('click', (event) => {
    const button = event.target.closest('[data-read-more]');
    if (!button) return;

    const text = document.getElementById(button.dataset.readMore);
    const expanded = text.classList.toggle('expanded');

    button.textContent = expanded ? 'Show less' : 'Read more';
    button.setAttribute('aria-expanded', String(expanded));
  });

// When the window size changes: use the right number of documents per page
// (keeping the same first document in view) and re-check which
// descriptions are cut off.
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);

  resizeTimer = setTimeout(() => {
    const nextSize = getPageSize();

    if (nextSize !== pageSize) {
      const firstIndex = (currentPage - 1) * pageSize;
      pageSize = nextSize;
      currentPage = Math.floor(firstIndex / pageSize) + 1;
      renderDocuments();
    } else {
      updateReadMoreButtons();
    }
  }, 150);
});

// Let navigation links select a document category.
document.querySelectorAll('[data-category]').forEach((link) => {
  link.addEventListener('click', () => {
    document.querySelector('#categoryFilter').value = link.dataset.category;
    showFirstPage();
  });
});

renderDocuments();
loadDocuments();
