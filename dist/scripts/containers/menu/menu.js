(() => {
  "use strict";

  const menu = document.querySelector("#siteMenu");
  const siteMenu = menu?.querySelector(".site-menu");
  const openButton = document.querySelector("#menuOpenButton");
  const container = document.querySelector("#menuButtonContainer");
  const triggerRow = container?.querySelector(".menu-trigger-row");
  const search = document.querySelector("#menuInlineSearch");
  const input = document.querySelector("#menuInlineSearchInput");

  if (
    !menu ||
    !siteMenu ||
    !openButton ||
    !container ||
    !triggerRow ||
    !search ||
    !input
  ) {
    return;
  }

  const closeElements = menu.querySelectorAll("[data-menu-close]");
  const header = siteMenu.querySelector(".site-menu-header");

  const originalParent = container.parentNode;
  const originalNextSibling = container.nextSibling;

  let previousFocus = null;
  let previousOverflow = "";
  let placeholder = null;

  const MIN_SEARCH_WIDTH = 180;

  function getSearchTextWidth() {
    const inputStyle = window.getComputedStyle(input);

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return MIN_SEARCH_WIDTH;
    }

    context.font = [
      inputStyle.fontStyle,
      inputStyle.fontVariant,
      inputStyle.fontWeight,
      inputStyle.fontSize,
      inputStyle.fontFamily
    ].join(" ");

    const text =
      input.value ||
      input.placeholder ||
      "Поиск";

    const textWidth = context.measureText(text).width;

    /*
      28px — внутренние отступы input.
      20px — дополнительное место для комфортного ввода.
    */
    return Math.ceil(textWidth + 48);
  }

  function resetSearchPosition() {
    triggerRow.style.setProperty(
      "--search-width",
      "0px"
    );

    triggerRow.style.setProperty(
      "--search-push",
      "0px"
    );
  }

  function updateSearch() {
    if (!container.classList.contains("menu-search-is-open")) {
      triggerRow.style.setProperty("--search-width", "0px");
      triggerRow.style.setProperty("--search-push", "0px");
      return;
    }

    const rowRect = triggerRow.getBoundingClientRect();
    const logoRect = openButton.getBoundingClientRect();

    const rowWidth = rowRect.width;
    const logoWidth = logoRect.width;

    if (!rowWidth || !logoWidth) {
      return;
    }

    const rowStyle = window.getComputedStyle(triggerRow);

    const gap =
      parseFloat(
        rowStyle.getPropertyValue("--menu-row-gap")
      ) || 8;

    const centerX = rowWidth / 2;

    /*
      Правая граница логотипа,
      если он находится строго по центру.
    */
    const centeredLogoRight =
      centerX +
      logoWidth / 2 +
      gap;

    /*
      Свободное место справа
      от логотипа в центральном положении.
    */
    const availableRightWidth = Math.max(
      0,
      rowWidth - centeredLogoRight
    );

    /*
      Максимальное смещение влево.

      Логотип может двигаться только до левой
      границы строки, но не дальше.
    */
    const maxSearchPush = Math.max(
      0,
      centerX - logoWidth / 2
    );

    /*
      Определяем ширину поисковой строки
      по содержимому.
    */
    const inputStyle = window.getComputedStyle(input);

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    let requestedSearchWidth = 180;

    if (context) {
      context.font = [
        inputStyle.fontStyle,
        inputStyle.fontVariant,
        inputStyle.fontWeight,
        inputStyle.fontSize,
        inputStyle.fontFamily
      ].join(" ");

      const text =
        input.value ||
        input.placeholder ||
        "Поиск";

      requestedSearchWidth =
        context.measureText(text).width + 48;
    }

    requestedSearchWidth = Math.max(
      180,
      requestedSearchWidth
    );

    /*
      Максимальная ширина поиска:

      свободное место справа
      +
      максимально допустимое смещение логотипа.

      Благодаря этому:
      - логотип не выходит за левую границу;
      - поиск не выходит за правую границу.
    */
    const maxSearchWidth =
      availableRightWidth +
      maxSearchPush;

    const searchWidth = Math.min(
      requestedSearchWidth,
      maxSearchWidth
    );

    /*
      Пока поиск помещается справа,
      логотип остаётся по центру.

      Когда места справа не хватает,
      логотип начинает двигаться влево.
    */
    const searchPush = Math.min(
      maxSearchPush,
      Math.max(
        0,
        searchWidth - availableRightWidth
      )
    );

    triggerRow.style.setProperty(
      "--search-width",
      `${Math.round(searchWidth)}px`
    );

    triggerRow.style.setProperty(
      "--search-push",
      `${Math.round(searchPush)}px`
    );
  }


  function restoreContainer() {
    if (
      !originalParent ||
      !document.contains(originalParent)
    ) {
      return;
    }

    if (
      placeholder &&
      placeholder.parentNode === originalParent
    ) {
      originalParent.insertBefore(
        container,
        placeholder
      );

      placeholder.remove();
      placeholder = null;

      return;
    }

    if (
      originalNextSibling &&
      originalNextSibling.parentNode === originalParent
    ) {
      originalParent.insertBefore(
        container,
        originalNextSibling
      );

      return;
    }

    originalParent.appendChild(container);
  }

  function closeMenu() {
    if (!menu.classList.contains("is-open")) {
      return;
    }

    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");

    container.classList.remove(
      "menu-search-is-open",
      "menu-button-container-inside"
    );

    openButton.setAttribute(
      "aria-expanded",
      "false"
    );

    openButton.setAttribute(
      "aria-label",
      "Открыть меню"
    );

    search.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.classList.remove("menu-is-open");
    document.body.style.overflow = previousOverflow;

    input.value = "";

    resetSearchPosition();
    restoreContainer();

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

  function openMenu() {
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;

    if (header && originalParent) {
      placeholder = document.createElement("div");

      placeholder.className =
        "menu-button-placeholder";

      placeholder.setAttribute(
        "aria-hidden",
        "true"
      );

      originalParent.insertBefore(
        placeholder,
        container
      );

      siteMenu.insertBefore(
        container,
        header
      );

      container.classList.add(
        "menu-button-container-inside"
      );
    }

    container.classList.add(
      "menu-search-is-open"
    );

    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");

    openButton.setAttribute(
      "aria-expanded",
      "true"
    );

    openButton.setAttribute(
      "aria-label",
      "Закрыть меню"
    );

    search.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add("menu-is-open");
    document.body.style.overflow = "hidden";

    updateSearch();

    window.setTimeout(() => {
      input.focus();
    }, 250);
  }

  openButton.addEventListener("click", () => {
    if (menu.classList.contains("is-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  closeElements.forEach((element) => {
    element.addEventListener("click", closeMenu);
  });

  input.addEventListener("input", updateSearch);

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      input.value = "";
      updateSearch();
      input.focus();
    }
  });

  search.addEventListener("submit", (event) => {
    event.preventDefault();

    const value = input.value.trim();

    if (!value) {
      input.focus();
      return;
    }

    console.log("Поисковый запрос:", value);
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      menu.classList.contains("is-open")
    ) {
      closeMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (menu.classList.contains("is-open")) {
      updateSearch();
    }
  });

  resetSearchPosition();

  search.setAttribute(
    "aria-hidden",
    "true"
  );
})();
