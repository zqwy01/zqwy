/* DOM rendering for the graph page. Engines never touch these controls. */
import { svgEl } from "./shared.js";

export function install(P) {
  let engineDocBound = false;
  Object.assign(P, {
    bindGraphElements, bindEngineSelect, renderEngines, renderSections, renderDetails,
    showTooltip, updateStatus, updateActions, decorateActions,
    setLoading, hideLoading, showLoadingError,
  });

  function bindGraphElements() {
    const ids = {
      engines: "graphEngines", kinds: "graphKinds", search: "graphSearch",
      section: "graphSection", actions: "graphActions", host: "graphHost",
      stage: "graphStage", stageExit: "graphStageExit", tooltip: "graphTooltip", empty: "graphEmpty",
      details: "graphDetails", detailsBody: "graphDetailsBody",
      detailsClose: "graphDetailsClose", status: "graphStatus",
      loading: "graphLoading", loadingTitle: "graphLoadingTitle",
      loadingDetail: "graphLoadingDetail", loadingFill: "graphLoadingFill",
      loadingRetry: "graphLoadingRetry",
    };
    const els = {};
    for (const [key, id] of Object.entries(ids)) els[key] = document.getElementById(id);
    if (!els.host || !els.engines || !els.status || !els.actions) return false;
    P.els = els;
    bindEngineSelect();
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
    trigger.setAttribute("aria-expanded", "false");
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

  // Buttons are icon-only; updateActions() supplies icons and translated
  // title/aria-label text after every state or language change.
  function decorateActions() {
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
    for (const category of categories) {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.label;
      select.append(option);
    }
    select.value = categories.some((category) => category.id === current) ? current : "";
    P.settings.section = select.value;
  }

  function renderDetails() {
    const panel = P.els.details;
    const body = P.els.detailsBody;
    if (!panel || !body) return;
    const node = P.state.nodeById.get(P.state.selected);
    if (!node) { panel.hidden = true; body.replaceChildren(); return; }
    panel.hidden = false;
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
    }
    const paused = Boolean(P.settings.paused);
    const walking = Boolean(P.state.walking);
    const labels = {
      fit: P.t("fit"),
      motion: P.t(paused ? "motion" : "pause"),
      walk: P.t(walking ? "stopWalk" : "walk"),
      reset: P.t("reset"),
      fullscreen: P.t(fullscreen ? "exitFullscreen" : "fullscreen"),
    };
    const icons = {
      fit: "fit",
      motion: paused ? "motion" : "pause",
      walk: walking ? "stopWalk" : "walk",
      reset: "reset",
      fullscreen: fullscreen ? "exitFullscreen" : "fullscreen",
    };
    const active = { motion: paused, walk: walking, fullscreen };
    for (const button of P.els.actions.querySelectorAll("[data-action]")) {
      const action = button.dataset.action;
      if (!(action in labels)) continue;
      actionIcon(button, icons[action]);
      button.title = labels[action];
      button.setAttribute("aria-label", labels[action]);
      button.dataset.active = String(Boolean(active[action]));
      if (action in active) button.setAttribute("aria-pressed", String(Boolean(active[action])));
    }
  }
}
