import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "./style.css";

const app = document.querySelector("#app");

document.title = "Admin Login | SK Canawa Transparency Board";

app.innerHTML = `
  <main class="container py-5">
    <div class="row justify-content-center">
      <div class="col-12 col-md-7 col-lg-5">
        <div class="card shadow-sm border-0">
          <div class="card-body p-4 p-md-5">
            <h1 class="h3 text-center mb-2">
              Admin Login
            </h1>

            <p class="text-secondary text-center mb-4">
              SK Canawa Transparency Board
            </p>

            <div
              id="login-message"
              class="alert d-none"
              role="alert"
            ></div>

            <form id="login-form">
              <div class="mb-3">
                <label for="username" class="form-label">
                  Username
                </label>

                <input
                  id="username"
                  name="username"
                  type="text"
                  class="form-control"
                  autocomplete="username"
                  maxlength="100"
                  required
                />
              </div>

              <div class="mb-4">
                <label for="password" class="form-label">
                  Password
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  class="form-control"
                  autocomplete="current-password"
                  maxlength="1024"
                  required
                />
              </div>

              <button
                id="login-button"
                type="submit"
                class="btn btn-primary w-100"
              >
                Log In
              </button>
            </form>

            <div class="text-center mt-4">
              <a href="/" class="text-decoration-none">
                Return to public transparency board
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
`;

const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const loginButton = document.querySelector("#login-button");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  loginMessage.className = "alert d-none";
  loginMessage.textContent = "";

  loginButton.disabled = true;
  loginButton.textContent = "Signing in...";

  const formData = new FormData(loginForm);

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password")
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      loginMessage.textContent =
        result.message || "Unable to log in.";
      loginMessage.className = "alert alert-danger";
      return;
    }

    window.location.replace("/dashboard.html");
return;
  } catch (error) {
    loginMessage.textContent =
      "Unable to contact the server. Please try again.";
    loginMessage.className = "alert alert-danger";
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Log In";
  }
});