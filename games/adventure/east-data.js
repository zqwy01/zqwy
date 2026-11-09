// Content and command definitions for the browser prototype.
// Narrative fields are bilingual objects: { ru, en }. The i18n `pick` helper
// resolves them at render time.

export const UI_TEXT = {
  title: { ru: 'К ВОСТОКУ', en: 'TO THE EAST' },
  subtitle: { ru: 'Лабиринт сознаний', en: 'Labyrinth of minds' },
};

export const PROLOGUE = {
  kicker: { ru: 'внутри', en: 'inside' },
  title: { ru: 'К ВОСТОКУ', en: 'TO THE EAST' },
  paragraphs: [
    {
      ru: 'Земик уже здесь. Лабиринт не начинается за дверью и не заканчивается за поворотом — он тянется во все стороны, и его комнаты помнят шаги.',
      en: 'Zemic is already here. The labyrinth does not begin behind a door or end around a corner — it stretches in every direction, and its rooms remember your steps.',
    },
    {
      ru: 'В центре — Скрижаль. После гибели душа возвращается к ней, а рюкзак остаётся там, где оборвался путь. За ним можно вернуться.',
      en: 'At the centre stands the Tablet. After death the soul returns to it, while the backpack stays where the path broke. You can go back for it.',
    },
    {
      ru: 'Сначала — осмотреться. Потом — идти глубже.',
      en: 'First, look around. Then go deeper.',
    },
  ],
  hint: {
    ru: 'WASD / стрелки — движение · E — действие · Shift / Space — рывок · ЛКМ — маршрут или следование · «холст» — рабочее пространство',
    en: 'WASD / arrows — move · E — action · Shift / Space — dash · LMB — route or follow · “board” — workspace',
  },
  button: { ru: 'Сделать шаг', en: 'Take a step' },
};

export const TUTORIAL_LINES = ['tutorial.0', 'tutorial.1'];

// ---------------------------------------------------------------------------
// Command registry. `aliases` are accepted in both languages. `unlock` names a
// story flag/condition checked by east-core.js. Locked commands never reach the
// help text or the canvas palette.

