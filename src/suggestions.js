// "Let your voice be heard": the card on the home page, the suggestion form
// and the list of approved suggestions. Everything a visitor types is shown
// as plain text (escaped), never as HTML.
import "./suggestions.css";
import bootstrap from "bootstrap/dist/js/bootstrap.bundle.min.js";
import { renderPagination } from "./pagination.js";

const { Modal } = bootstrap;

const MAX_WORDS = 500;
const MIN_WORDS = 3;
const ANONYMOUS = "Anonymous";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// The database stores UTC times; show the date in the visitor's own time zone.
function formatDate(value) {
  const date = new Date(`${String(value).replace(" ", "T")}Z`);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

// The card, to be placed on the home page.
export const suggestionsSection = `
  <section class="py-5" id="suggestions">
    <div class="container">
      <div class="voice-card">
        <div class="voice-icon" aria-hidden="true">&#128227;</div>
        <div>
          <span class="section-eyebrow">YOUR IDEAS MATTER</span>
          <h2 class="fw-bold mt-2">Let your voice be heard</h2>
          <p class="text-secondary mb-3">Share your project ideas with us.</p>

          <div class="d-flex flex-wrap align-items-center gap-3">
            <button type="button" class="btn btn-portal btn-lg" id="openSuggestionForm">
              Add a suggestion
            </button>
            <button type="button" class="btn btn-link voice-link p-0" id="openSuggestionList">
              See public suggested projects here <span aria-hidden="true">&rarr;</span>
            </button>
          </div>

          <p class="small text-secondary mt-3 mb-0">
            Suggestions are checked by the SK before they are posted.
            No account is needed.
          </p>
        </div>
      </div>
    </div>
  </section>`;

const modalsHtml = `
  <div class="modal fade" id="suggestionModal" tabindex="-1" aria-labelledby="suggestionModalTitle" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title h5" id="suggestionModalTitle">Add a suggestion</h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>

        <form id="suggestion-form" novalidate>
          <div class="modal-body">
            <div id="suggestion-error" class="alert alert-danger d-none" role="alert"></div>

            <div class="mb-3">
              <label for="suggestionName" class="form-label fw-semibold">
                Name (or leave as "Anonymous" to stay anonymous)
              </label>
              <input id="suggestionName" class="form-control" maxlength="60"
                     value="${ANONYMOUS}" autocomplete="name" />
            </div>

            <div class="mb-2">
              <label for="suggestionMessage" class="form-label fw-semibold">
                Your project idea
              </label>
              <textarea id="suggestionMessage" class="form-control" rows="7"
                        placeholder="What project or program should the SK consider, and how would it help the community?"></textarea>
              <div class="d-flex justify-content-between mt-1">
                <span class="form-text m-0">Up to ${MAX_WORDS} words.</span>
                <span class="word-counter text-secondary" id="suggestionCounter" aria-live="polite">
                  0 / ${MAX_WORDS} words
                </span>
              </div>
            </div>

            <!-- Hidden trap for spam robots. Real visitors never see it. -->
            <div class="suggestion-trap" aria-hidden="true">
              <label for="suggestionWebsite">Leave this empty</label>
              <input id="suggestionWebsite" tabindex="-1" autocomplete="off" />
            </div>

            <p class="small text-secondary mb-0">
              Please keep it respectful and about SK projects or programs.
              Do not include phone numbers, addresses or web links. Your
              suggestion appears on this page only after the SK has checked it.
            </p>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-portal" id="suggestionSubmit">Submit</button>
          </div>
        </form>

        <div id="suggestion-thanks" class="d-none">
          <div class="modal-body text-center py-5">
            <div class="display-5 mb-3" aria-hidden="true">&#127881;</div>
            <h3 class="h5 fw-bold">Thank you!</h3>
            <p class="text-secondary mb-0">
              Your suggestion was received. It will be posted here once the
              SK has checked it.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-portal" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="modal fade" id="suggestionListModal" tabindex="-1" aria-labelledby="suggestionListTitle" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title h5" id="suggestionListTitle">Suggested projects</h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div id="suggestion-list" aria-live="polite"></div>
          <div class="mt-3" id="suggestionPagination"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
          <button type="button" class="btn btn-portal" id="listAddSuggestion">Add a suggestion</button>
        </div>
      </div>
    </div>
  </div>`;

// Hide one modal and only then run the next step.
function hideThen(modal, element, next) {
  if (!element.classList.contains("show")) return next();

  element.addEventListener("hidden.bs.modal", next, { once: true });
  modal.hide();
}

export function initSuggestions() {
  document.body.insertAdjacentHTML("beforeend", modalsHtml);

  const formEl = document.querySelector("#suggestionModal");
  const listEl = document.querySelector("#suggestionListModal");
  const formModal = new Modal(formEl);
  const listModal = new Modal(listEl);

  const form = document.querySelector("#suggestion-form");
  const thanks = document.querySelector("#suggestion-thanks");
  const errorBox = document.querySelector("#suggestion-error");
  const nameInput = document.querySelector("#suggestionName");
  const messageInput = document.querySelector("#suggestionMessage");
  const trap = document.querySelector("#suggestionWebsite");
  const counter = document.querySelector("#suggestionCounter");
  const submitButton = document.querySelector("#suggestionSubmit");
  const list = document.querySelector("#suggestion-list");
  const pagination = document.querySelector("#suggestionPagination");

  // --- the form --------------------------------------------------------------
  function updateCounter() {
    const words = countWords(messageInput.value);
    counter.textContent = `${words} / ${MAX_WORDS} words`;
    counter.classList.toggle("over-limit", words > MAX_WORDS);
  }

  function showError(text) {
    errorBox.textContent = text;
    errorBox.classList.remove("d-none");
  }

  function openForm() {
    form.reset();
    nameInput.value = ANONYMOUS;
    trap.value = "";
    errorBox.classList.add("d-none");
    form.classList.remove("d-none");
    thanks.classList.add("d-none");
    submitButton.disabled = false;
    submitButton.textContent = "Submit";
    updateCounter();
    formModal.show();
  }

  // Typing a name replaces "Anonymous" without having to delete it first.
  nameInput.addEventListener("focus", () => {
    if (nameInput.value === ANONYMOUS) nameInput.select();
  });

  nameInput.addEventListener("blur", () => {
    if (!nameInput.value.trim()) nameInput.value = ANONYMOUS;
  });

  messageInput.addEventListener("input", updateCounter);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.classList.add("d-none");

    const message = messageInput.value.trim();
    const words = countWords(message);

    if (words < MIN_WORDS) {
      return showError("Please write a little more so we understand your idea.");
    }

    if (words > MAX_WORDS) {
      return showError(
        `Your suggestion is ${words} words. The limit is ${MAX_WORDS} words.`
      );
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending...";

    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameInput.value.trim(),
          message,
          website: trap.value
        })
      });

      let data = null;

      try {
        data = await response.json();
      } catch {
        // Not JSON; handled below.
      }

      if (!response.ok || !data || !data.success) {
        showError(
          (data && data.message) ||
            "We could not send your suggestion. Please try again."
        );
        submitButton.disabled = false;
        submitButton.textContent = "Submit";
        return;
      }

      form.classList.add("d-none");
      thanks.classList.remove("d-none");
    } catch {
      showError("Unable to contact the server. Please try again.");
      submitButton.disabled = false;
      submitButton.textContent = "Submit";
    }
  });

  // --- the public list -------------------------------------------------------
  async function loadList(page = 1) {
    pagination.innerHTML = "";
    list.innerHTML = `<p class="text-center text-secondary py-4 mb-0">Loading suggestions...</p>`;

    try {
      const response = await fetch(`/api/suggestions?page=${page}`, {
        cache: "no-store"
      });
      const data = await response.json();

      if (!response.ok || !data.success) throw new Error("failed");

      const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

      if (page > totalPages) return loadList(totalPages);

      if (data.suggestions.length === 0) {
        list.innerHTML = `
          <div class="text-center py-4">
            <p class="fw-semibold mb-1">No suggestions have been posted yet.</p>
            <p class="text-secondary mb-0">Be the first to share an idea!</p>
          </div>`;
        return;
      }

      list.innerHTML = data.suggestions
        .map(
          (item) => `
          <article class="suggestion-item">
            <div class="d-flex flex-wrap justify-content-between gap-1">
              <strong>${esc(item.name)}</strong>
              <span class="text-secondary small">${esc(formatDate(item.created_at))}</span>
            </div>
            <p class="suggestion-text">${esc(item.message)}</p>
          </article>`
        )
        .join("");

      renderPagination(pagination, {
        page,
        totalPages,
        label: "Suggestion pages",
        onChange: (next) => {
          loadList(next);
          listEl.querySelector(".modal-body").scrollTop = 0;
        }
      });
    } catch {
      list.innerHTML = `<p class="text-center text-danger py-4 mb-0">Unable to load suggestions right now. Please try again later.</p>`;
    }
  }

  function openList() {
    listModal.show();
    loadList(1);
  }

  // --- buttons -----------------------------------------------------------------
  document.querySelector("#openSuggestionForm").addEventListener("click", openForm);
  document.querySelector("#openSuggestionList").addEventListener("click", openList);
  document.querySelector("#listAddSuggestion").addEventListener("click", () => {
    hideThen(listModal, listEl, openForm);
  });
}
