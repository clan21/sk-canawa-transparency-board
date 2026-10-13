// Numbered page buttons shared by the public page and the dashboard.
//
//   renderPagination(container, { page, totalPages, label, onChange })
//
// Phones get a shorter row (5 slots) so it fits on a small screen;
// larger screens get 7 slots. With one page or fewer, nothing is shown.

const compactQuery =
  typeof window.matchMedia === "function"
    ? window.matchMedia("(max-width: 575.98px)")
    : null;

const containers = new Set();

function range(from, to) {
  const list = [];
  for (let n = from; n <= to; n++) list.push(n);
  return list;
}

export function pageNumbers(page, total, compact) {
  const slots = compact ? 5 : 7;

  if (total <= slots) return range(1, total);

  // Near the start: 1 2 3 … last
  if (page <= slots - 2) return [...range(1, slots - 2), "…", total];

  // Near the end: 1 … n-2 n-1 n
  if (page >= total - (slots - 3)) {
    return [1, "…", ...range(total - (slots - 3), total)];
  }

  // In the middle
  return compact
    ? [1, "…", page, "…", total]
    : [1, "…", page - 1, page, page + 1, "…", total];
}

function draw(container) {
  const state = container._pager;
  if (!state) return;

  const { page, totalPages, label } = state;
  const compact = compactQuery ? compactQuery.matches : false;
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  const items = [];

  items.push(`
    <li class="page-item ${atStart ? "disabled" : ""}">
      <button type="button" class="page-link" data-page="${page - 1}"
              ${atStart ? "disabled" : ""} aria-label="Previous page">
        <span aria-hidden="true">←</span><span class="d-none d-sm-inline"> Prev</span>
      </button>
    </li>`);

  for (const entry of pageNumbers(page, totalPages, compact)) {
    if (entry === "…") {
      items.push(`
        <li class="page-item disabled" aria-hidden="true">
          <span class="page-link">…</span>
        </li>`);
    } else {
      const current = entry === page;
      items.push(`
        <li class="page-item ${current ? "active" : ""}">
          <button type="button" class="page-link" data-page="${entry}"
                  aria-label="Page ${entry}"
                  ${current ? 'aria-current="page"' : ""}>${entry}</button>
        </li>`);
    }
  }

  items.push(`
    <li class="page-item ${atEnd ? "disabled" : ""}">
      <button type="button" class="page-link" data-page="${page + 1}"
              ${atEnd ? "disabled" : ""} aria-label="Next page">
        <span class="d-none d-sm-inline">Next </span><span aria-hidden="true">→</span>
      </button>
    </li>`);

  container.innerHTML = `
    <nav aria-label="${label}">
      <ul class="pagination portal-pagination justify-content-center flex-wrap mb-0">
        ${items.join("")}
      </ul>
      <p class="text-center text-secondary small mt-2 mb-0">
        Page ${page} of ${totalPages}
      </p>
    </nav>`;
}

export function renderPagination(
  container,
  { page, totalPages, onChange, label = "Pages" }
) {
  if (totalPages <= 1) {
    container.innerHTML = "";
    container._pager = null;
    containers.delete(container);
    return;
  }

  container._pager = { page, totalPages, onChange, label };
  containers.add(container);

  if (!container._pagerBound) {
    container._pagerBound = true;

    container.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-page]");
      if (!button || button.disabled || !container._pager) return;

      const next = Number(button.dataset.page);

      if (next >= 1 && next <= container._pager.totalPages && next !== container._pager.page) {
        container._pager.onChange(next);
      }
    });
  }

  draw(container);
}

// Redraw when the screen crosses the phone breakpoint (e.g. rotating a phone).
if (compactQuery && typeof compactQuery.addEventListener === "function") {
  compactQuery.addEventListener("change", () => {
    containers.forEach(draw);
  });
}