export const COMMANDS = [
  {
    id: 'look',
    icon: '◉',
    command: 'осмотреться',
    aliases: ['осмотреться', 'осмотреть', 'look', 'look around'],
    title: { ru: 'Осмотреться', en: 'Look around' },
    actionLabel: { ru: 'Осмотреть', en: 'Look' },
    description: {
      ru: 'Короткий ответ мира о текущей комнате.',
      en: 'A short answer from the world about the current room.',
    },
    palette: true,
    help: { ru: 'осмотреться — описать комнату', en: 'look — describe the room' },
  },
  {
    id: 'pack',
    icon: '▣',
    command: 'рюкзак',
    aliases: ['рюкзак', 'инвентарь', 'pack', 'inventory'],
    title: { ru: 'Рюкзак', en: 'Backpack' },
    actionLabel: { ru: 'Проверить', en: 'Check' },
    description: {
      ru: 'Что сейчас при тебе и где остались рюкзаки.',
      en: 'What you carry now and where lost backpacks remain.',
    },
    unlock: 'introSeen',
    palette: true,
    help: { ru: 'рюкзак — содержимое и потерянные рюкзаки', en: 'pack — contents and lost backpacks' },
  },
  {
    id: 'canvas',
    icon: '⌗',
    command: 'холст',
    aliases: ['холст', 'canvas', 'board'],
    title: { ru: 'Холст', en: 'Board' },
    actionLabel: { ru: 'Открыть', en: 'Open' },
    description: {
      ru: 'Открыть рабочее пространство терминала.',
      en: 'Open the terminal workspace board.',
    },
    palette: true,
    help: { ru: 'холст — бесконечный рабочий стол', en: 'board — endless workspace table' },
  },
  {
    id: 'story',
    icon: '⇢',
    command: 'сюжет',
    aliases: ['сюжет', 'схема', 'story', 'plot'],
    title: { ru: 'Сюжет', en: 'Story' },
    actionLabel: { ru: 'Открыть', en: 'Open' },
    description: {
      ru: 'Сюжетная схема с последовательностями и ветками.',
      en: 'Plot table with sequences and branches.',
    },
    unlock: 'introSeen',
    palette: true,
    help: { ru: 'сюжет — схема истории', en: 'story — plot table' },
  },
  {
    id: 'history',
    icon: '↺',
    command: 'история',
    aliases: ['история', 'history'],
    title: { ru: 'История', en: 'History' },
    actionLabel: { ru: 'Показать', en: 'Show' },
    description: {
      ru: 'Запись использованных команд — тот же буфер, что и ↑/↓.',
      en: 'Record of used commands — the same buffer as ↑/↓.',
    },
    palette: true,
    help: { ru: 'история — использованные команды', en: 'history — used commands' },
  },
  {
    id: 'help',
    icon: '?',
    command: 'помоги',
    aliases: ['помоги', 'команды', 'help', 'commands'],
    title: { ru: 'Помощь', en: 'Help' },
    actionLabel: { ru: 'Показать', en: 'Show' },
    description: {
      ru: 'Список доступных команд. Закрытые команды скрыты.',
      en: 'List of available commands. Locked commands are hidden.',
    },
    palette: true,
    help: { ru: 'помоги — доступные команды', en: 'help — available commands' },
  },
  {
    id: 'take',
    icon: '✥',
    command: 'взять',
    aliases: ['взять', 'поднять', 'take', 'pick up'],
    title: { ru: 'Взять', en: 'Take' },
    actionLabel: { ru: 'Взять', en: 'Take' },
    description: {
      ru: 'Поднять рюкзак или предмет рядом с персонажем.',
      en: 'Pick up a nearby backpack or item.',
    },
    palette: false,
    help: { ru: 'взять — поднять то, что рядом', en: 'take — pick up what is nearby' },
  },
  {
    id: 'approach',
    icon: '↗',
    command: 'подойди',
    aliases: ['подойди', 'approach', 'come closer'],
    title: { ru: 'Подойди', en: 'Approach' },
    actionLabel: { ru: 'Подойти', en: 'Approach' },
    description: {
      ru: 'Плавно подойти к ближайшему объекту.',
      en: 'Walk smoothly to the nearest object.',
    },
    palette: false,
    help: { ru: 'подойди — подойти к ближайшему объекту', en: 'approach — walk to the nearest object' },
  },
  {
    id: 'stop',
    icon: '■',
    command: 'стоп',
    aliases: ['стоп', 'stop', 'halt'],
    title: { ru: 'Стоп', en: 'Stop' },
    actionLabel: { ru: 'Остановиться', en: 'Stop' },
    description: {
      ru: 'Остановить плавное движение и следование за курсором.',
      en: 'Stop smooth movement and cursor following.',
    },
    palette: false,
    help: { ru: 'стоп — остановить движение', en: 'stop — stop moving' },
  },
  {
    id: 'dash',
    icon: '≫',
    command: 'рывок',
    aliases: ['рывок', 'dash'],
    title: { ru: 'Рывок', en: 'Dash' },
    actionLabel: { ru: 'Рвануть', en: 'Dash' },
    description: {
      ru: 'Короткий рывок в последнем направлении движения.',
      en: 'A short dash in the last movement direction.',
    },
    palette: false,
    help: { ru: 'рывок — короткий рывок', en: 'dash — short dash' },
  },
  {
    id: 'clear',
    icon: '⌫',
    command: 'очисти',
    aliases: ['очисти', 'clear'],
    title: { ru: 'Очистить', en: 'Clear' },
    actionLabel: { ru: 'Очистить', en: 'Clear' },
    description: {
      ru: 'Очистить запись действий терминала.',
      en: 'Clear the terminal action record.',
    },
    palette: false,
    help: { ru: 'очисти — очистить запись действий', en: 'clear — clear the action record' },
  },
  {
    id: 'sound',
    icon: '♪',
    command: 'звук',
    aliases: ['звук', 'sound', 'audio'],
    title: { ru: 'Звук', en: 'Sound' },
    actionLabel: { ru: 'Переключить', en: 'Toggle' },
    description: {
      ru: 'Включить или выключить звук.',
      en: 'Turn sound on or off.',
    },
    palette: false,
    help: { ru: 'звук — включить или выключить звук', en: 'sound — toggle sound' },
  },
  {
    id: 'language',
    icon: '文',
    command: 'язык',
    aliases: ['язык', 'language', 'lang'],
    title: { ru: 'Язык', en: 'Language' },
    actionLabel: { ru: 'Переключить', en: 'Switch' },
    description: {
      ru: 'Переключить язык интерфейса, команд и подсказок.',
      en: 'Switch the language of the interface, commands and hints.',
    },
    palette: false,
    help: { ru: 'язык · language — переключить язык', en: 'language · язык — switch language' },
  },
  {
    id: 'settings',
    icon: '⚙',
    command: 'настройки',
    aliases: ['настройки', 'settings', 'options'],
    title: { ru: 'Настройки', en: 'Settings' },
    actionLabel: { ru: 'Открыть', en: 'Open' },
    description: {
      ru: 'Общие настройки, запись действий, музыка и сохранения.',
      en: 'General settings, action record, music and saves.',
    },
    palette: false,
    help: { ru: 'настройки — общие настройки', en: 'settings — general settings' },
  },
  {
    id: 'reset',
    icon: '⟲',
    command: 'сброс',
    aliases: ['сброс', 'reset'],
    title: { ru: 'Сброс', en: 'Reset' },
    actionLabel: { ru: 'Сбросить', en: 'Reset' },
    description: {
      ru: 'Начать лабиринт заново. Спросит подтверждение.',
      en: 'Start the labyrinth again. Asks for confirmation.',
    },
    unlock: 'introSeen',
    palette: false,
    help: { ru: 'сброс — начать заново (спросит подтверждение)', en: 'reset — start over (asks for confirmation)' },
  },
  {
    id: 'charm',
    icon: '❦',
    command: 'очарование',
    aliases: ['очарование', 'charm'],
    title: { ru: 'Очарование', en: 'Charm' },
    actionLabel: { ru: 'Откликнуться', en: 'Answer' },
    description: {
      ru: 'Применить карту «Очарование».',
      en: 'Use the “Charm” card.',
    },
    unlock: 'has:charm',
    palette: false,
    help: { ru: 'очарование · charm — применить карту', en: 'charm · очарование — use the card' },
  },
  {
    id: 'chalk',
    icon: '✦',
    command: 'мел',
    aliases: ['мел', 'chalk'],
    title: { ru: 'Мел', en: 'Chalk' },
    actionLabel: { ru: 'Провести черту', en: 'Draw a line' },
    description: {
      ru: 'Оставить черту мелом на полу комнаты.',
      en: 'Leave a chalk line on the room floor.',
    },
    unlock: 'has:chalk',
    palette: false,
    help: { ru: 'мел · chalk — оставить отметку в комнате', en: 'chalk · мел — mark the room' },
  },
  {
    id: 'card',
    icon: '▤',
    command: 'карта',
    aliases: ['карта', 'cards', 'card'],
    title: { ru: 'Карта', en: 'Card' },
    actionLabel: { ru: 'Посмотреть', en: 'View' },
    description: {
      ru: 'Посмотреть открытые карты.',
      en: 'View unlocked cards.',
    },
    unlock: 'seenCard',
    palette: false,
    help: { ru: 'карта — открытые карты', en: 'card — unlocked cards' },
  },
];

