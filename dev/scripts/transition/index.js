/* SPA-переходы: анимация страниц, отложенный лоадер и загрузка ассетов.
 *
 * transition.js — тонкая точка входа; реализация разбита по модулям
 * в этой папке. Общий контекст P хранит состояние, как и раньше единый IIFE.
 */

import { P, initContext } from "./context.js";
import { bindEvents } from "./events.js";
import { install as install_1 } from "./loader.js";
import { install as install_2 } from "./motion.js";
import { install as install_3 } from "./navigation.js";
import { install as install_4 } from "./preload.js";

install_1(P);
install_2(P);
install_3(P);
install_4(P);
initContext(P);
bindEvents(P);
