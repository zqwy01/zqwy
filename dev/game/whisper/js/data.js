/* УШКО — curated data.
   The phrases are short enough for one breath. Most come from the note
   src/notes/rhymes/whisper.md; two are pulled from older notes in src/notes/
   so the game reads the same voice as the rest of the zqwy archive. */
(function () {
  'use strict';

  window.USHKO_DATA = {
    version: 1,

    phrases: [
      { id: 'w01', text: 'Тише. Ушко уже дышит спокойнее.', source: 'rhymes/whisper.md' },
      { id: 'w02', text: 'Слушай, как шерсть слушает голос.', source: 'rhymes/whisper.md' },
      { id: 'w03', text: 'Я рядом. Я только шепчу.', source: 'rhymes/whisper.md' },
      { id: 'w04', text: 'Левое ухо слышит дождь, правое — шаги.', source: 'rhymes/whisper.md' },
      { id: 'w05', text: 'Не торопись. Ночь ещё не кончилась.', source: 'rhymes/whisper.md' },
      { id: 'w06', text: 'Слово легло, как ладонь.', source: 'rhymes/whisper.md' },
      { id: 'w07', text: 'Даже тишина здесь умеет слушать.', source: 'rhymes/whisper.md' },
      { id: 'w08', text: 'Пусть громкое останется за стеной.', source: 'rhymes/whisper.md' },
      { id: 'w09', text: 'Спи, Ушко. Я почитаю ещё чуть-чуть.', source: 'rhymes/whisper.md' },
      { id: 'w10', text: 'Звук на то и звук: его нужно слушать, а не читать.', source: 'phi/sound_but_text.md' },
      { id: 'w11', text: 'Эстетика: инди-фолк. Слушать: Леонарда Коэна.', source: 'aesthics/folk.md' },
      { id: 'w12', text: 'Не кормят бедолагу, а снизу надпись: «Стоит по воли».', source: 'rhymes/bedolapa.md' }
    ],

    /* mechanic order follows the brief:
       volume → ear → tempo → pitch → everything with a drifting comfort zone */
    nights: [
      {
        id: 1,
        title: 'Тихий старт',
        kicker: 'НОЧЬ 1',
        hint: 'Найди мягкую громкость. Ушко чуткое: чуть громче — и уже вздрагивает.',
        mechanics: ['volume'],
        drift: false,
        zoneWidth: 0.12
      },
      {
        id: 2,
        title: 'Чуткое ушко',
        kicker: 'НОЧЬ 2',
        hint: 'Смотри, какое ушко светится. Ошибся ухом — Ушко теряет внимание.',
        mechanics: ['volume', 'ear'],
        drift: false,
        zoneWidth: 0.11
      },
      {
        id: 3,
        title: 'Ритм дыхания',
        kicker: 'НОЧЬ 3',
        hint: 'Темп тоже важен. Слишком быстро — страшно, слишком медленно — Ушко засыпает не там.',
        mechanics: ['volume', 'ear', 'tempo'],
        drift: false,
        zoneWidth: 0.10
      },
      {
        id: 4,
        title: 'Низкий шёпот',
        kicker: 'НОЧЬ 4',
        hint: 'Высокий голос колет ушки. Держи шёпот низким, тёплым и ровным.',
        mechanics: ['volume', 'ear', 'tempo', 'pitch'],
        drift: false,
        zoneWidth: 0.09
      },
      {
        id: 5,
        title: 'Беспокойная ночь',
        kicker: 'НОЧЬ 5',
        hint: 'Зона комфорта ускользает. Следи за Ушком, подстраивайся и не отпускай кнопку надолго.',
        mechanics: ['volume', 'ear', 'tempo', 'pitch'],
        drift: true,
        zoneWidth: 0.08
      }
    ],

    achievements: [
      { id: 'first-calm', title: 'Первый шёпот', desc: 'Успокой Ушко в первую ночь.' },
      { id: 'both-ears', title: 'Оба уха', desc: 'Пройди ночь, шепча и в левое, и в правое ухо.' },
      { id: 'no-fear', title: 'Без страха', desc: 'Победи, ни разу не испугав Ушко.' },
      { id: 'perfect', title: 'Идеальный шёпот', desc: 'Получи три звезды за ночь.' },
      { id: 'five-nights', title: 'Пять ночей', desc: 'Пройди все пять ночей.' },
      { id: 'auto-pilot', title: 'Само спится', desc: 'Убаюкай Ушко в авто-игре.' }
    ]
  };
})();