const WALK_COMMANDS = [
  {
    id: 'walk-up',
    icon: '↑',
    command: 'идти вверх',
    aliases: ['идти вверх', 'go up', 'walk up', 'вверх', 'up'],
    title: { ru: 'Идти вверх', en: 'Go up' },
    actionLabel: { ru: 'Идти', en: 'Walk' },
    description: { ru: 'Плавно идти вверх. Можно указать секунды.', en: 'Walk smoothly up. Seconds may be specified.' },
    palette: false,
    help: { ru: 'идти вверх [секунды]', en: 'go up [seconds]' },
    walk: { x: 0, y: -1, direction: 'up' },
  },
  {
    id: 'walk-down',
    icon: '↓',
    command: 'идти вниз',
    aliases: ['идти вниз', 'go down', 'walk down', 'вниз', 'down'],
    title: { ru: 'Идти вниз', en: 'Go down' },
    actionLabel: { ru: 'Идти', en: 'Walk' },
    description: { ru: 'Плавно идти вниз. Можно указать секунды.', en: 'Walk smoothly down. Seconds may be specified.' },
    palette: false,
    help: { ru: 'идти вниз [секунды]', en: 'go down [seconds]' },
    walk: { x: 0, y: 1, direction: 'down' },
  },
  {
    id: 'walk-left',
    icon: '←',
    command: 'идти влево',
    aliases: ['идти влево', 'go left', 'walk left', 'влево', 'left'],
    title: { ru: 'Идти влево', en: 'Go left' },
    actionLabel: { ru: 'Идти', en: 'Walk' },
    description: { ru: 'Плавно идти влево. Можно указать секунды.', en: 'Walk smoothly left. Seconds may be specified.' },
    palette: false,
    help: { ru: 'идти влево [секунды]', en: 'go left [seconds]' },
    walk: { x: -1, y: 0, direction: 'left' },
  },
  {
    id: 'walk-right',
    icon: '→',
    command: 'идти вправо',
    aliases: ['идти вправо', 'go right', 'walk right', 'вправо', 'right'],
    title: { ru: 'Идти вправо', en: 'Go right' },
    actionLabel: { ru: 'Идти', en: 'Walk' },
    description: { ru: 'Плавно идти вправо. Можно указать секунды.', en: 'Walk smoothly right. Seconds may be specified.' },
    palette: false,
    help: { ru: 'идти вправо [секунды]', en: 'go right [seconds]' },
    walk: { x: 1, y: 0, direction: 'right' },
  },
];

