(() => {
    "use strict";

    /*
     * Внешний overlay меню
     */
    const siteMenu = document.querySelector(
        "#siteMenu"
    );

    /*
     * Внутренняя панель меню.
     * Именно сюда переносится логотип и поиск.
     */
    const menuPanel = document.querySelector(
        "#siteMenu .site-menu"
    );

    const menuOpenButton = document.querySelector(
        "#menuOpenButton"
    );

    const menuButtonContainer = document.querySelector(
        "#menuButtonContainer"
    );

    const menuInlineSearch = document.querySelector(
        "#menuInlineSearch"
    );

    const searchInput = document.querySelector(
        "#menuInlineSearchInput"
    );

    if (
        !siteMenu ||
        !menuPanel ||
        !menuOpenButton ||
        !menuButtonContainer
    ) {
        return;
    }

    const menuCloseButtons =
    siteMenu.querySelectorAll(
        "[data-menu-close]"
    );

    const menuHeader = menuPanel.querySelector(
        ".site-menu-header"
    );

    /*
     * Исходное место блока с логотипом и поиском
     */
    const originalParent =
    menuButtonContainer.parentNode;

    const originalNextSibling =
    menuButtonContainer.nextSibling;

    let previousFocusedElement = null;
    let previousBodyOverflow = "";
    let menuButtonPlaceholder = null;

    function getPagePadding() {
        const value = getComputedStyle(
            document.documentElement
        )
        .getPropertyValue("--page-padding")
        .trim();

        const padding = parseFloat(value);

        return Number.isFinite(padding)
        ? padding
        : 16;
    }

    function getAvailableSearchWidth() {
        const viewportWidth =
        document.documentElement.clientWidth;

        const logoWidth =
        menuOpenButton.getBoundingClientRect().width;

        return Math.max(
            80,
            viewportWidth
            - getPagePadding() * 2
            - logoWidth
            - 8
        );
    }

    function getTextWidth(text) {
        if (!searchInput) {
            return 180;
        }

        const styles = getComputedStyle(
            searchInput
        );

        const canvas = document.createElement(
            "canvas"
        );

        const context = canvas.getContext(
            "2d"
        );

        if (!context) {
            return 180;
        }

        context.font = [
            styles.fontStyle,
            styles.fontVariant,
            styles.fontWeight,
            styles.fontSize,
            styles.fontFamily
        ].join(" ");

        return context.measureText(text).width;
    }

    function updateSearchWidth() {
        if (
            !searchInput ||
            !menuInlineSearch
        ) {
            return;
        }

        const text =
        searchInput.value ||
        searchInput.placeholder ||
        "";

    const textWidth = getTextWidth(text);

    const desiredWidth = Math.max(
        180,
        textWidth + 32
    );

    const availableWidth =
    getAvailableSearchWidth();

    const searchWidth = Math.min(
        desiredWidth,
        availableWidth
    );

    menuInlineSearch.style.setProperty(
        "--search-width",
        `${searchWidth}px`
    );
    }

    /*
     * Переносим блок внутрь меню.
     *
     * Placeholder остаётся на старом месте
     * и не даёт странице сдвинуться.
     */
    function moveMenuButtonInsideMenu() {
        if (
            !menuPanel ||
            !menuHeader ||
            !originalParent
        ) {
            return;
        }

        menuButtonPlaceholder =
        document.createElement("div");

        menuButtonPlaceholder.className =
        "menu-button-placeholder";

        menuButtonPlaceholder.setAttribute(
            "aria-hidden",
            "true"
        );

        originalParent.insertBefore(
            menuButtonPlaceholder,
            menuButtonContainer
        );

        /*
         * Важно: используем menuPanel,
         * а не siteMenu.
         */
        menuPanel.insertBefore(
            menuButtonContainer,
            menuHeader
        );

        menuButtonContainer.classList.add(
            "menu-button-container-inside"
        );
    }

    /*
     * Возвращаем блок обратно
     * и удаляем placeholder.
     */
    function moveMenuButtonBack() {
        if (
            !originalParent ||
            !document.contains(originalParent)
        ) {
            return;
        }

        if (
            menuButtonPlaceholder &&
            menuButtonPlaceholder.parentNode ===
            originalParent
        ) {
            originalParent.insertBefore(
                menuButtonContainer,
                menuButtonPlaceholder
            );

            menuButtonPlaceholder.remove();
            menuButtonPlaceholder = null;
        } else if (
            originalNextSibling &&
            originalNextSibling.parentNode ===
            originalParent
        ) {
            originalParent.insertBefore(
                menuButtonContainer,
                originalNextSibling
            );
        } else {
            originalParent.appendChild(
                menuButtonContainer
            );
        }

        menuButtonContainer.classList.remove(
            "menu-button-container-inside"
        );
    }

    function openMenu() {
        previousFocusedElement =
        document.activeElement;

        previousBodyOverflow =
        document.body.style.overflow;

        moveMenuButtonInsideMenu();

        menuButtonContainer.classList.add(
            "menu-search-is-open"
        );

        siteMenu.classList.add("is-open");

        siteMenu.setAttribute(
            "aria-hidden",
            "false"
        );

        menuOpenButton.setAttribute(
            "aria-expanded",
            "true"
        );

        menuOpenButton.setAttribute(
            "aria-label",
            "Закрыть меню"
        );

        document.body.classList.add(
            "menu-is-open"
        );

        document.body.style.overflow = "hidden";

        updateSearchWidth();

        window.setTimeout(() => {
            if (searchInput) {
                searchInput.focus();
            }
        }, 250);
    }

    function closeMenu() {
        if (
            !siteMenu.classList.contains("is-open")
        ) {
            return;
        }

        siteMenu.classList.remove("is-open");

        siteMenu.setAttribute(
            "aria-hidden",
            "true"
        );

        menuButtonContainer.classList.remove(
            "menu-search-is-open"
        );

        menuOpenButton.setAttribute(
            "aria-expanded",
            "false"
        );

        menuOpenButton.setAttribute(
            "aria-label",
            "Открыть меню"
        );

        document.body.classList.remove(
            "menu-is-open"
        );

        document.body.style.overflow =
        previousBodyOverflow;

        if (searchInput) {
            searchInput.value = "";
        }

        if (menuInlineSearch) {
            menuInlineSearch.style.setProperty(
                "--search-width",
                "180px"
            );
        }

        moveMenuButtonBack();

        if (
            previousFocusedElement &&
            typeof previousFocusedElement.focus ===
            "function" &&
            document.contains(previousFocusedElement)
        ) {
            previousFocusedElement.focus();
        } else {
            menuOpenButton.focus();
        }

        previousFocusedElement = null;
    }

    /*
     * Открытие и закрытие по логотипу
     */
    menuOpenButton.addEventListener(
        "click",
        () => {
            if (
                siteMenu.classList.contains("is-open")
            ) {
                closeMenu();
            } else {
                openMenu();
            }
        }
    );

    /*
     * Закрытие по кнопке и backdrop
     */
    menuCloseButtons.forEach((button) => {
        button.addEventListener(
            "click",
            closeMenu
        );
    });

    /*
     * Поиск
     */
    if (searchInput) {
        searchInput.addEventListener(
            "input",
            updateSearchWidth
        );

        searchInput.addEventListener(
            "keydown",
            (event) => {
                if (event.key === "Escape") {
                    searchInput.value = "";
                    updateSearchWidth();
                    searchInput.focus();
                }
            }
        );
    }

    if (menuInlineSearch) {
        menuInlineSearch.addEventListener(
            "submit",
            (event) => {
                event.preventDefault();

                const query = searchInput
                ? searchInput.value.trim()
                : "";

                if (query) {
                    console.log(
                        "Поисковый запрос:",
                        query
                    );
                } else if (searchInput) {
                    searchInput.focus();
                }
            }
        );
    }

    /*
     * Закрытие клавишей Escape
     */
    document.addEventListener(
        "keydown",
        (event) => {
            if (
                event.key === "Escape" &&
                siteMenu.classList.contains("is-open")
            ) {
                closeMenu();
            }
        }
    );

    /*
     * Пересчёт ширины поиска
     */
    window.addEventListener(
        "resize",
        () => {
            if (
                siteMenu.classList.contains("is-open")
            ) {
                updateSearchWidth();
            }
        }
    );
})();
