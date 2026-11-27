const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorEL = document.getElementById("error");

function showError(message) {
    errorEL.textContent = message;
    errorEL.hidden = false;
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEL.hidden = true;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showError("Please enter your email and password.");
        return;
    }

    // demo account for Sprint 1 only - remove when the back-end is ready
    if (email === "laz@laz.com" && password === "Laz12345") {
        window.location.href = "index.html";
        return;
    }

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            showError(data.message || "Login failed.");
            return;
        }

        // logged in, go to the home page
        window.location.href = "index.html";
    } catch (error) {
        showError("Unable to connect to the server.");
    }
});
