/* Lazy, cached script loading for graph engines. No CDN at runtime. */

const pending = new Map();

export function loadVendorScript(href) {
  if (pending.has(href)) return pending.get(href);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let timer = 0;
    const finish = (callback, error) => {
      if (timer) window.clearTimeout(timer);
      callback(error);
    };
    script.src = href;
    script.async = false;
    script.onload = () => finish(resolve);
    script.onerror = () => finish(reject, new Error(`Failed to load ${href}`));
    // A request that never settles fires neither onload nor onerror. Without a
    // deadline the loading overlay would stay up forever.
    timer = window.setTimeout(() => {
      const error = new Error(`Loading timed out: ${href}`);
      error.name = "TimeoutError";
      error.transient = true;
      script.remove();
      finish(reject, error);
    }, 15000);
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
