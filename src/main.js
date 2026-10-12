
import 'bootstrap/dist/css/bootstrap.min.css';
import './style.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

// Temporary sample data for the document library.
// These are examples, not actual SK Canawa documents.
const documents = [
  {
    id: 1,
    title: 'Annual Barangay Budget 2026',
    category: 'budget',
    date: '2026-01-15',
    description: 'Sample entry for the annual budget document.',
    filename: null
  },
  {
    id: 2,
    title: 'SK Financial Report - First Quarter',
    category: 'expenses',
    date: '2026-04-10',
    description: 'Sample entry for a quarterly financial report.',
    filename: null
  },
  {
    id: 3,
    title: 'Community Clean-Up Project',
    category: 'projects',
    date: '2026-05-20',
    description: 'Sample entry for a project report.',
    filename: null
  },
  {
    id: 4,
    title: 'SK Accomplishment Report 2025',
    category: 'accomplishments',
    date: '2026-01-05',
    description: 'Sample entry for an accomplishment report.',
    filename: null
  }
];

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
          <li class="nav-item">
            <a class="btn btn-light admin-nav-button" href="#admin">
              Admin Login
            </a>
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
            <div class="hero-card">
              <div class="hero-icon">₱</div>
              <h2 class="h4 fw-bold mt-3">Your SK. Your Information.</h2>
              <p class="mb-0 text-secondary">
                A central place for residents to review published
                documents and learn about community programs.
              </p>

              <div class="hero-divider"></div>

              <div class="d-flex justify-content-between">
                <span class="text-secondary">Portal status</span>
                <span class="status-text">
                  <span class="status-dot"></span>
                  Under development
                </span>
              </div>
            </div>
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
            <div class="col-lg-7">
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

            <div class="col-lg-5">
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
          </div>
        </div>

        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 my-4">
          <p class="mb-0 text-secondary" id="resultsCount" aria-live="polite"></p>
          <span class="sample-data-note">
            Preview mode — sample entries only
          </span>
        </div>

        <div class="row g-4" id="documentList"></div>
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

function renderDocuments() {
  const searchInput = document.querySelector('#documentSearch');
  const categoryFilter = document.querySelector('#categoryFilter');
  const documentList = document.querySelector('#documentList');
  const resultsCount = document.querySelector('#resultsCount');

  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;

  const filteredDocuments = documents
    .filter((document) => {
      const matchesSearch = document.title.toLowerCase().includes(searchTerm);
      const matchesCategory =
        selectedCategory === 'all' ||
        document.category === selectedCategory;

      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  resultsCount.textContent =
    `${filteredDocuments.length} sample document(s) found`;

  if (filteredDocuments.length === 0) {
    documentList.innerHTML = `
      <div class="col-12">
        <div class="empty-state">
          <div class="empty-state-icon">🔎</div>
          <h3 class="h5 fw-bold mt-3">No documents found</h3>
          <p class="text-secondary mb-0">
            Try another search term or choose a different category.
          </p>
        </div>
      </div>
    `;
    return;
  }

  documentList.innerHTML = filteredDocuments.map((document) => `
    <div class="col-md-6 col-xl-3">
      <article class="document-card h-100">
        <div class="document-card-top">
          <span class="document-icon" aria-hidden="true">
            ${categoryIcons[document.category] || '📄'}
          </span>
          <span class="document-category">
            ${categoryNames[document.category]}
          </span>
        </div>

        <h3 class="h5 fw-bold mt-3">${document.title}</h3>

        <p class="text-secondary small">
          ${document.description}
        </p>

        <div class="document-date mt-auto">
          <span class="text-secondary small">Sample publication date</span>
          <span class="fw-semibold small">${formatDate(document.date)}</span>
        </div>

        <button
          class="btn btn-outline-success w-100 mt-3"
          type="button"
          disabled
          aria-label="Download unavailable for sample document ${document.title}"
        >
          Sample Only — No File
        </button>
      </article>
    </div>
  `).join('');
}


document.querySelector('#documentSearch')
  .addEventListener('input', renderDocuments);

document.querySelector('#categoryFilter')
  .addEventListener('change', renderDocuments);

// Let navigation links select a document category.
document.querySelectorAll('[data-category]').forEach((link) => {
  link.addEventListener('click', () => {
    const categoryFilter = document.querySelector('#categoryFilter');

    categoryFilter.value = link.dataset.category;
    renderDocuments();
  });
});

renderDocuments();
