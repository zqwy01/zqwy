/* menu/settings.js — модуль скрипта menu.js. */
export function install(P) {
  Object.assign(P, { setSavedMessage, readSettings, saveSettings, loadSettings });


  /* ---------- settings (site-wide) ---------- */

  function setSavedMessage(message, timeout = 2000) {
    if (!P.els.saved) return;
    if (P.savedTimer) { window.clearTimeout(P.savedTimer); P.savedTimer = 0; }
    P.els.saved.textContent = message;
    if (timeout > 0) {
      P.savedTimer = window.setTimeout(() => {
        if (P.els.saved) P.els.saved.textContent = "";
        P.savedTimer = 0;
      }, timeout);
    }
  }

  function readSettings() {
    try {
      const raw = localStorage.getItem(P.SETTINGS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function saveSettings(extra = {}, silent = false) {
    const base = P.readSettings() || {};
    const form = P.els.settingsForm;
    const graphEngines = form
      ? {}
      : (base.graphEngines && typeof base.graphEngines === "object" ? { ...base.graphEngines } : {});
    // The settings form only exists on the home page. Pages without it must
    // preserve the previously saved engine list instead of clearing it.
    form?.querySelectorAll("input[data-graph-engine]").forEach((input) => {
      graphEngines[input.dataset.graphEngine || input.value] = input.checked;
    });
    const settings = {
      ...base,
      theme: form?.querySelector('input[name="theme"]:checked')?.value || base.theme || "dark",
      rememberQuery: form
        ? !!form.querySelector('input[name="rememberQuery"]')?.checked
        : !!base.rememberQuery,
      language: form?.querySelector('input[name="language"]:checked')?.value || base.language || "ru",
      graphEngines,
      ...extra,
    };
    try { localStorage.setItem(P.SETTINGS_KEY, JSON.stringify(settings)); } catch {}
    P.applyTheme(settings.theme);
    P.applyLanguage(settings.language);
    P.loadBuildInfo();
    if (!silent) P.setSavedMessage(P.t("saved"));
  }

  function loadSettings() {
    const settings = P.readSettings() || { theme: "dark", rememberQuery: false, language: "ru" };
    const effectiveTheme = P.previewTheme || settings.theme || "dark";
    const effectiveLanguage = P.previewLanguage || settings.language || "ru";
    P.applyTheme(effectiveTheme);
    P.applyLanguage(effectiveLanguage);
    if (P.els.settingsForm) {
      const radio = P.els.settingsForm.querySelector(`input[name="theme"][value="${effectiveTheme}"]`);
      if (radio) radio.checked = true;
      const remember = P.els.settingsForm.querySelector('input[name="rememberQuery"]');
      if (remember) remember.checked = !!settings.rememberQuery;
      const langRadio = P.els.settingsForm.querySelector(`input[name="language"][value="${effectiveLanguage}"]`);
      if (langRadio) langRadio.checked = true;
      const graphEngines = settings.graphEngines || {};
      P.els.settingsForm.querySelectorAll("input[data-graph-engine]").forEach((input) => {
        const id = input.dataset.graphEngine || input.value;
        if (!input.disabled) input.checked = graphEngines[id] !== false;
      });
      if (P.els.input && settings.rememberQuery && settings.lastQuery) P.els.input.value = settings.lastQuery;
    }
  }}