export const WALK_COMMAND_LIST = WALK_COMMANDS;

export const COMMAND_BY_ID = Object.fromEntries(
  [...COMMANDS, ...WALK_COMMANDS].map((command) => [command.id, command]),
);

export const BUILTIN_COMMANDS = COMMANDS.filter((command) => command.palette);

export function commandForAlias(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  return [...COMMANDS, ...WALK_COMMANDS].find((command) => (
    command.aliases.includes(normalized)
  )) || null;
}

export const ITEM_DEFS = {
  chalk: {
    id: 'chalk',
    command: 'мел',
    aliases: ['мел', 'chalk'],
    icon: '✦',
    title: { ru: 'Обломок мела', en: 'Chalk shard' },
    actionLabel: { ru: 'Провести черту', en: 'Draw a line' },
    description: {
      ru: 'Тёплый обломок, найденный в кладовой. Оставляет след на полу комнаты.',
      en: 'A warm shard found in the pantry. It leaves a mark on the room floor.',
    },
  },
  charm: {
    id: 'charm',
    command: 'очарование',
    aliases: ['очарование', 'charm'],
    icon: '❦',
    title: { ru: 'Очарование', en: 'Charm' },
    actionLabel: { ru: 'Откликнуться', en: 'Answer' },
    card: true,
    art: '/asset/angel.webp',
    artAlt: {
      ru: 'Карандашный рисунок крылатой фантастической девушки на клетчатой бумаге',
      en: 'Pencil drawing of a winged fantasy girl on graph paper',
    },
    kicker: { ru: 'первая карта', en: 'first card' },
    description: {
      ru: 'Карта с нежным карандашным рисунком. Ты чувствуешь отклик, но его смысл пока не открыт.',
      en: 'A card with a soft pencil drawing. You feel an answer, but its meaning is not open yet.',
    },
    note: {
      ru: 'Временная техническая заглушка: конкретный эффект способности не подключён.',
      en: 'Temporary technical placeholder: the concrete ability effect is not connected.',
    },
  },
};

export const CARD_ORDER = ['charm'];

