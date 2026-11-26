/* DOM rendering for the graph page. Engines never touch these controls. */
import { svgEl, categoryColors, readPalette } from "./shared.js";

export function install(P) {
  let engineDocBound = false;
  let sectionDocBound = false;
  let controlTipBound = false;
  let detailsCloseTimer = 0;
  let detailsSwitchTimer = 0;
  let renderedDetailsId = null;
  Object.assign(P, {
    bindGraphElements, bindEngineSelect, renderEngines, renderSections, renderDetails,
    hideDetails, showTooltip, updateStatus, updateActions, decorateActions,
    setLoading, hideLoading, showLoadingError,
  });

  function bindGraphElements() {
    const ids = {
      engines: "graphEngines", kinds: "graphKinds", search: "graphSearch",
      section: "graphSection", actions: "graphActions", host: "graphHost",
      stage: "graphStage", stageExit: "graphStageExit", tooltip: "graphTooltip", empty: "graphEmpty",
      details: "graphDetails", detailsBody: "graphDetailsBody",
      detailsClose: "graphDetailsClose", status: "graphStatus",
      controlTip: "graphControlTip",
      sectionSelect: "graphSectionSelect", sectionTrigger: "graphSectionTrigger",
      sectionMenu: "graphSectionMenu", sectionFilter: "graphSectionFilter",
      sectionOptions: "graphSectionOptions", sectionEmpty: "graphSectionEmpty",
      sectionValue: "graphSectionValue",
      loading: "graphLoading", loadingTitle: "graphLoadingTitle",
      loadingDetail: "graphLoadingDetail", loadingFill: "graphLoadingFill",
      loadingRetry: "graphLoadingRetry",
    };
    const els = {};
    for (const [key, id] of Object.entries(ids)) els[key] = document.getElementById(id);
    if (!els.host || !els.engines || !els.status || !els.actions) return false;
    P.els = els;
    bindEngineSelect();
    bindSectionSelect();
    return true;
  }

  function engineIcon(id) {
    const icon = svgEl("svg", {
      class: "graph-engine-icon",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.7,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
    });
    for (const [tag, attrs] of (P.ENGINE_ICONS?.[id] || [])) icon.append(svgEl(tag, attrs));
    return icon;
  }

  function closeEngineMenu() {
    const root = P.els.engines;
    const trigger = root?.querySelector(".graph-engine-select-trigger");
    const menu = root?.querySelector(".graph-engine-select-menu");
    if (!trigger || !menu) return;
    menu.hidden = true;
    resetPopup(menu);
    trigger.setAttribute("aria-expanded", "false");
  }

  // Both pickers now sit below the graph, so their menus are pinned to the
  // viewport and open towards whichever side has room. Only `list` scrolls for
  // the section picker; the engine menu scrolls as a whole.
  function resetPopup(menu) {
    menu.style.removeProperty("left");
    menu.style.removeProperty("width");
    menu.style.removeProperty("top");
    menu.style.removeProperty("bottom");
    menu.style.removeProperty("max-height");
    menu.style.removeProperty("position");
    menu.classList.remove("is-upward");
    delete menu.dataset.nudged;
  }

  function placePopup(menu, trigger, list) {
    if (!menu || !trigger || menu.hidden) return;
    resetPopup(menu);
    if (list) list.style.removeProperty("max-height");

    let rect = trigger.getBoundingClientRect();
    const below = Math.max(0, window.innerHeight - rect.bottom - 12);
    const above = Math.max(0, rect.top - 12);
    const offscreen = rect.top < 12 || rect.bottom > window.innerHeight - 12;
    // Bring the trigger into view once instead of showing a one-line sliver or
    // pinning the menu to the wrong side of an off-screen control.
    if ((offscreen || Math.max(below, above) < 160) && !menu.dataset.nudged) {
      menu.dataset.nudged = "1";
      trigger.scrollIntoView({ block: "center", behavior: "auto" });
      placePopup(menu, trigger, list);
      return;
    }

    const downward = below >= 160 || below >= above;
    const room = Math.min(320, downward ? below : above);
    const chrome = list ? Math.max(0, menu.offsetHeight - list.offsetHeight) : 0;
    if (list) list.style.maxHeight = `${Math.round(Math.max(64, room - chrome))}px`;
    else menu.style.maxHeight = `${Math.round(room)}px`;

    rect = trigger.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.left = `${Math.round(rect.left)}px`;
    menu.style.width = `${Math.round(rect.width)}px`;
    if (downward) {
      menu.style.top = `${Math.round(rect.bottom + 6)}px`;
      menu.style.bottom = "auto";
    } else {
      menu.style.top = "auto";
      menu.style.bottom = `${Math.round(window.innerHeight - rect.top + 6)}px`;
      menu.classList.add("is-upward");
    }
  }

  // Native <select> options cannot render SVG, so this is a small listbox with
  // the same icon set and full keyboard support.
  function bindEngineSelect() {
    const root = P.els.engines;
    if (!root || root.dataset.bound === "1") return;
    // Stop the inline cold-start handlers; the full listbox takes over.
    window.__zqwyGraphBootstrap?.abort?.();
    root.dataset.bound = "1";

    root.addEventListener("click", (event) => {
      if (!event.target.closest(".graph-engine-select-trigger")) return;
      const menu = root.querySelector(".graph-engine-select-menu");
      const trigger = root.querySelector(".graph-engine-select-trigger");
      if (!menu || !trigger) return;
      const open = menu.hidden;
      menu.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
      if (open) {
        placePopup(menu, trigger);
        (menu.querySelector('[aria-selected="true"]') || menu.querySelector(".graph-engine-option"))?.focus();
      }
    });

    root.addEventListener("keydown", (event) => {
      const menu = root.querySelector(".graph-engine-select-menu");
      const trigger = root.querySelector(".graph-engine-select-trigger");
      if (!menu || !trigger) return;
      const options = [...menu.querySelectorAll(".graph-engine-option")];
      const selected = () => options.find((option) => option.getAttribute("aria-selected") === "true") || options[0];

      if (event.key === "Escape") {
        if (!menu.hidden) { closeEngineMenu(); trigger.focus(); }
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (menu.hidden) {
          menu.hidden = false;
          trigger.setAttribute("aria-expanded", "true");
          placePopup(menu, trigger);
          selected()?.focus();
          return;
        }
        const current = options.indexOf(document.activeElement);
        const step = event.key === "ArrowDown" ? 1 : -1;
        options[Math.max(0, Math.min(options.length - 1, current + step))]?.focus();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        if (!menu.hidden && document.activeElement?.classList.contains("graph-engine-option")) {
          event.preventDefault();
          document.activeElement.click();
        } else if (document.activeElement === trigger) {
          event.preventDefault();
          menu.hidden = false;
          trigger.setAttribute("aria-expanded", "true");
          placePopup(menu, trigger);
          selected()?.focus();
        }
      }
    });

    // One document listener for the lifetime of the page; it always checks the
    // current elements, so SPA navigation does not leave stale listeners.
    if (!engineDocBound) {
      engineDocBound = true;
      document.addEventListener("click", (event) => {
        if (P.els.engines && !P.els.engines.contains(event.target)) closeEngineMenu();
      });
      window.addEventListener("resize", () => {
        const menu = P.els.engines?.querySelector(".graph-engine-select-menu");
        const trigger = P.els.engines?.querySelector(".graph-engine-select-trigger");
        if (menu && !menu.hidden) placePopup(menu, trigger);
      }, { passive: true });
      window.addEventListener("scroll", (event) => {
        const menu = P.els.engines?.querySelector(".graph-engine-select-menu");
        if (!menu || menu.hidden || menu.contains(event.target)) return;
        placePopup(menu, P.els.engines?.querySelector(".graph-engine-select-trigger"));
      }, { passive: true, capture: true });
    }
  }

  // The section filter is a styled listbox too: it can search inside the
  // sections and shows how many notes each one contains. The hidden <select>
  // stays the source of truth, so the page controller needs no changes.
  function closeSectionMenu() {
    const menu = P.els.sectionMenu;
    const trigger = P.els.sectionTrigger;
    if (!menu || !trigger) return;
    menu.hidden = true;
    resetPopup(menu);
    if (P.els.sectionOptions) P.els.sectionOptions.style.removeProperty("max-height");
    trigger.setAttribute("aria-expanded", "false");
    if (P.els.sectionFilter) P.els.sectionFilter.value = "";
    if (P.els.sectionEmpty) P.els.sectionEmpty.hidden = true;
    menu.querySelectorAll(".graph-section-option").forEach((option) => { option.hidden = false; });
  }

  // The section picker sits below the scene now, so its list opens downwards
  // by default. Only the options scroll; the search field stays in place.
  function positionSectionMenu() {
    placePopup(P.els.sectionMenu, P.els.sectionTrigger, P.els.sectionOptions);
  }

  function visibleSectionOptions() {
    return [...(P.els.sectionOptions?.querySelectorAll(".graph-section-option") || [])]
      .filter((option) => !option.hidden);
  }

  function filterSectionOptions() {
    const query = (P.els.sectionFilter?.value || "").trim().toLowerCase();
    const options = [...(P.els.sectionOptions?.querySelectorAll(".graph-section-option") || [])];
    let visible = 0;
    for (const option of options) {
      const label = String(option.dataset.label || option.textContent || "").toLowerCase();
      option.hidden = Boolean(query) && !label.includes(query);
      if (!option.hidden) visible += 1;
    }
    if (P.els.sectionEmpty) P.els.sectionEmpty.hidden = visible > 0;
  }

  function chooseSection(value) {
    const select = P.els.section;
    if (!select) return;
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    updateSectionValue();
    closeSectionMenu();
    P.els.sectionTrigger?.focus();
  }

  function bindSectionSelect() {
    const trigger = P.els.sectionTrigger;
    const menu = P.els.sectionMenu;
    if (!trigger || !menu || trigger.dataset.bound === "1") return;
    trigger.dataset.bound = "1";

    trigger.addEventListener("click", () => {
      const open = menu.hidden;
      menu.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
      if (open) {
        filterSectionOptions();
        if (P.els.sectionOptions) P.els.sectionOptions.scrollTop = 0;
        positionSectionMenu();
        P.els.sectionFilter?.focus();
      }
    });

    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        menu.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        filterSectionOptions();
        if (P.els.sectionOptions) P.els.sectionOptions.scrollTop = 0;
        positionSectionMenu();
        P.els.sectionFilter?.focus();
      } else if (event.key === "Escape") {
        closeSectionMenu();
      }
    });

    P.els.sectionFilter?.addEventListener("input", () => {
      filterSectionOptions();
      if (P.els.sectionOptions) P.els.sectionOptions.scrollTop = 0;
      positionSectionMenu();
    });
    P.els.sectionFilter?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        visibleSectionOptions()[0]?.focus();
      } else if (event.key === "Enter") {
        const first = visibleSectionOptions()[0];
        if (first) { event.preventDefault(); chooseSection(first.dataset.value); }
      } else if (event.key === "Escape") {
        closeSectionMenu();
        trigger.focus();
      }
    });

    P.els.sectionOptions?.addEventListener("keydown", (event) => {
      const options = visibleSectionOptions();
      const current = options.indexOf(document.activeElement);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        options[Math.max(0, Math.min(options.length - 1, current + step))]?.focus();
      } else if (event.key === "Enter" || event.key === " ") {
        const option = event.target.closest?.(".graph-section-option");
        if (option) { event.preventDefault(); chooseSection(option.dataset.value); }
      } else if (event.key === "Escape") {
        closeSectionMenu();
        trigger.focus();
      }
    });

    if (!sectionDocBound) {
      sectionDocBound = true;
      document.addEventListener("click", (event) => {
        if (P.els.sectionSelect && !P.els.sectionSelect.contains(event.target)) closeSectionMenu();
      });
      window.addEventListener("resize", () => positionSectionMenu(), { passive: true });
      // Scrolling the option list must not reposition (and thus resize) the
      // list mid-gesture; only page/viewport scrolling needs a refresh.
      window.addEventListener("scroll", (event) => {
        if (P.els.sectionMenu && (event.target === P.els.sectionMenu
          || P.els.sectionMenu.contains(event.target))) return;
        positionSectionMenu();
      }, { passive: true, capture: true });
    }
  }

  function updateSectionValue() {
    const select = P.els.section;
    const value = P.els.sectionValue;
    if (!select || !value) return;
    const option = [...select.options].find((item) => item.value === select.value);
    const label = option?.textContent || P.t("allSections");
    value.textContent = label;
    P.els.sectionTrigger?.setAttribute("aria-label", `${P.t("graphFilter")}: ${label}`);
    const dot = P.els.sectionSelect?.querySelector(".graph-section-select-dot");
    if (dot) {
      const selected = [...(P.els.sectionOptions?.querySelectorAll(".graph-section-option") || [])]
        .find((item) => item.dataset.value === select.value);
      dot.style.setProperty("--kind-color", selected?.style.getPropertyValue("--kind-color") || "var(--muted)");
    }
  }

  function renderEngines() {
    const root = P.els.engines;
    if (!root) return;
    const trigger = root.querySelector(".graph-engine-select-trigger");
    const menu = root.querySelector(".graph-engine-select-menu");
    if (!trigger || !menu) return;
    const engines = P.availableEngines?.() || P.ENGINES;
    const active = engines.find((meta) => meta.id === P.settings.engine) || engines[0];
    const label = active ? P.t(`engine.${active.id}`) : P.t("noEngines");
    const iconHost = trigger.querySelector(".graph-engine-select-icon");
    if (iconHost) {
      iconHost.replaceChildren();
      if (active) iconHost.append(engineIcon(active.id));
    }
    const value = trigger.querySelector(".graph-engine-select-value");
    if (value) value.textContent = label;
    trigger.setAttribute("aria-label", `${P.t("graphEngines")}: ${label}`);
    root.dataset.engine = active?.id || "";

    menu.replaceChildren();
    for (const meta of engines) {
      const option = document.createElement("div");
      option.className = "graph-engine-option";
      option.setAttribute("role", "option");
      option.dataset.engine = meta.id;
      option.setAttribute("aria-selected", String(meta.id === P.settings.engine));
      option.tabIndex = -1;
      option.append(engineIcon(meta.id));
      const text = document.createElement("span");
      text.className = "graph-engine-option-label";
      text.textContent = P.t(`engine.${meta.id}`);
      option.append(text);
      if (meta.id === P.settings.engine) {
        const check = document.createElement("span");
        check.className = "graph-engine-option-check";
        check.setAttribute("aria-hidden", "true");
        check.textContent = "✓";
        option.append(check);
      }
      option.addEventListener("click", () => {
        closeEngineMenu();
        // A deliberate choice clears a previous auto-disable notice; a new
        // failure puts it straight back via disableEngine().
        P.state.notice = "";
        P.selectEngine?.(meta.id);
      });
      menu.append(option);
    }
    closeEngineMenu();
  }

  function actionIcon(button, key) {
    let icon = button.querySelector(".graph-action-icon");
    if (!icon) {
      icon = svgEl("svg", {
        class: "graph-action-icon",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": 1.7,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "aria-hidden": "true",
      });
      button.prepend(icon);
    }
    icon.replaceChildren();
    for (const [tag, attrs] of (P.ACTION_ICONS?.[key] || [])) {
      icon.append(svgEl(tag, attrs));
    }
  }

  // Icon-only buttons get a short native title plus a richer custom hint that
  // explains the action. The hint follows the button, including in fullscreen.
  function hideControlTip() {
    const tip = P.els.controlTip;
    if (!tip) return;
    tip.classList.remove("is-visible");
    tip.hidden = true;
  }

  function showControlTip(button) {
    const tip = P.els.controlTip;
    const stage = P.els.stage;
    if (!tip || !stage) return;
    const text = button.dataset.tip || button.title || button.getAttribute("aria-label") || "";
    if (!text) return;
    tip.textContent = text;
    tip.hidden = false;
    tip.classList.add("is-visible");
    const bounds = button.getBoundingClientRect();
    const scene = stage.getBoundingClientRect();
    const width = tip.offsetWidth || 200;
    const center = bounds.left + bounds.width / 2 - scene.left;
    tip.style.left = `${Math.max(width / 2 + 8, Math.min(scene.width - width / 2 - 8, center))}px`;
    tip.style.top = `${Math.max(44, bounds.top - scene.top - 10)}px`;
  }

  function bindControlTips() {
    const stage = P.els.stage;
    if (!stage || !P.els.controlTip || stage.dataset.tipBound === "1") return;
    stage.dataset.tipBound = "1";
    const owner = (node) => (node instanceof Element ? node.closest("[data-tip]") : null);
    stage.addEventListener("pointerover", (event) => {
      const button = owner(event.target);
      if (button) showControlTip(button);
    });
    stage.addEventListener("pointerout", (event) => {
      const button = owner(event.target);
      if (button && !button.contains(event.relatedTarget)) hideControlTip();
    });
    stage.addEventListener("focusin", (event) => {
      const button = owner(event.target);
      if (button) showControlTip(button);
    });
    stage.addEventListener("focusout", (event) => {
      if (owner(event.target)) hideControlTip();
    });
    stage.addEventListener("pointerdown", (event) => {
      if (owner(event.target)) hideControlTip();
    });
  }

  // Buttons are icon-only; updateActions() supplies icons and translated
  // title/aria-label text after every state or language change.
  function decorateActions() {
    if (P.els.stageExit) P.els.stageExit.dataset.tip = P.t("tip.exitFullscreen");
    if (P.els.detailsClose) P.els.detailsClose.dataset.tip = P.t("tip.closeDetails");
    bindControlTips();
    P.updateActions?.();
  }

  function renderSections() {
    const select = P.els.section;
    if (!select) return;
    const current = P.settings.section;
    select.replaceChildren();
    const all = document.createElement("option");
    all.value = "";
    all.textContent = P.t("allSections");
    select.append(all);
    const categories = [...(P.state.graph?.categories || [])]
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
    const counts = new Map();
    for (const node of P.state.allNodes) {
      counts.set(node.category, (counts.get(node.category) || 0) + 1);
    }
    const colors = categoryColors(categories, readPalette());
    for (const category of categories) {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.label;
      select.append(option);
    }
    select.value = categories.some((category) => category.id === current) ? current : "";
    P.settings.section = select.value;

    renderSectionMenu(categories, counts, colors);
  }

  function renderSectionMenu(categories, counts, colors) {
    const box = P.els.sectionOptions;
    if (!box) return;
    const entries = [
      { id: "", label: P.t("allSections"), color: "", count: P.state.allNodes.length },
      ...categories.map((category) => ({
        id: category.id,
        label: category.label,
        color: colors.get(category.id) || "",
        count: counts.get(category.id) || 0,
      })),
    ];
    box.replaceChildren();
    for (const entry of entries) {
      const option = document.createElement("div");
      option.className = "graph-section-option";
      option.setAttribute("role", "option");
      option.dataset.value = entry.id;
      option.dataset.label = entry.label;
      option.tabIndex = -1;
      option.setAttribute("aria-selected", String(entry.id === P.settings.section));
      const dot = document.createElement("span");
      dot.className = "graph-section-option-dot";
      dot.setAttribute("aria-hidden", "true");
      if (entry.color) dot.style.setProperty("--kind-color", entry.color);
      const label = document.createElement("span");
      label.className = "graph-section-option-label";
      label.textContent = entry.label;
      const count = document.createElement("span");
      count.className = "graph-section-option-count";
      count.textContent = String(entry.count);
      option.append(dot, label, count);
      option.addEventListener("click", () => chooseSection(entry.id));
      box.append(option);
    }
    if (P.els.sectionFilter) P.els.sectionFilter.placeholder = P.t("sectionFilterPlaceholder");
    if (P.els.sectionEmpty) P.els.sectionEmpty.textContent = P.t("sectionFilterEmpty");
    closeSectionMenu();
    updateSectionValue();
  }

  // Closing is animated too: keep the content in place while the card slides
  // out, then hide it. A quick re-open cancels the pending hide.
  function hideDetails() {
    const panel = P.els.details;
    if (!panel || panel.hidden || panel.classList.contains("is-closing")) return;
    window.clearTimeout(detailsCloseTimer);
    window.clearTimeout(detailsSwitchTimer);
    panel.classList.remove("is-opening", "is-switching", "is-switch-out", "is-switch-in");
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      panel.hidden = true;
      P.els.detailsBody?.replaceChildren();
      renderedDetailsId = null;
      P.updateActions?.();
      return;
    }
    panel.classList.add("is-closing");
    detailsCloseTimer = window.setTimeout(() => {
      panel.hidden = true;
      panel.classList.remove("is-closing");
      if (P.els.detailsBody && !P.state.selected) P.els.detailsBody.replaceChildren();
      if (!P.state.selected) renderedDetailsId = null;
      P.updateActions?.();
    }, 220);
  }

  function fillDetails(node) {
    const body = P.els.detailsBody;
    const panel = P.els.details;
    if (!panel || !body || !node) return;
    panel.scrollTop = 0;
    panel.setAttribute("aria-label", node.title);
    body.replaceChildren();

    const title = document.createElement("h2");
    title.textContent = node.title;
    const meta = document.createElement("p");
    meta.className = "graph-detail-meta";
    meta.textContent = `${node.categoryLabel || "Общие"} · ${node.date || "—"} · ${node.degree} ${P.t("links")}`;
    const excerpt = document.createElement("p");
    excerpt.className = "graph-detail-excerpt";
    excerpt.textContent = node.excerpt || "";

    const open = document.createElement("a");
    open.className = "graph-detail-open";
    open.href = new URL(node.path, P.SITE_ROOT).href;
    open.textContent = P.t("open");

    const heading = document.createElement("h3");
    heading.textContent = P.t("neighbours");
    const list = document.createElement("ul");
    list.className = "graph-neighbour-list";
    const neighbours = (P.state.graph?.links || [])
      .filter((link) => link.source === node.id || link.target === node.id)
      .map((link) => ({ link, id: link.source === node.id ? link.target : link.source }))
      .filter(({ id }) => P.state.nodeById.has(id));

    if (!neighbours.length) {
      const empty = document.createElement("li");
      empty.className = "graph-muted";
      empty.textContent = P.t("noNeighbours");
      list.append(empty);
    }
    for (const { link, id } of neighbours) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = P.state.nodeById.get(id).title;
      const kind = document.createElement("span");
      kind.className = "graph-neighbour-kind";
      kind.textContent = P.t(link.kind);
      button.append(kind);
      button.addEventListener("click", () => P.setSelection?.(id, { focus: true }));
      item.append(button);
      list.append(item);
    }
    body.append(title, meta, excerpt, open, heading, list);
    renderedDetailsId = node.id;
  }

  function renderDetails(options = {}) {
    const panel = P.els.details;
    const body = P.els.detailsBody;
    if (!panel || !body) return;
    const node = P.state.nodeById.get(P.state.selected);
    if (!node) { hideDetails(); return; }

    window.clearTimeout(detailsCloseTimer);
    window.clearTimeout(detailsSwitchTimer);
    panel.classList.remove("is-closing");
    const alreadyOpen = !panel.hidden && renderedDetailsId;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // During a walk the card is already on screen: cross-fade its contents
    // instead of replaying the whole entrance animation on every note.
    if (alreadyOpen && renderedDetailsId !== node.id && options.switching !== false && !reduced) {
      panel.classList.remove("is-opening", "is-switch-in");
      panel.classList.add("is-switching", "is-switch-out");
      detailsSwitchTimer = window.setTimeout(() => {
        panel.classList.remove("is-switch-out");
        fillDetails(node);
        panel.classList.add("is-switch-in");
        P.updateActions?.();
        detailsSwitchTimer = window.setTimeout(() => {
          panel.classList.remove("is-switching", "is-switch-in");
        }, 260);
      }, 130);
      return;
    }

    panel.hidden = false;
    panel.classList.remove("is-switching", "is-switch-out", "is-switch-in", "is-opening");
    fillDetails(node);
    void panel.offsetWidth;
    panel.classList.add("is-opening");
    P.updateActions?.();
  }

  function setLoading(title, detail = "", progress = 8) {
    const box = P.els.loading;
    if (!box) return;
    box.hidden = false;
    box.classList.remove("is-error");
    if (P.els.loadingTitle) P.els.loadingTitle.textContent = title;
    if (P.els.loadingDetail) P.els.loadingDetail.textContent = detail || "";
    if (P.els.loadingFill) {
      const value = Math.max(2, Math.min(100, Number(progress) || 0));
      P.els.loadingFill.style.width = `${value}%`;
    }
    if (P.els.loadingRetry) P.els.loadingRetry.hidden = true;
  }

  function hideLoading() {
    const box = P.els.loading;
    if (!box) return;
    box.hidden = true;
    box.classList.remove("is-error");
  }

  function showLoadingError(message) {
    const box = P.els.loading;
    if (!box) return;
    box.hidden = false;
    box.classList.add("is-error");
    if (P.els.loadingTitle) P.els.loadingTitle.textContent = P.t("errorTitle");
    if (P.els.loadingDetail) {
      P.els.loadingDetail.textContent = message
        ? `${P.t("errorHint")} · ${message}`
        : P.t("errorHint");
    }
    if (P.els.loadingFill) P.els.loadingFill.style.width = "100%";
    if (P.els.loadingRetry) {
      P.els.loadingRetry.textContent = P.t("retry");
      P.els.loadingRetry.hidden = false;
    }
  }

  function showTooltip(id, point) {
    const tooltip = P.els.tooltip;
    if (!tooltip) return;
    const node = id ? P.state.nodeById.get(id) : null;
    if (!node || !point) { tooltip.hidden = true; return; }
    tooltip.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = node.title;
    const meta = document.createElement("small");
    meta.textContent = `${node.categoryLabel} · ${node.degree} ${P.t("links")}`;
    tooltip.append(title, meta);
    tooltip.hidden = false;
    const width = P.els.stage?.clientWidth || 800;
    const height = P.els.stage?.clientHeight || 600;
    tooltip.style.left = `${Math.max(110, Math.min(width - 110, point.x))}px`;
    tooltip.style.top = `${Math.max(46, Math.min(height - 12, point.y))}px`;
  }

  function updateStatus() {
    if (!P.els.status) return;
    const meta = P.ENGINES.find((engine) => engine.id === P.settings.engine);
    const pieces = [
      `${P.state.nodes.length} ${P.t("ready")}`,
      `${P.state.links.length} ${P.t("links")}`,
      `${P.t("engine")}: ${P.t(`engine.${meta?.id || "canvas"}`)}`,
    ];
    if (P.state.walking) pieces.push(P.t("walking"));
    const selected = P.state.nodeById.get(P.state.selected);
    if (selected) pieces.push(`${P.t("selected")}: ${selected.title}`);
    if (P.state.notice) pieces.push(P.state.notice);
    P.els.status.textContent = pieces.join(" · ");
  }

  function updateActions() {
    if (P.els.loadingRetry) P.els.loadingRetry.textContent = P.t("retry");
    if (!P.els.actions) return;
    const fullscreen = Boolean(P.els.stage) && document.fullscreenElement === P.els.stage;
    if (P.els.stageExit) {
      P.els.stageExit.title = P.t("exitFullscreen");
      P.els.stageExit.setAttribute("aria-label", P.t("exitFullscreen"));
      P.els.stageExit.dataset.tip = P.t("tip.exitFullscreen");
    }
    if (P.els.detailsClose) P.els.detailsClose.dataset.tip = P.t("tip.closeDetails");
    const paused = Boolean(P.settings.paused);
    const walking = Boolean(P.state.walking);
    const detailsOpen = Boolean(P.els.details)
      && !P.els.details.hidden
      && !P.els.details.classList.contains("is-closing");
    const labels = {
      fit: P.t("fit"),
      motion: P.t(paused ? "motion" : "pause"),
      walk: P.t(walking ? "stopWalk" : "walk"),
      reset: P.t("reset"),
      details: P.t("details"),
      fullscreen: P.t(fullscreen ? "exitFullscreen" : "fullscreen"),
    };
    const icons = {
      fit: "fit",
      motion: paused ? "motion" : "pause",
      walk: walking ? "stopWalk" : "walk",
      reset: "reset",
      details: "details",
      fullscreen: fullscreen ? "exitFullscreen" : "fullscreen",
    };
    const active = { motion: paused, walk: walking, details: detailsOpen, fullscreen };
    const tips = {
      fit: P.t("tip.fit"),
      motion: P.t(paused ? "tip.motion" : "tip.pause"),
      walk: P.t(walking ? "tip.stopWalk" : "tip.walk"),
      reset: P.t("tip.reset"),
      details: P.t("tip.details"),
      fullscreen: P.t(fullscreen ? "tip.exitFullscreen" : "tip.fullscreen"),
    };
    for (const button of P.els.actions.querySelectorAll("[data-action]")) {
      const action = button.dataset.action;
      if (!(action in labels)) continue;
      actionIcon(button, icons[action]);
      button.title = labels[action];
      button.setAttribute("aria-label", labels[action]);
      button.dataset.tip = tips[action];
      button.dataset.active = String(Boolean(active[action]));
      if (action in active) button.setAttribute("aria-pressed", String(Boolean(active[action])));
    }
  }
}
