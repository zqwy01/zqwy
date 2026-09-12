(() => {
    "use strict";

    const overlay = document.querySelector("#siteMenu");
    const openButton = document.querySelector("#menuOpenButton");

    const closeButtons = document.querySelectorAll(
        "#siteMenu [data-menu-close]"
    );

    const searchButton = document.querySelector("#menuSearchButton");
    const searchForm = document.querySelector("#menuSearchForm");
    const searchInput = document.querySelector("#menuSearchInput");

    if (!overlay || !openButton) {
        return;
    }

    let previousFocus = null;
    let previousOverflow = "";

    function openMenu() {
        if (overlay.classList.contains("is-open")) {
            return;
        }

        previousFocus = document.activeElement;
        previousOverflow = document.body.style.overflow;

        overlay.classList.add("is-open");
        overlay.setAttribute("aria-hidden", "false");

        openButton.setAttribute("aria-expanded", "true");

        document.body.classList.add("menu-is-open");
        document.body.style.overflow = "hidden";

        const closeButton = overlay.querySelector(".site-menu-close");

        if (closeButton) {
            closeButton.focus();
        }
    }

    function closeMenu() {
        if (!overlay.classList.contains("is-open")) {
            return;
        }

        overlay.classList.remove("is-open");
        overlay.setAttribute("aria-hidden", "true");

        openButton.setAttribute("aria-expanded", "false");

        document.body.classList.remove("menu-is-open");
        document.body.style.overflow = previousOverflow;

        if (searchForm) {
            searchForm.hidden = true;
            searchForm.reset();
        }

        if (searchInput) {
            searchInput.value = "";
        }

        if (searchButton) {
            searchButton.setAttribute("aria-expanded", "false");
        }

        if (
            previousFocus &&
            typeof previousFocus.focus === "function" &&
            document.contains(previousFocus)
        ) {
            previousFocus.focus();
        } else {
            openButton.focus();
        }

        previousFocus = null;
    }

    openButton.addEventListener("click", () => {
        if (overlay.classList.contains("is-open")) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    closeButtons.forEach((button) => {
        button.addEventListener("click", closeMenu);
    });

    if (searchButton && searchForm && searchInput) {
        searchButton.addEventListener("click", () => {
            const shouldOpen = searchForm.hidden;

            searchForm.hidden = !shouldOpen;

            searchButton.setAttribute(
                "aria-expanded",
                String(shouldOpen)
            );

            if (shouldOpen) {
                searchInput.focus();
            }
        });

        searchForm.addEventListener("submit", (event) => {
            event.preventDefault();

            const query = searchInput.value.trim();

            if (!query) {
                searchInput.focus();
                return;
            }

            console.log("Поисковый запрос:", query);
        });
    }

    document.addEventListener("keydown", (event) => {
        if (
            event.key === "Escape" &&
            overlay.classList.contains("is-open")
        ) {
            closeMenu();
        }
    });
})();
