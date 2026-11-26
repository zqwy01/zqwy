/* Подсветка карточек акцентным цветом и курсором.
 *
 * hover-glow.js — тонкая точка входа; реализация разбита по модулям
 * в этой папке. Общий контекст P хранит состояние, как и раньше единый IIFE.
 */

import { P, initContext } from "./context.js";
import { install as install_0 } from "./accents.js";
import { bindEvents } from "./events.js";

install_0(P);
initContext(P);
bindEvents(P);
