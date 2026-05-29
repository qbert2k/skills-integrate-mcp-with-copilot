document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupNote = document.getElementById("signup-note");
  const messageDiv = document.getElementById("message");
  const loginForm = document.getElementById("login-form");
  const authStatus = document.getElementById("auth-status");
  const authUser = document.getElementById("auth-user");
  const logoutBtn = document.getElementById("logout-btn");
  const emailInput = document.getElementById("email");

  let auth = null;

  function getAuthHeader() {
    if (!auth?.token) {
      return {};
    }
    return { Authorization: `Bearer ${auth.token}` };
  }

  function setMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
  }

  function clearMessageDelayed() {
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUI() {
    const isLoggedIn = Boolean(auth?.token);
    const isStaff = auth?.role === "staff";

    loginForm.classList.toggle("hidden", isLoggedIn);
    authStatus.classList.toggle("hidden", !isLoggedIn);

    if (isLoggedIn) {
      authUser.textContent = `Logged in as ${auth.username} (${auth.role})`;
      signupForm.querySelector("button[type='submit']").disabled = false;
      signupNote.textContent =
        auth.role === "staff"
          ? "Staff can register any student email."
          : "Students can only register their own email.";
    } else {
      signupForm.querySelector("button[type='submit']").disabled = true;
      signupNote.textContent = "Log in to sign up for activities.";
      emailInput.readOnly = false;
      emailInput.value = "";
      authUser.textContent = "";
    }

    if (isLoggedIn && !isStaff) {
      emailInput.value = auth.email;
      emailInput.readOnly = true;
    }

    if (isLoggedIn && isStaff) {
      emailInput.readOnly = false;
      if (!emailInput.value) {
        emailInput.placeholder = "student-email@mergington.edu";
      }
    }
  }

  async function refreshSession() {
    const token = localStorage.getItem("authToken");
    if (!token) {
      auth = null;
      updateAuthUI();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Session expired");
      }

      const me = await response.json();
      auth = { token, ...me };
      updateAuthUI();
    } catch (error) {
      localStorage.removeItem("authToken");
      auth = null;
      updateAuthUI();
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        auth?.role === "staff"
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      if (auth?.role === "staff") {
        // Delete controls are only rendered for staff users.
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (auth?.role !== "staff") {
      setMessage("Only staff can unregister students.", "error");
      clearMessageDelayed();
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            ...getAuthHeader(),
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
      clearMessageDelayed();
    } catch (error) {
      setMessage("Failed to unregister. Please try again.", "error");
      clearMessageDelayed();
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!auth?.token) {
      setMessage("Please log in first.", "error");
      clearMessageDelayed();
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            ...getAuthHeader(),
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");
        signupForm.reset();
        if (auth?.role === "student") {
          emailInput.value = auth.email;
        }

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
      clearMessageDelayed();
    } catch (error) {
      setMessage("Failed to sign up. Please try again.", "error");
      clearMessageDelayed();
      console.error("Error signing up:", error);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const response = await fetch(
        `/auth/login?username=${encodeURIComponent(
          username
        )}&password=${encodeURIComponent(password)}`,
        {
          method: "POST",
        }
      );
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.detail || "Login failed", "error");
        clearMessageDelayed();
        return;
      }

      auth = result;
      localStorage.setItem("authToken", result.token);
      loginForm.reset();
      updateAuthUI();
      await fetchActivities();
      setMessage(`Logged in as ${result.username}`, "success");
      clearMessageDelayed();
    } catch (error) {
      setMessage("Failed to log in. Please try again.", "error");
      clearMessageDelayed();
      console.error("Error logging in:", error);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      if (auth?.token) {
        await fetch("/auth/logout", {
          method: "POST",
          headers: {
            ...getAuthHeader(),
          },
        });
      }
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      localStorage.removeItem("authToken");
      auth = null;
      updateAuthUI();
      fetchActivities();
      setMessage("Logged out", "success");
      clearMessageDelayed();
    }
  });

  // Initialize app
  refreshSession().finally(fetchActivities);
});
