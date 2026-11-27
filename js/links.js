

// built a link js to help hyperlinking become easier
const SITE_LINKS = {
  login:    "login.html", // login page (Tara)
  home:    "", //home page
  live:       "",          // live announcements (Joshua)
  missed:     "",         // missed announcements (Mina)
  settings:   "settings.html",       // settings (Tara)
  report:     "report-error.html",   // report an error (Dae)
  navigation: ""                     // navigation (Dae) 
};

// goes through the page and gives every data-link the right address
function connectLinks() {
  document.querySelectorAll("[data-link]").forEach((element) => {
    const page = SITE_LINKS[element.dataset.link];

    // no address yet, so leave it as it is
    if (!page) return;

    // buttons (like the navigation icon) get turned into links once the page exists
    if (element.tagName === "BUTTON") {
      element.removeAttribute("aria-disabled");
      element.classList.remove("is-placeholder");
      const soon = element.querySelector(".soon");
      if (soon) soon.remove();
      element.addEventListener("click", () => (window.location.href = page));
      return;
    }

    element.href = page;

    // underlines/highlights the link for the page you're on right now
    const here = window.location.pathname.split("/").pop() || "index.html";
    if (here === page) element.setAttribute("aria-current", "page");
  });
}

connectLinks();