export const ROOM_COPY = {
  tablet: {
    look: {
      ru: 'Скрижаль стоит в центре комнаты. Плоский камень, исчерченный линиями, которые не складываются в знакомый знак. Воздух здесь неподвижен, но это не безопасность — только точка, к которой возвращается душа.',
      en: 'The Tablet stands at the centre of the room. A flat stone covered in lines that do not form a familiar sign. The air is still, but this is not safety — only the point to which the soul returns.',
    },
    whisper: {
      ru: 'Скрижаль молчит. Она не просит защищать её и не обещает покоя.',
      en: 'The Tablet is silent. It does not ask to be protected and does not promise peace.',
    },
  },
  danger: {
    look: {
      ru: 'Коридор дышит. По полу скользит тень, и там, где она проходит, линии стен на миг исчезают. Её не нужно побеждать. Её нужно обойти.',
      en: 'The corridor breathes. A shadow slides across the floor, and where it passes the lines of the walls vanish for a moment. You do not have to defeat it. You have to go around it.',
    },
    whisper: {
      ru: 'Тень движется размеренно, как медленный вдох.',
      en: 'The shadow moves steadily, like a slow breath.',
    },
  },
  story: {
    look: {
      ru: 'Свет в этой комнате идёт волнами. Он не нападает первым, но пространство между волнами сжимается в такт. В центре — пятно тёплого сияния, похожее на запечатанный лист.',
      en: 'The light in this room moves in waves. It does not strike first, but the space between the waves contracts to the beat. At the centre is a patch of warm glow, like a sealed sheet of paper.',
    },
    cleared: {
      ru: 'Свет стал тише. Он больше не собирается в волны; только тонкая линия дрожит у пола.',
      en: 'The light has grown quiet. It no longer gathers into waves; only a thin line trembles near the floor.',
    },
    whisper: {
      ru: 'Свет ждёт. Не удар, не слово — только движение в такт.',
      en: 'The light waits. Not a blow, not a word — only movement to the rhythm.',
    },
    interact: { ru: 'Коснуться света', en: 'Touch the light' },
  },
  find: {
    look: {
      ru: 'Кладовая пахнет сухой бумагой. На низком выступе лежит обломок мела — короткий, тёплый, будто его только что держали в руке.',
      en: 'The pantry smells of dry paper. A chalk shard lies on a low ledge — short, warm, as if it had just been held in a hand.',
    },
    taken: {
      ru: 'Выступ пуст. Пыль легла обратно ровным слоем.',
      en: 'The ledge is empty. Dust has settled back in an even layer.',
    },
    interact: { ru: 'Взять обломок мела', en: 'Take the chalk shard' },
  },
  generic: {
    look: {
      ru: 'Комната повторяет мотив, который ты уже где-то видел, но линии сдвинуты. Выходы остаются на своих местах. Пока — на своих.',
      en: 'The room repeats a motif you have seen somewhere before, but the lines are shifted. The exits stay where they were. For now.',
    },
    whisper: {
      ru: 'Стены не отвечают, но и не молчат.',
      en: 'The walls do not answer, but they are not silent either.',
    },
  },
};

export const TRIAL = {
  id: 'shivering-light',
  title: { ru: 'Комната дрожащего света', en: 'Room of shivering light' },
  duration: 16,
  bpm: 120,
  beatSeconds: 60 / 120,
  playerRadius: 0.013,
  bulletRadius: 0.015,
  intro: {
    kicker: { ru: 'сюжетная комната', en: 'story room' },
    paragraphs: [
      {
        ru: 'Свет не просит отвечать ударом. Он просит выжить в собственном ритме.',
        en: 'The light does not ask for a blow in return. It asks you to survive inside its rhythm.',
      },
      {
        ru: 'Двигайся, уклоняйся и жди промежутков между волнами. Рывок даёт короткую неуязвимость.',
        en: 'Move, dodge and wait for the gaps between waves. Dashing grants a short invulnerability.',
      },
    ],
    cancel: { ru: 'Отступить', en: 'Step back' },
    start: { ru: 'Войти в такт', en: 'Enter the rhythm' },
    note: {
      ru: 'Это не бой: у света нет здоровья, а у тебя нет оружия. Только движение и ритм.',
      en: 'This is not a fight: the light has no health and you have no weapon. Only movement and rhythm.',
    },
  },
  win: {
    kicker: { ru: 'испытание пройдено', en: 'trial passed' },
    paragraphs: [
      {
        ru: 'Свет принимает твой ритм. Волны опадают, и в центре комнаты остаётся карта.',
        en: 'The light accepts your rhythm. The waves fall away, and a card remains at the centre of the room.',
      },
      {
        ru: 'На клетчатом листе — крылатая фигура, нарисованная мягким карандашом. «Очарование».',
        en: 'On the graph paper is a winged figure drawn in soft pencil. “Charm”.',
      },
    ],
    button: { ru: 'Взять карту', en: 'Take the card' },
    note: {
      ru: 'Карта добавлена в рюкзак. Её можно вынести на рабочий холст.',
      en: 'The card has been added to the backpack. It can be placed on the workspace board.',
    },
  },
  death: {
    ru: 'Свет смыкается. Душа возвращается к Скрижали, рюкзак остаётся в комнате.',
    en: 'The light closes. The soul returns to the Tablet; the backpack stays in the room.',
  },
  hint: {
    ru: 'Двигайся. Рывок — Shift, Space или кнопка «рывок».',
    en: 'Move. Dash with Shift, Space or the “dash” button.',
  },
};

