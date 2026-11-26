/* Lazy, cached script loading for graph engines. No CDN at runtime. */

const pending = new Map();

export function loadVendorScript(href) {
  if (pending.has(href)) return pending.get(href);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = href;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Не удалось загрузить ${href}`));
    document.head.appendChild(script);
  });
  pending.set(href, promise);
  promise.catch(() => pending.delete(href));
  return promise;
}

export async function loadVendorScripts(base, files, onProgress) {
  const prefix = String(base || "").replace(/\/?$/, "/");
  const total = files.length;
  for (const [index, file] of files.entries()) {
    onProgress?.({ file, index: index + 1, total });
    await loadVendorScript(prefix + file);
  }
}

export function vendorUrl(base, file) {
  return String(base || "").replace(/\/?$/, "/") + file;
}
