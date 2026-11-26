/* menu/build-info.js — модуль скрипта menu.js. */
export function install(P) {
  Object.assign(P, { renderBuildInfo, loadBuildInfo });


  /* ---------- build version shown in the settings panel ---------- */

  function renderBuildInfo(element, info) {
    if (!element || !info) return;
    // The build counter is data, not text: keep the wording translated in the UI
    // instead of baking "сборка/build" into build-info.json.
    element.textContent = "";
    const parts = [];
    if (info.version) {
      const versionLink = document.createElement("a");
      versionLink.className = "settings-build-link";
      const v = String(info.version);
      const short = v.replace(/^(\d+\.\d+)\.0$/, "$1");
      versionLink.href = P.baseRelativeUrl(`wiki/zqwy/updates-${short.replace(/\./g, "-")}.html`);
      versionLink.textContent = `v${short}`;
      versionLink.title = P.t("updateNote");
      element.appendChild(versionLink);
      parts.push(`v${short}`);
    }
    const tail = [];
    if (info.build) tail.push(`${P.t("buildNumber")} ${info.build}`);
    if (info.commit) tail.push(info.commit);
    if (tail.length) {
      element.appendChild(document.createTextNode(` · ${tail.join(" · ")}`));
      parts.push(...tail);
    }
    const label = parts.join(" · ") || info.label || "";
    if (!element.childNodes.length) element.textContent = label || P.t("buildUnavailable");
    const when = info.builtAt ? new Date(info.builtAt) : null;
    if (when && !Number.isNaN(when.getTime())) {
      const locale = { ru: "ru-RU", en: "en-GB", de: "de-DE" }[P.language] || "ru-RU";
      element.title = `${label} · ${when.toLocaleString(locale, {
        dateStyle: "short", timeStyle: "short",
      })}`;
    } else if (info.commit) {
      element.title = `${label} · ${info.commit}`;
    }
  }

  async function loadBuildInfo() {
    const element = document.getElementById("build-version");
    if (!element) return;
    if (P.buildInfoCache) { P.renderBuildInfo(element, P.buildInfoCache); return; }
    try {
      const response = await fetch(P.BUILD_INFO_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      P.buildInfoCache = await response.json();
      P.renderBuildInfo(element, P.buildInfoCache);
    } catch {
      element.textContent = P.t("buildUnavailable");
    }
  }}
