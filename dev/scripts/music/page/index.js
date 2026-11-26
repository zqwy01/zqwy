/* Страница музыки: каталог релизов, обложки, режимы просмотра и обращение к плееру.
 *
 * music.js — тонкая точка входа; реализация разбита по модулям
 * в этой папке. Общий контекст P хранит состояние, как и раньше единый IIFE.
 */

import { P, initContext } from "./context.js";
import { install as install_0 } from "./catalog.js";
import { install as install_1 } from "./covers.js";
import { bindEvents } from "./events.js";
import { install as install_3 } from "./init.js";
import { install as install_4 } from "./utils.js";
import { install as install_5 } from "./view.js";

install_0(P);
install_1(P);
install_3(P);
install_4(P);
install_5(P);
initContext(P);
bindEvents(P);
