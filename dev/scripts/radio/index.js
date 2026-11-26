/* Радио: круглосуточная программа, расписание и управление плеером.
 *
 * radio.js — тонкая точка входа; реализация разбита по модулям
 * в этой папке. Общий контекст P хранит состояние, как и раньше единый IIFE.
 */

import { P, initContext } from "./context.js";
import { bindEvents } from "./events.js";
import { install as install_1 } from "./i18n.js";
import { install as install_2 } from "./init.js";
import { install as install_3 } from "./playback.js";
import { install as install_4 } from "./schedule.js";
import { install as install_5 } from "./settings.js";
import { install as install_6 } from "./ui.js";

install_1(P);
install_2(P);
install_3(P);
install_4(P);
install_5(P);
install_6(P);
initContext(P);
bindEvents(P);