export const MUSIC_MAP = {
  tablet: {
    id: 'tablet',
    title: { ru: 'Скрижаль', en: 'Tablet' },
    src: '/music/tablet',
    volume: 0.32,
  },
  labyrinth: {
    id: 'labyrinth',
    title: { ru: 'Лабиринт', en: 'Labyrinth' },
    src: '/music/labyrinth',
    volume: 0.28,
  },
  trial: {
    id: 'trial',
    title: { ru: 'Дрожащий свет', en: 'Shivering light' },
    src: '/music/trial',
    volume: 0.36,
  },
  deep: {
    id: 'deep',
    title: { ru: 'Глубже', en: 'Deeper' },
    src: '/music/deep',
    volume: 0.26,
  },
};

export const MUSIC_BY_ROOM = {
  tablet: 'tablet',
  danger: 'labyrinth',
  story: 'trial',
  find: 'labyrinth',
  generic: 'labyrinth',
};

// Canvas keyboard mapping. Physical keys and on-screen keys use this table.
export const KEY_ACTIONS = {
  KeyW: { key: 'W', commandId: 'walk-up', labelKey: 'keyboard.w' },
  KeyS: { key: 'S', commandId: 'walk-down', labelKey: 'keyboard.s' },
  KeyA: { key: 'A', commandId: 'walk-left', labelKey: 'keyboard.a' },
  KeyD: { key: 'D', commandId: 'walk-right', labelKey: 'keyboard.d' },
  ArrowUp: { key: '↑', commandId: 'walk-up', labelKey: 'keyboard.arrowup' },
  ArrowDown: { key: '↓', commandId: 'walk-down', labelKey: 'keyboard.arrowdown' },
  ArrowLeft: { key: '←', commandId: 'walk-left', labelKey: 'keyboard.arrowleft' },
  ArrowRight: { key: '→', commandId: 'walk-right', labelKey: 'keyboard.arrowright' },
  KeyE: { key: 'E', commandId: 'take', labelKey: 'keyboard.e' },
  ShiftLeft: { key: 'Shift', commandId: 'dash', labelKey: 'keyboard.shift', special: true },
  ShiftRight: { key: 'Shift', commandId: 'dash', labelKey: 'keyboard.shift', special: true },
  Space: { key: 'Space', commandId: 'dash', labelKey: 'keyboard.space', special: true },
};

export const KEYBOARD_ROWS = [
  [
    { code: 'KeyW', label: 'W' },
    { code: 'KeyA', label: 'A' },
    { code: 'KeyS', label: 'S' },
    { code: 'KeyD', label: 'D' },
  ],
  [
    { code: 'ArrowUp', label: '↑' },
    { code: 'ArrowLeft', label: '←' },
    { code: 'ArrowDown', label: '↓' },
    { code: 'ArrowRight', label: '→' },
  ],
  [
    { code: 'KeyE', label: 'E' },
    { code: 'ShiftLeft', label: 'Shift' },
    { code: 'Space', label: 'Space' },
  ],
];

export const LOG_SOURCE_ORDER = [
  'command',
  'terminal',
  'system',
  'world',
  'action',
  'error',
  'echo',
];

