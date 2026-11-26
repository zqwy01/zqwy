/* Граф заметок: точка входа. Движки подключаются лениво, как в плеере. */
import { P, initContext } from "./context.js";
import { install as installUi } from "./ui.js";
import { install as installCore } from "./core.js";

initContext(P);
installUi(P);
installCore(P);

// Scripts are cached by module URL during SPA navigation, so re-entry into
// the graph page is handled by zqwy:pagechange inside core.js.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => P.init(), { once: true });
} else {
  P.init();
}
