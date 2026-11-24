// Игровые данные: карта, зоны, переходы, фрагменты и тексты.
// Подключайте этот файл обычным <script> перед основным игровым кодом,
// либо импортируйте, если проект использует ES-модули.
//
// Координаты: { x, y }, где x — столбец (0..gridSize.width-1), y — строка (0..gridSize.height-1).
// walkable — проходимые клетки. blocked — непроходимые (стены, обрывы, незавершённые линии).
// fragment — клетка с fragmentos воспоминаний (собирается один раз при первом входе).
// exit — клетка перехода к следующей зоне. exitLocked — выход закрыт, пока не выполнено условие.
// exitUnlockCondition — условие открытия выхода. Пока используется только тип "fragment_collected".

export const GAME_DATA = {
  saveVersion: 1,

  zones: [
    {
      id: "first_page",
      title: "Первая страница",
      gridSize: { width: 6, height: 6 },
      start: { x: 1, y: 1 },
      entry: { x: 1, y: 1 },
      exit: { x: 4, y: 4 },
      exitLocked: true,
      exitUnlockCondition: { type: "fragment_collected", zoneId: "first_page" },
      walkable: [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 },
        { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 },
        { x: 0, y: 2 }, { x: 1, y: 2 },                    { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 },
        { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 },
        { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 },
        { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }
      ],
      blocked: [
        { x: 2, y: 2 }
      ],
      fragment: { x: 3, y: 3 },
      companionLine: "Здесь всё только начинается.",
      memoryText: "Первый штрих на чистом листе. Я не знала, кто нарисовал меня, но чувствовала, что это начало чего-то важного."
    },

    {
      id: "path_in_cells",
      title: "Тропа в клетку",
      gridSize: { width: 6, height: 6 },
      start: { x: 1, y: 1 },
      entry: { x: 1, y: 1 },
      exit: { x: 4, y: 4 },
      exitLocked: true,
      exitUnlockCondition: { type: "fragment_collected", zoneId: "path_in_cells" },
      walkable: [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 },
        { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 },
        { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 },
        { x: 0, y: 3 },                    { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 },
        { x: 0, y: 4 },                    { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 },
        { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }
      ],
      blocked: [
        { x: 1, y: 3 },
        { x: 1, y: 4 }
      ],
      fragment: { x: 4, y: 2 },
      companionLine: "Тропа становится всё чётче.",
      memoryText: "Клетки превращались в дорожку. Каждый шаг прорисовывал мир вокруг меня чуть сильнее."
    },

    {
      id: "bridge_unfinished",
      title: "Мост по незаконченной линии",
      gridSize: { width: 6, height: 6 },
      start: { x: 1, y: 1 },
      entry: { x: 1, y: 1 },
      exit: { x: 4, y: 4 },
      exitLocked: true,
      exitUnlockCondition: { type: "fragment_collected", zoneId: "bridge_unfinished" },
      walkable: [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 },
        { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },                    { x: 4, y: 1 }, { x: 5, y: 1 },
        { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 },                    { x: 4, y: 2 }, { x: 5, y: 2 },
        { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 },                    { x: 4, y: 3 }, { x: 5, y: 3 },
        { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 },
        { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }
      ],
      blocked: [
        { x: 3, y: 1 },
        { x: 3, y: 2 },
        { x: 3, y: 3 }
      ],
      fragment: { x: 5, y: 3 },
      companionLine: "Линия обрывается, но можно додумать её до моста.",
      memoryText: "Незавершённый штрих стал мостом между двумя частями листа. Даже незаконченное может вести вперёд."
    },

    {
      id: "room_on_fields",
      title: "Комната на полях",
      gridSize: { width: 6, height: 6 },
      start: { x: 1, y: 1 },
      entry: { x: 1, y: 1 },
      exit: { x: 4, y: 4 },
      exitLocked: true,
      exitUnlockCondition: { type: "fragment_collected", zoneId: "room_on_fields" },
      walkable: [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 },
        { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 },
        { x: 0, y: 2 }, { x: 1, y: 2 },                    { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 },
        { x: 0, y: 3 }, { x: 1, y: 3 },                    { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 },
        { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 },
        { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }
      ],
      blocked: [
        { x: 2, y: 2 },
        { x: 2, y: 3 }
      ],
      fragment: { x: 1, y: 4 },
      companionLine: "Комната полна вещей, которых ещё нет.",
      memoryText: "Комната появилась из пустых клеток. В ней пахло старым карандашом и чистой бумагой."
    },

    {
      id: "garden_of_hearts",
      title: "Сад сердец",
      gridSize: { width: 6, height: 6 },
      start: { x: 1, y: 1 },
      entry: { x: 1, y: 1 },
      exit: { x: 4, y: 4 },
      exitLocked: true,
      exitUnlockCondition: { type: "fragment_collected", zoneId: "garden_of_hearts" },
      walkable: [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 },
        { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 },
        { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 },                    { x: 5, y: 2 },
        { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 },                    { x: 5, y: 3 },
        { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 },
        { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }
      ],
      blocked: [
        { x: 4, y: 2 },
        { x: 4, y: 3 }
      ],
      fragment: { x: 2, y: 4 },
      companionLine: "Сердечки здесь звенит тише всего.",
      memoryText: "Маленькие сердечки на полях — следы тех, кто помнил этот рисунок ещё до меня."
    },

    {
      id: "tower_of_sketches",
      title: "Башня набросков",
      gridSize: { width: 6, height: 6 },
      start: { x: 1, y: 1 },
      entry: { x: 1, y: 1 },
      exit: { x: 2, y: 5 },
      exitLocked: true,
      exitUnlockCondition: { type: "fragment_collected", zoneId: "tower_of_sketches" },
      walkable: [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 },
        { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 },
        { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 },
        { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 },
        { x: 0, y: 4 }, { x: 1, y: 4 },                    { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 },
        { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }
      ],
      blocked: [
        { x: 2, y: 4 },
        { x: 3, y: 4 }
      ],
      fragment: { x: 4, y: 2 },
      companionLine: "Выше и выше — к центру листа.",
      memoryText: "Башня росла из набросков, как память — слоёная, высокая, с видом на весь лист."
    },

    {
      id: "center_of_sheet",
      title: "Центр листа",
      gridSize: { width: 6, height: 6 },
      start: { x: 1, y: 1 },
      entry: { x: 1, y: 1 },
      exit: null,
      exitLocked: false,
      exitUnlockCondition: null,
      walkable: [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 },
        { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 },
        { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 },
        { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 },
        { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 },
        { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }
      ],
      blocked: [
        { x: 2, y: 2 },
        { x: 2, y: 3 }
      ],
      fragment: { x: 4, y: 4 },
      companionLine: "Вот зачем был создан этот рисунок.",
      memoryText: "Я поняла: меня нарисовали, чтобы эта память не пропала. И чтобы могла улететь за край страницы."
    }
  ],

  zoneOrder: [
    "first_page",
    "path_in_cells",
    "bridge_unfinished",
    "room_on_fields",
    "garden_of_hearts",
    "tower_of_sketches",
    "center_of_sheet"
  ],

  transitions: [
    { from: "first_page", to: "path_in_cells" },
    { from: "path_in_cells", to: "bridge_unfinished" },
    { from: "bridge_unfinished", to: "room_on_fields" },
    { from: "room_on_fields", to: "garden_of_hearts" },
    { from: "garden_of_hearts", to: "tower_of_sketches" },
    { from: "tower_of_sketches", to: "center_of_sheet" }
  ]
};
