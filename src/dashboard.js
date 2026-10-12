import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "./style.css";

const app = document.querySelector("#app");

app.innerHTML = `
  <main class="container py-5">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h1 class="h3 mb-1">Admin Dashboard</h1>
        <p class="text-secondary mb-0">
          SK Canawa Transparency Board
        </p>
      </div>

      <button id="logout-button" class="btn btn-outline-danger">
        Log Out
      </button>
    </div>

    <div id="dashboard-message" class="alert" role="status">
      Checking your session...
    </div>

    <section id="dashboard-content" class="d-none">
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <h2 class="h5">Welcome, <span id="admin-name"></span></h2>
          <p class="text-secondary mb-0">
            Your authenticated dashboard is ready for the next development step.
          </p>
        </div>
      </div>
    </section>
  </main>
`;

const message = document.querySelector("#dashboard-message");
const content = document.querySelector("#dashboard-content");
const adminName = document.querySelector("#admin-name");
const logoutButton = document.querySelector("#logout-button");

function showMessage(text, type = "info") {
  message.textContent = text;
  message.className = `alert alert-${type}`;
}

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
    content.classList.remove("d-none");
    message.classList.add("d-none");
  } catch {
    showMessage("Unable to contact the server. Please try again.", "danger");
  }
}

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  showMessage("Logging out...");

  try {
    const response = await fetch("/api/logout", {
      method: "POST",
      credentials: "same-origin"
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      showMessage("Unable to log out. Please try again.", "danger");
      logoutButton.disabled = false;
      return;
    }

    window.location.replace("/admin.html");
  } catch {
    showMessage("Unable to contact the server. Please try again.", "danger");
    logoutButton.disabled = false;
  }
});

checkSession();