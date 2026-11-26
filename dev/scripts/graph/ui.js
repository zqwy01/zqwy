/* DOM rendering for the graph page. Engines never touch these controls. */
import { svgEl } from "./shared.js";

export function install(P) {
  Object.assign(P, {
    bindGraphElements, renderEngines, renderSections, renderDetails,
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
    if (!els.host || !els.engines || !els.status) return false;
    P.els = els;
    return true;
  }

  function renderEngines() {
    if (!P.els.engines) return;
    P.els.engines.replaceChildren();
    for (const meta of (P.availableEngines?.() || P.ENGINES)) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.engine = meta.id;
      button.dataset.active = String(P.settings.engine === meta.id);
      button.title = P.t(`engine.${meta.id}`);
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
      for (const [tag, attrs] of (P.ENGINE_ICONS?.[meta.id] || [])) {
        icon.append(svgEl(tag, attrs));
      }
      const label = document.createElement("span");
      label.className = "graph-engine-label";
      label.textContent = P.t(`engine.${meta.id}`);
      button.append(icon, label);
      button.addEventListener("click", () => P.selectEngine?.(meta.id));
      P.els.engines.append(button);
    }
  }

  function actionLabel(button) {
    let label = button.querySelector(".graph-action-label");
    if (!label) {
      const text = button.textContent.trim();
      const icon = button.querySelector(".graph-action-icon");
      button.replaceChildren();
      label = document.createElement("span");
      label.className = "graph-action-label";
      label.textContent = text;
      if (icon) button.append(icon);
      button.append(label);
    }
    return label;
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

  // Static HTML may be translated by menu/i18n.js, which replaces textContent
  // and would drop the icons. Re-wrap the labels once after the page is bound;
  // updateActions() restores them after every language switch.
  function decorateActions() {
    if (!P.els.actions) return;
    for (const button of P.els.actions.querySelectorAll("[data-action]")) {
      actionLabel(button);
    }
    P.updateActions();
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
      actionLabel(button).textContent = labels[action];
      actionIcon(button, icons[action]);
      button.title = labels[action];
      button.dataset.active = String(Boolean(active[action]));
    }
  }
}
