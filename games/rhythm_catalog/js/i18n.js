/* РИТМ-КАТАЛОГ — interface translations.
   RU is the original voice; EN mirrors it. The dictionary also powers the
   canvas HUD, so both DOM screens and in-game labels switch together. */
(function () {
  'use strict';

  const DICT = {
    ru: {
      'meta.title': 'РИТМ-КАТАЛОГ — ритм-игра по всей музыке zqwy',
      'common.on': 'ВКЛ',
      'common.off': 'ВЫКЛ',
      'common.ms': 'МС',

      'hud.pause': 'Пауза',
      'hud.stage': 'Ритмическая сцена',
      'aria.less': 'Меньше',
      'aria.more': 'Больше',
      'aria.quieter': 'Тише',
      'aria.louder': 'Громче',

      'menu.eyebrow': 'ZQWY · ВСЯ МУЗЫКА',
      'menu.titleHtml': 'РИТМ<span class="title-dot">·</span>КАТАЛОГ',
      'menu.tagline': 'Четыре полосы. Все альбомы. Один поток.',
      'menu.statAlbums': 'АЛЬБОМОВ',
      'menu.statTracks': 'ТРЕКОВ',
      'menu.statBest': 'ЛУЧШИЙ СЧЁТ',
      'menu.enter': 'ОТКРЫТЬ КАТАЛОГ',
      'menu.hintKeys': 'D F J K · СТРЕЛКИ · ТАЧ ПО ПОЛОСАМ',
      'menu.hintAudio': 'НАУШНИКИ РЕКОМЕНДУЮТСЯ · ESC — ПАУЗА',
      'menu.language': 'ЯЗЫК',

      'select.eyebrow': 'КАТАЛОГ',
      'select.trackCount.one': '{n} ТРЕК',
      'select.trackCount.few': '{n} ТРЕКА',
      'select.trackCount.many': '{n} ТРЕКОВ',
      'select.menu': 'МЕНЮ',
      'select.albums': 'АЛЬБОМЫ',
      'select.duration': 'ДЛИТ.',
      'select.bpm': 'BPM',
      'select.diff': 'СЛОЖН.',
      'select.notes': 'НОТ',
      'select.record': 'РЕКОРД · {score} · {rank} · {acc}%',
      'select.notPlayed': 'РЕКОРД · ЕЩЁ НЕ СЫГРАН',
      'select.play': 'ИГРАТЬ',
      'select.hint': 'ENTER — ИГРАТЬ · ↑↓ — ТРЕК · ←→ — АЛЬБОМ',
      'select.back': 'В меню',
      'select.sheetTitle': 'ВСЕ РЕЛИЗЫ',
      'select.sheetHint': 'ВЫБЕРИ АЛЬБОМ',
      'select.sheetClose': 'ЗАКРЫТЬ',

      'load.reading': 'ЧИТАЕМ ЧАРТ…',
      'load.chartReady': 'ЧАРТ ГОТОВ · ОТКРЫВАЕМ ЗВУК…',
      'load.streaming': 'СТРИМИМ ТРЕК…',
      'load.soundReady': 'ЗВУК ГОТОВ',
      'load.go': 'ПОЕХАЛИ',
      'load.loading': 'ЗАГРУЗКА',

      'ready.eyebrow': 'ГОТОВО',
      'ready.waiting': 'БРАУЗЕР ЖДЁТ ПОДТВЕРЖДЕНИЯ ЗВУКА',
      'ready.start': 'НАЧАТЬ',

      'pause.eyebrow': 'ПАУЗА',
      'pause.title': 'Тишина держит ритм',
      'pause.resume': 'ПРОДОЛЖИТЬ',
      'pause.restart': 'ЗАНОВО',
      'pause.quit': 'В КАТАЛОГ',
      'pause.offset': 'ЗАДЕРЖКА',
      'pause.volume': 'ГРОМКОСТЬ',
      'pause.sfx': 'ЗВУК УДАРОВ: {state}',
      'pause.offsetValue': '{value} {unit}',
      'pause.hint': 'ESC — ПРОДОЛЖИТЬ · R — ЗАНОВО · [ ] — ЗАДЕРЖКА · − = — ГРОМКОСТЬ · M — УДАРЫ',

      'result.eyebrow': 'АЛЬБОМ',
      'result.score': 'ОЧКИ',
      'result.accuracy': 'ТОЧНОСТЬ',
      'result.maxCombo': 'МАКС. КОМБО',
      'result.counts': 'ИДЕАЛЬНО {perfect} · ХОРОШО {good} · ТОЧНО {ok} · МИМО {miss}',
      'result.newBest': 'НОВЫЙ РЕКОРД · {score}',
      'result.best': 'ЛУЧШИЙ РЕЗУЛЬТАТ · {score} · {rank}',
      'result.retry': 'ЕЩЁ РАЗ',
      'result.next': 'СЛЕДУЮЩИЙ',
      'result.catalog': 'КАТАЛОГ',
      'result.hint': 'R — ЕЩЁ РАЗ · ENTER — СЛЕДУЮЩИЙ · ESC — КАТАЛОГ',

      'error.eyebrow': 'ОШИБКА',
      'error.title': 'ТРЕК НЕ ОТКРЫЛСЯ',
      'error.default': 'Проверь локальный сервер.',
      'error.back': 'В КАТАЛОГ',

      'boot.eyebrow': 'ZQWY · ВСЯ МУЗЫКА',
      'boot.collecting': 'СОБИРАЕМ КОЛЛЕКЦИЮ…',
      'boot.noCatalog': 'КАТАЛОГ НЕ НАЙДЕН · ЗАПУСТИ tools/build_catalog.py',
      'boot.noModules': 'НЕ ЗАГРУЗИЛИСЬ МОДУЛИ ИГРЫ',

      'hud.score': 'ОЧКИ',
      'hud.accuracy': 'ТОЧНОСТЬ',
      'hud.combo': 'КОМБО',
      'hud.fever': 'ФИВЕР',
      'hud.feverBadge': 'ФИВЕР ×2',
      'hud.flow': 'ПОТОК',
      'hud.ready': 'ПРИГОТОВЬСЯ',
      'hud.bpm': 'BPM',
      'hud.seconds': 'С',

      'judge.perfect': 'ИДЕАЛЬНО',
      'judge.good': 'ХОРОШО',
      'judge.ok': 'ТОЧНО',
      'judge.miss': 'МИМО',

      'rank.legend.name': 'ЛЕГЕНДА КАТАЛОГА',
      'rank.legend.sub': 'Весь зал знает твоё имя.',
      'rank.headliner.name': 'ХЕДЛАЙНЕР',
      'rank.headliner.sub': 'Свет сцены держится на тебе.',
      'rank.resident.name': 'РЕЗИДЕНТ',
      'rank.resident.sub': 'Пульс найден, поток держится.',
      'rank.participant.name': 'УЧАСТНИК',
      'rank.participant.sub': 'Ещё пара треков до идеала.',
      'rank.listener.name': 'СЛУШАТЕЛЬ',
      'rank.listener.sub': 'Лови момент и не спеши.',
      'rank.debut.name': 'ДЕБЮТ',
      'rank.debut.sub': 'Каждый ритм начинается с первого удара.',

      'section.intro.name': 'ВСТУПЛЕНИЕ',
      'section.intro.sub': 'Первый вдох трека.',
      'section.build.name': 'РАЗГОН',
      'section.build.sub': 'Рисунок набирает силу.',
      'section.theme.name': 'ОСНОВНАЯ ТЕМА',
      'section.theme.sub': 'Держи пульс.',
      'section.drop.name': 'УДАР',
      'section.drop.sub': 'Низ пробивает пол.',
      'section.climax.name': 'КУЛЬМИНАЦИЯ',
      'section.climax.sub': 'Всё звучит сразу.',
      'section.break.name': 'ПЕРЕДЫШКА',
      'section.break.sub': 'Свет становится тише.',
      'section.outro.name': 'ФИНАЛ',
      'section.outro.sub': 'Последний такт.',

      'toast.offset': 'ЗАДЕРЖКА {value} {unit}',
      'toast.volume': 'ГРОМКОСТЬ {value}%',
      'toast.sfx': 'ЗВУК УДАРОВ {state}'
    },

    en: {
      'meta.title': 'RHYTHM CATALOG — a rhythm game for all of zqwy\'s music',
      'common.on': 'ON',
      'common.off': 'OFF',
      'common.ms': 'MS',

      'hud.pause': 'Pause',
      'hud.stage': 'Rhythm stage',
      'aria.less': 'Less',
      'aria.more': 'More',
      'aria.quieter': 'Quieter',
      'aria.louder': 'Louder',

      'menu.eyebrow': 'ZQWY · ALL THE MUSIC',
      'menu.titleHtml': 'RHYTHM<span class="title-dot">·</span>CATALOG',
      'menu.tagline': 'Four lanes. Every album. One continuous flow.',
      'menu.statAlbums': 'ALBUMS',
      'menu.statTracks': 'TRACKS',
      'menu.statBest': 'BEST SCORE',
      'menu.enter': 'OPEN THE CATALOG',
      'menu.hintKeys': 'D F J K · ARROWS · TAP THE LANES',
      'menu.hintAudio': 'HEADPHONES RECOMMENDED · ESC — PAUSE',
      'menu.language': 'LANGUAGE',

      'select.eyebrow': 'CATALOG',
      'select.trackCount.one': '{n} TRACK',
      'select.trackCount.few': '{n} TRACKS',
      'select.trackCount.many': '{n} TRACKS',
      'select.menu': 'MENU',
      'select.albums': 'ALBUMS',
      'select.duration': 'TIME',
      'select.bpm': 'BPM',
      'select.diff': 'DIFF.',
      'select.notes': 'NOTES',
      'select.record': 'BEST · {score} · {rank} · {acc}%',
      'select.notPlayed': 'BEST · NOT PLAYED YET',
      'select.play': 'PLAY',
      'select.hint': 'ENTER — PLAY · ↑↓ — TRACK · ←→ — ALBUM',
      'select.back': 'Back to menu',
      'select.sheetTitle': 'ALL RELEASES',
      'select.sheetHint': 'PICK AN ALBUM',
      'select.sheetClose': 'CLOSE',

      'load.reading': 'READING THE CHART…',
      'load.chartReady': 'CHART READY · OPENING AUDIO…',
      'load.streaming': 'STREAMING THE TRACK…',
      'load.soundReady': 'AUDIO READY',
      'load.go': 'HERE WE GO',
      'load.loading': 'LOADING',

      'ready.eyebrow': 'READY',
      'ready.waiting': 'YOUR BROWSER NEEDS A SOUND CONFIRMATION',
      'ready.start': 'START',

      'pause.eyebrow': 'PAUSED',
      'pause.title': 'Silence keeps the rhythm',
      'pause.resume': 'RESUME',
      'pause.restart': 'RESTART',
      'pause.quit': 'TO CATALOG',
      'pause.offset': 'OFFSET',
      'pause.volume': 'VOLUME',
      'pause.sfx': 'HIT SOUND: {state}',
      'pause.offsetValue': '{value} {unit}',
      'pause.hint': 'ESC — RESUME · R — RESTART · [ ] — OFFSET · − = — VOLUME · M — HITS',

      'result.eyebrow': 'ALBUM',
      'result.score': 'SCORE',
      'result.accuracy': 'ACCURACY',
      'result.maxCombo': 'MAX COMBO',
      'result.counts': 'PERFECT {perfect} · GOOD {good} · OK {ok} · MISS {miss}',
      'result.newBest': 'NEW RECORD · {score}',
      'result.best': 'PERSONAL BEST · {score} · {rank}',
      'result.retry': 'PLAY AGAIN',
      'result.next': 'NEXT TRACK',
      'result.catalog': 'CATALOG',
      'result.hint': 'R — PLAY AGAIN · ENTER — NEXT TRACK · ESC — CATALOG',

      'error.eyebrow': 'ERROR',
      'error.title': 'THE TRACK COULD NOT OPEN',
      'error.default': 'Check the local server.',
      'error.back': 'TO CATALOG',

      'boot.eyebrow': 'ZQWY · ALL THE MUSIC',
      'boot.collecting': 'ASSEMBLING THE COLLECTION…',
      'boot.noCatalog': 'CATALOG NOT FOUND · RUN tools/build_catalog.py',
      'boot.noModules': 'GAME MODULES FAILED TO LOAD',

      'hud.score': 'SCORE',
      'hud.accuracy': 'ACCURACY',
      'hud.combo': 'COMBO',
      'hud.fever': 'FEVER',
      'hud.feverBadge': 'FEVER ×2',
      'hud.flow': 'FLOW',
      'hud.ready': 'GET READY',
      'hud.bpm': 'BPM',
      'hud.seconds': 'S',

      'judge.perfect': 'PERFECT',
      'judge.good': 'GOOD',
      'judge.ok': 'OK',
      'judge.miss': 'MISS',

      'rank.legend.name': 'CATALOG LEGEND',
      'rank.legend.sub': 'The whole room knows your name.',
      'rank.headliner.name': 'HEADLINER',
      'rank.headliner.sub': 'The stage light rests on you.',
      'rank.resident.name': 'RESIDENT',
      'rank.resident.sub': 'The pulse is found; the flow holds.',
      'rank.participant.name': 'CONTENDER',
      'rank.participant.sub': 'A couple of tracks from perfect.',
      'rank.listener.name': 'LISTENER',
      'rank.listener.sub': 'Catch the moment. Do not rush.',
      'rank.debut.name': 'DEBUT',
      'rank.debut.sub': 'Every rhythm starts with a single hit.',

      'section.intro.name': 'INTRO',
      'section.intro.sub': 'The first breath of the track.',
      'section.build.name': 'BUILD',
      'section.build.sub': 'The pattern gathers force.',
      'section.theme.name': 'MAIN THEME',
      'section.theme.sub': 'Hold the pulse.',
      'section.drop.name': 'DROP',
      'section.drop.sub': 'The low end hits the floor.',
      'section.climax.name': 'CLIMAX',
      'section.climax.sub': 'Everything sounds at once.',
      'section.break.name': 'BREAK',
      'section.break.sub': 'The light goes quiet.',
      'section.outro.name': 'OUTRO',
      'section.outro.sub': 'The final bar.',

      'toast.offset': 'OFFSET {value} {unit}',
      'toast.volume': 'VOLUME {value}%',
      'toast.sfx': 'HIT SOUND {state}'
    }
  };

  const LANGS = ['ru', 'en'];
  let lang = 'ru';

  function normalize(value) {
    const v = String(value || '').toLowerCase();
    return LANGS.indexOf(v) >= 0 ? v : 'ru';
  }

  function t(key, vars) {
    const table = DICT[lang] || DICT.ru;
    let text = table[key];
    if (text === undefined) text = DICT.ru[key];
    if (text === undefined) return key;
    if (vars) {
      text = text.replace(/\{(\w+)\}/g, function (m, name) {
        return vars[name] === undefined ? m : String(vars[name]);
      });
    }
    return text;
  }

  function count(key, n, vars) {
    const num = Number(n) || 0;
    let suffix;
    if (lang === 'ru') {
      const n10 = num % 10;
      const n100 = num % 100;
      if (n10 === 1 && n100 !== 11) suffix = 'one';
      else if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) suffix = 'few';
      else suffix = 'many';
    } else {
      suffix = num === 1 ? 'one' : 'many';
    }
    const args = Object.assign({}, vars || {}, { n: num });
    return t(key + '.' + suffix, args);
  }

  function apply(root) {
    root = root || document;
    document.documentElement.lang = lang;
    document.title = t('meta.title');

    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    root.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
    root.querySelectorAll('[data-lang]').forEach(function (el) {
      const on = el.dataset.lang === lang;
      el.classList.toggle('active', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function setLang(next, root) {
    const value = normalize(next);
    const changed = value !== lang;
    lang = value;
    apply(root);
    if (changed && typeof window.CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('rhythm:lang', { detail: { lang: lang } }));
    }
    return lang;
  }

  window.RhythmI18n = {
    DICT: DICT,
    LANGS: LANGS,
    t: t,
    count: count,
    apply: apply,
    setLang: setLang,
    normalize: normalize,
    get lang() { return lang; }
  };
})();