// Story plot table. Nodes are laid out in a 0..100 board; every edge is drawn
// with a -> vector. `requires` controls the "locked" state.
export const STORY_PLOT = {
  nodes: [
    {
      id: 'prologue',
      x: 8, y: 22,
      title: { ru: 'Пробуждение', en: 'Awakening' },
      copy: { ru: 'Земик приходит в себя внутри лабиринта.', en: 'Zemic wakes inside the labyrinth.' },
    },
    {
      id: 'tablet',
      x: 32, y: 22,
      title: { ru: 'Скрижаль', en: 'Tablet' },
      copy: { ru: 'Точка возвращения после гибели.', en: 'The point of return after death.' },
    },
    {
      id: 'walk',
      x: 56, y: 22,
      title: { ru: 'Лабиринт', en: 'Labyrinth' },
      copy: { ru: 'Комнаты, проходы и мотивы.', en: 'Rooms, passages and motifs.' },
    },
    {
      id: 'find',
      x: 78, y: 6,
      title: { ru: 'Кладовая пыли', en: 'Dust pantry' },
      copy: { ru: 'Ветка находки: обломок мела.', en: 'Find branch: the chalk shard.' },
    },
    {
      id: 'danger',
      x: 78, y: 38,
      title: { ru: 'Дышащий коридор', en: 'Breathing corridor' },
      copy: { ru: 'Ветка риска: тень на полу.', en: 'Risk branch: the shadow on the floor.' },
    },
    {
      id: 'backpack',
      x: 56, y: 56,
      title: { ru: 'Потерянный рюкзак', en: 'Lost backpack' },
      copy: { ru: 'Смерть возвращает к Скрижали, но рюкзак остаётся.', en: 'Death returns you to the Tablet, but the backpack stays.' },
    },
    {
      id: 'story',
      x: 56, y: 4,
      title: { ru: 'Сюжетная комната', en: 'Story room' },
      copy: { ru: 'Первая сюжетная комната появляется с шансом 25% при генерации.', en: 'The first story room has a 25% chance to appear during generation.' },
      requires: 'introSeen',
    },
    {
      id: 'trial',
      x: 79, y: 4,
      title: { ru: 'Дрожащий свет', en: 'Shivering light' },
      copy: { ru: 'Ритм, движение и короткий рывок.', en: 'Rhythm, movement and a short dash.' },
      requires: 'introSeen',
    },
    {
      id: 'charm',
      x: 79, y: 22,
      title: { ru: 'Очарование', en: 'Charm' },
      copy: { ru: 'Первая карта. Ветка открывается после испытания.', en: 'The first card. This branch opens after the trial.' },
      requires: 'trialCleared',
    },
    {
      id: 'board',
      x: 32, y: 47,
      title: { ru: 'Рабочий стол', en: 'Workspace board' },
      copy: { ru: 'Клавиши, команды и связи ->.', en: 'Keys, commands and -> links.' },
      requires: 'introSeen',
    },
    {
      id: 'keys',
      x: 8, y: 66,
      title: { ru: 'Клавиатура', en: 'Keyboard' },
      copy: { ru: 'Нажатие клавиши добавляет ноду и её команду.', en: 'Pressing a key adds a node and its command.' },
      requires: 'introSeen',
    },
    {
      id: 'links',
      x: 32, y: 66,
      title: { ru: 'Связи ->', en: 'Links ->' },
      copy: { ru: 'Видимые линии между клавишей и командой.', en: 'Visible lines between a key and a command.' },
      requires: 'introSeen',
    },
  ],
  edges: [
    ['prologue', 'tablet'],
    ['tablet', 'walk'],
    ['walk', 'find'],
    ['walk', 'danger'],
    ['walk', 'story'],
    ['story', 'trial'],
    ['trial', 'charm'],
    ['danger', 'backpack'],
    ['backpack', 'tablet'],
    ['tablet', 'board'],
    ['board', 'keys'],
    ['board', 'links'],
    ['keys', 'walk'],
    ['links', 'walk'],
  ],
};

export const FIRST_STORY_CHANCE = 0.25;
