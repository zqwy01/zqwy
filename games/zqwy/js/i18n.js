/* Локализация: русский — исходные данные, английский — оверлей.
   CONFIG меняется на месте, поэтому все модули, захватившие C,
   продолжают видеть актуальные строки. */
(function () {
  'use strict';

  const C = window.CONFIG;
  const KEY = 'zqwy.labyrinth.lang.v1';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function deepApply(target, source) {
    if (!source || typeof source !== 'object') return target;
    for (const key of Object.keys(source)) {
      const value = source[key];
      if (Array.isArray(value)) {
        target[key] = clone(value);
      } else if (value && typeof value === 'object') {
        if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
          target[key] = {};
        }
        deepApply(target[key], value);
      } else {
        target[key] = value;
      }
    }
    return target;
  }

  const RU = clone(C);

  const EN = {
    title: 'Labyrinth of Minds',
    subtitle: 'Zemic · browser prototype',
    roomMeta: {
      tablet: { name: 'Tablet', tag: 'return point' },
      hazard: { name: 'Blind Hall', tag: 'silence' },
      low: { name: 'Low Vault', tag: 'passage' },
      trial: { name: 'Circle of Enchantment', tag: 'trial' },
      storage: { name: 'Storeroom', tag: 'finds' },
      crossroad: { name: 'Quiet Crossroads', tag: 'trace' }
    },
    proceduralNames: [
      'Whisper Corridor', 'Hall of Scree', 'Room with a Crack', 'Repeat',
      'Low Vault', 'Dry Gallery', 'Blind Pocket', 'Long Passage',
      'Hall Without Echo', 'Room of Forgotten Things', 'Crooked Corridor', 'Warm Stone',
      'Waiting Hall', 'Fork', 'The Room That Was Not', 'Quiet Flight',
      'Crumbling Hall', 'Corridor of Notches', 'Place to Breathe', 'Repeating Motif'
    ],
    ambientRoomLines: [
      'The walls repeat each other with small changes. You are not sure you are walking here for the first time.',
      'Stone grit crunches underfoot. The sound returns a little late.',
      'The air here is dry and still. Somewhere far away, water drips.',
      'A row of old notches marks the wall. Some of them match your steps.',
      'The ceiling fades into darkness. There is only light for a few steps.',
      'It smells of dust and something else, like forgotten paper.'
    ],
    items: {
      card_angel: {
        name: 'Enchantment',
        action: 'cast',
        description: 'A pencil drawing on squared paper. A note underneath reads: “Enchantment”.',
        note: 'The ability will connect as a separate module.'
      },
      map_fragment: {
        name: 'Map Fragment',
        action: 'unfold',
        description: 'A sheet softened by time. The local rooms and passages show through it.',
        note: 'Shows the part of the Labyrinth you have crossed and the rooms nearby.'
      },
      chalk: {
        name: 'Charcoal Chalk',
        action: 'mark',
        description: 'A short stub, warm from your palm. It leaves a clear mark on stone.',
        note: 'Places a mark on the map in the current room.'
      },
      bead: {
        name: 'Glass Bead',
        description: 'A cloudy bead with a hole. A tiny bubble of air seems frozen inside.',
        note: 'Does nothing. It simply rests in your backpack.'
      }
    },
    controlActions: {
      up: { label: 'up' },
      down: { label: 'down' },
      left: { label: 'left' },
      right: { label: 'right' },
      interact: { label: 'action' },
      look: { label: 'look around' },
      stop: { label: 'stop' },
      inventory: { label: 'backpack' },
      map: { label: 'map' },
      canvas: { label: 'table' }
    },
    story: {
      tablet: {
        title: 'Tablet',
        speaker: 'TABLET',
        lines: [
          'The flat stone under your palm is warmer than the air.',
          'You do not remember how you came here. You only remember that you have left before.',
          'The Tablet is not a shelter. Just a place where you become yourself again.'
        ]
      },
      hazard: {
        title: 'Blind Hall',
        speaker: 'BLIND HALL',
        lines: [
          'There are no shadows here, no pursuers. Only walls that have been silent for too long.',
          'The Blind Hall tests not speed, but the memory of direction.'
        ]
      },
      trial: {
        title: 'Circle of Enchantment',
        speaker: 'CIRCLE',
        lines: [
          'The circle surfaces on the floor as if it had always been here.',
          'It does not explain the rules. Breathe. Move. Close the seals.'
        ]
      },
      storage: {
        title: 'Storeroom',
        speaker: 'STOREROOM',
        lines: [
          'Dry paper, dust, someone’s careful shelves.',
          'On the shelf are a map fragment and charcoal chalk. You take them without asking whose they are.'
        ]
      },
      crossroad: {
        title: 'Quiet Crossroads',
        speaker: 'TRACE',
        lines: [
          'Four strokes on the wall: three long, one short.',
          'Someone erased the beginning of a phrase beneath them. What remains is: “…and yet, to the east”.',
          'You do not know who wrote it. The handwriting seems familiar.'
        ]
      },
      trialSuccess: {
        title: 'The Circle Accepted',
        speaker: 'CIRCLE',
        lines: [
          'The seals go out one by one. A card remains in the centre of the circle.',
          'On it is a winged figure, drawn in pencil on squared paper.',
          'On the reverse: “Enchantment”.'
        ]
      },
      death: {
        title: 'Return',
        speaker: 'TABLET',
        lines: [
          'Your breath breaks off. The stone is under your palm again.',
          'The backpack stayed where you were. It will not go anywhere.'
        ]
      }
    },
    proceduralStories: [
      {
        title: 'The Room That Was Not',
        speaker: 'LABYRINTH',
        lines: [
          'You definitely passed here before. And you definitely do not remember this door.',
          'A thin chalk line lies on the floor. It leads onward and breaks off at the wall.'
        ]
      },
      {
        title: 'Someone Else’s Notch',
        speaker: 'TRACE',
        lines: [
          'A number is scratched into the stone. You do not have time to count it: the line runs into the dark.',
          'Someone counted steps before you. Or is still counting.'
        ]
      },
      {
        title: 'Quiet Repeat',
        speaker: 'LABYRINTH',
        lines: [
          'The echo returns half a breath later than it should.',
          'The walls breathe in time with your steps. For a moment it seems you are walking in a circle.'
        ]
      },
      {
        title: 'Forgotten Thing',
        speaker: 'STOREROOM',
        lines: [
          'A dry cloth and a piece of chalk lie in the corner. You do not take them: you already have your own memory.',
          'The dust on the floor is disturbed. Someone stood here quite recently.'
        ]
      }
    ],
    storyTree: {
      title: 'Branch of the Labyrinth',
      intro: 'One branch out of many. What is passed is marked, what is available waits, what is closed has not happened yet.',
      nodes: {
        awakening: {
          stage: 'I · Awakening',
          title: 'At the Tablet',
          summary: 'You come to beside a warm stone and do not remember the road here.',
          finds: ['Tablet'],
          seeking: ['remember how you got here'],
          hint: 'Touch the Tablet: walk up and press E.'
        },
        tablet: {
          stage: 'I · Awakening',
          title: 'Tablet',
          summary: 'The Tablet opens the backpack and the table — not a shelter, but a point of return.',
          finds: ['backpack', 'table'],
          seeking: ['the first conversation with the Tablet'],
          hint: 'The Tablet stands in the starting room.'
        },
        storage: {
          stage: 'II · First Finds',
          title: 'Storeroom',
          summary: 'Careful shelves and someone else’s memory. The map and chalk are here.',
          finds: ['map fragment', 'charcoal chalk'],
          seeking: ['map fragment'],
          hint: 'The Storeroom is west of the Tablet.'
        },
        crossroad: {
          stage: 'II · First Finds',
          title: 'Quiet Crossroads',
          summary: 'Four strokes on the wall and an erased phrase about the east.',
          finds: ['glass bead', 'someone else’s trace'],
          seeking: ['understand who left the trace'],
          hint: 'The Crossroads are east of the Tablet.'
        },
        hazard: {
          stage: 'II · First Finds',
          title: 'Blind Hall',
          summary: 'A hall without shadows or pursuers. It tests the memory of direction.',
          finds: ['memory of direction'],
          seeking: ['cross the hall without losing direction'],
          hint: 'The Blind Hall is north of the Tablet.'
        },
        map: {
          stage: 'II · First Finds',
          title: 'Local Map',
          summary: 'The map fragment shows what you have crossed and the rooms nearby.',
          finds: ['local map'],
          seeking: ['unfold the map and place the first mark'],
          hint: 'The “map” command opens the area; “mark” places a mark.'
        },
        low: {
          stage: 'III · Circle',
          title: 'Low Vault',
          summary: 'A corridor where direction is easily lost leads to the circle on the floor.',
          finds: ['entrance to the Circle of Enchantment'],
          seeking: ['find the circle on the floor'],
          hint: 'Climb the corridor toward the Circle of Enchantment.'
        },
        trial: {
          stage: 'III · Circle',
          title: 'Circle of Enchantment',
          summary: 'The circle does not explain the rules. Close two seals and hold out.',
          finds: ['the “Enchantment” card'],
          seeking: ['close two seals and hold out to the end'],
          hint: 'Enter the circle; a seal closes with Space.'
        },
        card: {
          stage: 'IV · Find',
          title: 'Enchantment',
          summary: 'A pencil card with a winged figure remains in the centre of the circle.',
          finds: ['the “Enchantment” card'],
          seeking: ['pick up the card from the centre of the circle'],
          hint: 'After the trial the card lies in the centre of the circle.'
        },
        table: {
          stage: 'IV · Find',
          title: 'Your Own Order',
          summary: 'The table lets you lay out finds, create a key and link it to commands.',
          finds: ['linked keys', 'story'],
          seeking: ['link at least one key to a command'],
          hint: 'On the table, add a key, then link it to a command.'
        },
        death: {
          stage: 'Side Branch',
          title: 'Return',
          optional: true,
          summary: 'Death returns you to the Tablet, but the backpack stays where it was.',
          finds: ['the left backpack'],
          seeking: ['recover the backpack'],
          hint: 'The backpack can be picked up where you were.'
        }
      }
    },
    terminal: {
      greeting: [
        'Versions: {Core: 2} {Font: 1}',
        'Terminal awakened. System messages carry the “system” label. Type “help” to see command groups.'
      ],
      controls: [
        'Controls: W/A/S/D or arrows — walk; E — action; Enter — send command; ↑/↓ — command history. LMB — walk to a point; hold LMB — follow the cursor.',
        'Commands open as the story progresses. Settings — “settings”, story path — “story”, action log — “logging”.'
      ],
      helpGroups: [
        {
          id: 'основное',
          title: 'main',
          description: 'terminal and orientation',
          commands: [
            { command: 'help', description: 'shows command groups; “help movement” opens one group', bindable: true },
            { command: 'hello', description: 'a short terminal reply; changes nothing in the world', bindable: true },
            { command: 'where did you go', description: 'reminds you that the terminal never left and is waiting for input', bindable: true },
            { command: 'come closer', description: 'checks whether the Tablet is nearby; the terminal does not move', bindable: true },
            { command: 'look around', description: 'describes the current room, its exits and what lies nearby', bindable: true }
          ]
        },
        {
          id: 'сюжет',
          title: 'story',
          description: 'branch of history, finds and goal',
          commands: [
            { command: 'story', description: 'opens the story branch: current stage, finds and goal', bindable: true }
          ]
        },
        {
          id: 'движение',
          title: 'movement',
          description: 'smooth timed steps and stop',
          commands: [
            { command: 'up', description: 'walks up for one second; “walk up 10” — ten seconds', bindable: true },
            { command: 'down', description: 'walks down for one second; “walk down 10” — ten seconds', bindable: true },
            { command: 'left', description: 'walks left for one second; “walk left 10” — ten seconds', bindable: true },
            { command: 'right', description: 'walks right for one second; “walk right 10” — ten seconds', bindable: true },
            { command: 'stop', description: 'releases held keys and clears the cursor target', bindable: true }
          ]
        },
        {
          id: 'рюкзак',
          title: 'backpack',
          description: 'carried and found',
          unlock: 'backpack',
          commands: [
            { command: 'backpack', description: 'shows the contents of the backpack and opens it in the terminal', bindable: true }
          ]
        },
        {
          id: 'карта',
          title: 'map',
          description: 'path and marks',
          unlock: 'map',
          commands: [
            { command: 'map', description: 'unfolds the local map if the map fragment has been found', bindable: true },
            { command: 'mark', description: 'places a mark on the map in the current room; charcoal chalk is required', bindable: true }
          ]
        },
        {
          id: 'стол',
          title: 'table',
          description: 'workspace and keys',
          unlock: 'table',
          commands: [
            { command: 'table', description: 'opens the workspace for items, commands and control buttons', bindable: true }
          ]
        },
        {
          id: 'карты',
          title: 'cards',
          description: 'abilities',
          unlock: 'cards',
          commands: [
            { command: 'enchant', description: 'activates the “Enchantment” card; currently a neutral placeholder', bindable: true }
          ]
        },
        {
          id: 'логгирование',
          title: 'logging',
          description: 'record of steps, actions, scenes, world and commands',
          commands: [
            { command: 'logging', description: 'enables event recording; “logging movement” — only steps', bindable: true }
          ]
        },
        {
          id: 'терминал',
          title: 'terminal',
          description: 'settings, history, language and data',
          commands: [
            { command: 'history', description: 'shows command history — the same list browsed with ↑/↓', bindable: true },
            { command: 'settings', description: 'opens general settings: language, font, music and data', bindable: true },
            { command: 'settings terminal', description: 'opens terminal settings: text speed and logging', bindable: true },
            { command: 'save', description: 'saves the world and state in the browser', bindable: true },
            { command: 'load', description: 'loads the latest save', bindable: true },
            { command: 'export', description: 'downloads a world file with the seed and state', bindable: true },
            { command: 'language', description: 'switches language: “language english” or “language russian”', bindable: true },
            { command: 'music', description: 'turns the background track on or off', bindable: true },
            { command: 'clear', description: 'clears the terminal log and restores the greeting', bindable: true },
            { command: 'new game', description: 'creates a new Labyrinth with a random seed and starts over', bindable: false }
          ]
        }
      ],
      unlocks: {
        backpack: {
          title: 'backpack',
          hint: 'The Tablet will open the backpack after the first conversation.'
        },
        map: {
          title: 'map',
          hint: 'The map fragment lies in the Storeroom.'
        },
        table: {
          title: 'table',
          hint: 'The Tablet will open the table after the first conversation.'
        },
        cards: {
          title: 'cards',
          hint: 'The “Enchantment” card waits in the centre of the Circle.'
        }
      },
      helpHint: 'Groups: {groups}. Details: “help movement”.',
      helpGroup: 'Group “{title}”: {description}',
      helpLocked: 'Group “{title}” is still closed. {hint}',
      unknownGroup: 'No such command group: ',
      unknown: 'Unknown command: '
    },
    musicCues: {
      tablet: { title: 'Tablet' },
      hazard: { title: 'Blind Hall' },
      low: { title: 'Low Vault' },
      trial: { title: 'Circle' },
      storage: { title: 'Storeroom' },
      crossroad: { title: 'Trace' },
      labyrinth: { title: 'Labyrinth' }
    }
  };

  const LABELS = {
    'система': 'system',
    'сцена': 'scene',
    'шаг': 'step',
    'действие': 'action',
    'команда': 'command',
    'комната': 'room',
    'находка': 'find',
    'смерть': 'death',
    'карта': 'map',
    'рюкзак': 'backpack',
    'терминал': 'terminal',
    'мир': 'world',
    'сюжет': 'story',
    'системы': 'system',
    'сцены': 'scenes'
  };

  const PHRASES = {
    'Сейчас не до команд.': 'Not now for commands.',
    'Рюкзак пуст.': 'The backpack is empty.',
    'Пустой рюкзак возвращён': 'The empty backpack has been recovered.',
    'Готово.': 'Done.',
    'Движение остановлено.': 'Movement stopped.',
    'Взаимодействие выполнено, если рядом был объект.': 'Interaction performed if something was nearby.',
    'Стол открыт. Предметы, команды и клавиши можно разложить самому.': 'The table is open. You can lay out items, commands and keys yourself.',
    'Ты уже за столом.': 'You are already at the table.',
    'Ветвь истории открывается из основной вкладки терминала командой «сюжет».': 'The story branch opens from the main terminal tab with the “story” command.',
    'Настройки открываются из основной вкладки терминала.': 'Settings open from the main terminal tab.',
    'Сохранение загружено.': 'Save loaded.',
    'Сохранения пока нет.': 'There is no save yet.',
    'Мир сохранён.': 'World saved.',
    'Мир выгружен в файл.': 'World exported to a file.',
    'Фоновый трек включён.': 'Background track on.',
    'Фоновый трек выключен.': 'Background track off.',
    'Логгирование выключено.': 'Logging off.',
    'Логгирование включено для всех категорий.': 'Logging enabled for all categories.',
    'Клавиша пока ни с чем не связана. Включи «связать» и выбери цели.': 'The key is not linked to anything yet. Turn on “link” and choose targets.',
    'Сначала выбери клавишу в режиме связи.': 'First choose a key in link mode.',
    'Режим связи выключен.': 'Link mode off.',
    'Клавиша назначена. Теперь свяжи её с командами: «связать» → клавиша → цели.': 'Key assigned. Now link it to commands: “link” → key → targets.',
    'Клавиша добавлена. Включи «связать», выбери её, затем выбери цели.': 'Key added. Turn on “link”, choose it, then choose targets.',
    'Выбери клавишу для этого элемента.': 'Choose a key for this element.',
    'Кнопка добавлена без клавиши. Добавь клавишу и свяжи её с этой кнопкой.': 'Button added without a key. Add a key and link it to this button.',
    'Команда размещена. Свяжи её с клавишей или нажми на неё.': 'Command placed. Link it to a key or press it.',
    'Элемент добавлен. Свяжи его с клавишей или нажми на него.': 'Element added. Link it to a key or press it.',
    'Элемент снят со стола.': 'Element removed from the table.',
    'Масштаб и положение стола сброшены.': 'Table zoom and position reset.',
    'Недоступно: предмет остался в рюкзаке на месте смерти.': 'Unavailable: the item stayed in the backpack where you died.',
    'У этого элемента нет команды.': 'This element has no command.',
    'Это не кнопка управления.': 'This is not a control button.',
    'Кнопка управления не настроена.': 'The control button is not configured.',
    'Рюкзак открыт.': 'Backpack opened.',
    'Карта открыта.': 'Map opened.',
    'Ты выходишь из-за стола.': 'You leave the table.',
    'Назначение отменено.': 'Assignment cancelled.',
    'Клавиша отпущена. Выбери другую клавишу.': 'Key released. Choose another key.',
    'Режим связи выключен.': 'Link mode off.',
    'Нет такой группы команд: ': 'No such command group: ',
    'Неизвестная команда: ': 'Unknown command: ',
    'Пока недоступно. ': 'Not available yet. ',
    'Сохранение и загрузка доступны в настройках и на панели терминала.': 'Saving and loading are available in settings and on the terminal panel.',
    'Мир загружен за ': 'World loaded in '
  };

  const PATTERNS = [
    [/^Новый Лабиринт\. Seed: (.+)$/, (m) => `New Labyrinth. Seed: ${m[1]}`],
    [/^Мир загружен за (\d+) мс\. (.*)$/, (m) => `World loaded in ${m[1]} ms. ${m[2]}`],
    [/^Открыто: (.+)\.$/, (m) => `Unlocked: ${m[1]}.`],
    [/^Пока недоступно\. (.+)$/, (m) => `Not available yet. ${m[1]}`],
    [/^Группа «(.+)» пока закрыта\. (.+)$/, (m) => `Group “${m[1]}” is still closed. ${m[2]}`],
    [/^Неизвестная команда: «(.+)»$/, (m) => `Unknown command: “${m[1]}”`],
    [/^Нет такой группы команд: «(.+)»$/, (m) => `No such command group: “${m[1]}”`],
    [/^В рюкзаке: (.+)$/, (m) => `In the backpack: ${m[1]}`],
    [/^Взято: (.+)\.$/, (m) => `Taken: ${m[1]}.`],
    [/^Рюкзак: (.+)\. Предметов: (\d+)\.$/, (m) => `Backpack: ${m[1]}. Items: ${m[2]}.`],
    [/^Метка: (.+)$/, (m) => `Mark: ${m[1]}`],
    [/^Метка поставлена: «(.+)»\.$/, (m) => `Mark placed: “${m[1]}”.`],
    [/^Комната «(.+)» уже отмечена\.$/, (m) => `The room “${m[1]}” is already marked.`],
    [/^Рюкзак возвращён: (.+)$/, (m) => `Backpack recovered: ${m[1]}`],
    [/^Дальше стена\. В (.+) не пройти\.$/, (m) => `A wall ahead. Cannot go ${m[1]}.`],
    [/^Иду (.+) (\d+(?:[.,]\d+)?) с\.$/, (m) => `Walking ${m[1]} for ${m[2]} s.`],
    [/^Иду (.+)\.$/, (m) => `Walking ${m[1]}.`],
    [/^Шаг (.+)\. Камень отзывается глухо\.$/, (m) => `Step ${m[1]}. The stone answers dully.`],
    [/^Комната «(.+)»\.$/, (m) => `Room “${m[1]}”.`],
    [/^— (.+) —$/, (m) => `— ${m[1]} —`],
    [/^рядом: (.+) · E$/, (m) => `nearby: ${m[1]} · E`],
    [/^взять «(.+)»$/, (m) => `take “${m[1]}”`],
    [/^подобрать рюкзак \((\d+)\)$/, (m) => `recover backpack (${m[1]})`],
    [/^подобрать пустой рюкзак$/, () => 'recover empty backpack'],
    [/^коснуться Скрижали$/, () => 'touch the Tablet'],
    [/^взять карту$/, () => 'take the card'],
    [/^войти в круг$/, () => 'enter the circle'],
    [/^действие: (.+)$/, (m) => `action: ${m[1]}`],
    [/^Логгирование включено\. (.+)\.$/, (m) => `Logging enabled. ${m[1]}.`],
    [/^Категория «(.+)»: (включена|выключена)\. (.+)\.$/, (m) => {
      const state = m[2] === 'включена' ? 'enabled' : 'disabled';
      return `Category “${m[1]}”: ${state}. ${m[3]}.`;
    }],
    [/^Фоновый трек (включён|выключен)\.$/, (m) => `Background track ${m[1] === 'включён' ? 'on' : 'off'}.`],
    [/^Язык: (.+)$/, (m) => `Language: ${m[1]}`],
    [/^Сохранение загружено\. Seed: (.+)\.$/, (m) => `Save loaded. Seed: ${m[1]}.`],
    [/^Мир загружен\. Seed: (.+)\.$/, (m) => `World loaded. Seed: ${m[1]}.`],
    [/^Мир сохранён\. Seed: (.+)\.$/, (m) => `World saved. Seed: ${m[1]}.`],
    [/^История команд \((\d+)\):$/, (m) => `Command history (${m[1]}):`],
    [/^История команд пуста\.$/, () => 'Command history is empty.'],
    [/^Доступно узлов: (\d+)\.$/, (m) => `Available nodes: ${m[1]}.`],
    [/^Клавиша (.+) → (.+)$/, (m) => `Key ${m[1]} → ${m[2]}`],
    [/^Связано: (.+)$/, (m) => `Linked: ${m[1]}`],
    [/^Уже связано: (\d+)\. Нажимай на цели, чтобы добавить или убрать связь\.$/, (m) => `Already linked: ${m[1]}. Click targets to add or remove a link.`],
    [/^Теперь нажимай на элементы, которые должна запускать эта клавиша\.$/, () => 'Now click the elements this key should launch.'],
    [/^Связь добавлена\. Можно выбрать ещё одну цель\.$/, () => 'Link added. You can choose another target.'],
    [/^Связь с «(.+)» убрана\.$/, (m) => `Link to “${m[1]}” removed.`],
    [/^Уже связано: (\d+)\.$/, (m) => `Already linked: ${m[1]}.`],
    [/^Клавиша (.+) добавлена\.$/, (m) => `Key ${m[1]} added.`],
    [/^Клавиша (.+)\.$/, (m) => `Key ${m[1]}.`],
    [/^Выбери клавишу, затем цели\. Повторное нажатие на цель убирает связь\.$/, () => 'Choose a key, then targets. Clicking a target again removes the link.'],
    [/^Режим связи: выбери клавишу, затем одну или несколько целей\.$/, () => 'Link mode: choose a key, then one or more targets.'],
    [/^Перетаскивай элементы\. Нажми, чтобы выполнить\. Свяжи клавишу с целями, чтобы запускать их одной кнопкой\.$/, () => 'Drag elements. Click to run. Link a key to targets to launch them with one button.'],
    [/^Перетаскивай элементы\. Нажми на элемент, чтобы выполнить\. Клавиша запускает все связанные с ней цели\.$/, () => 'Drag elements. Click an element to run it. A key launches all its linked targets.'],
    [/^Нажми на размещённый элемент, чтобы выполнить его команду\.$/, () => 'Click a placed element to run its command.'],
    [/^Элемент уже на столе\.$/, () => 'The element is already on the table.'],
    [/^«(.+)» уже на столе$/, (m) => `“${m[1]}” is already on the table`],
    [/^Кнопка уже на столе\.$/, () => 'The button is already on the table.'],
    [/^Стол: (.+)$/, (m) => `Table: ${m[1]}`],
    [/^Сцена: (.+)$/, (m) => `Scene: ${m[1]}`],
    [/^Ветвь: (.+)$/, (m) => `Branch: ${m[1]}`],
    [/^Сюжет: (.+)$/, (m) => `Story: ${m[1]}`],
    [/^Низкий свод$/, () => 'Low Vault']
  ];

  let lang = 'ru';

  function tr(text) {
    if (text === null || text === undefined) return text;
    if (lang !== 'en') return text;
    const value = String(text);
    if (Object.prototype.hasOwnProperty.call(PHRASES, value)) return PHRASES[value];
    for (const [re, fn] of PATTERNS) {
      const match = value.match(re);
      if (match) return fn(match);
    }
    return value;
  }

  function trLabel(label) {
    if (lang !== 'en' || !label) return label;
    return LABELS[String(label).toLowerCase()] || label;
  }

  function setText(selector, text) {
    document.querySelectorAll(selector).forEach((node) => {
      if (node) node.textContent = text;
    });
  }

  function setAttr(selector, name, value) {
    document.querySelectorAll(selector).forEach((node) => {
      if (node) node.setAttribute(name, value);
    });
  }

  function setPlaceholder(selector, value) {
    document.querySelectorAll(selector).forEach((node) => {
      if (node) node.setAttribute('placeholder', value);
    });
  }

  function translateDom() {
    const en = lang === 'en';
    document.documentElement.lang = en ? 'en' : 'ru';
    document.title = en ? 'Labyrinth of Minds · Zemic' : 'Лабиринт сознаний · Zemic';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', en
        ? 'Labyrinth of Minds — a browser prototype about Zemic: rooms, the terminal and a table of linked keys.'
        : 'Лабиринт сознаний — браузерный прототип о Zemic: комнаты, терминал и стол со связанными клавишами.');
    }

    if (en) {
      setPlaceholder('#command-input', 'Type a command and press send');
      setAttr('#command-input', 'aria-label', 'Command input');
      setAttr('.term-send', 'aria-label', 'Send command');
      setAttr('#btn-action', 'aria-label', 'Interact');
      setAttr('.dpad-up', 'aria-label', 'Up');
      setAttr('.dpad-left', 'aria-label', 'Left');
      setAttr('.dpad-right', 'aria-label', 'Right');
      setAttr('.dpad-down', 'aria-label', 'Down');
      setAttr('#divider', 'aria-label', 'Divider between the game area and the terminal');

      setText('#view-inventory .eyebrow', 'CARRIED');
      setText('#inv-title', 'Backpack');
      setText('#inventory-note', 'Items can be placed on the table and their commands run with a quick press.');
      setAttr('#inventory-close', 'aria-label', 'Close backpack');

      setText('#view-map .eyebrow', 'LOCAL AREA');
      setText('#map-title', 'Map');
      setText('#map-note', 'For now this is only the memory of what you have crossed.');
      setAttr('#map-close', 'aria-label', 'Close map');

      setText('#canvas-title', 'table');
      setText('#canvas-exit', 'Leave the table');
      setText('#canvas-add-toggle', '+');
      setAttr('#canvas-add-toggle', 'aria-label', 'Add element');
      setText('#canvas-link-toggle', '→');
      setAttr('#canvas-link-toggle', 'aria-label', 'Link');
      setText('#canvas-keys-toggle', 'keys');
      setAttr('#canvas-keys-toggle', 'aria-label', 'Keys');
      setAttr('#canvas-zoom-out', 'aria-label', 'Zoom out');
      setAttr('#canvas-zoom-reset', 'aria-label', 'Reset zoom and position');
      setAttr('#canvas-zoom-in', 'aria-label', 'Zoom in');
      setText('#canvas-hint', 'Drag elements. Click to run. Link a key to targets to launch them with one button.');
      setAttr('#canvas-workspace', 'aria-label', 'Table workspace');
      setText('#canvas-empty span', 'empty for now');
      setText('#canvas-empty small', 'Add a found item, command or key from the “+” panel. A key can be linked to several targets.');
      setText('#canvas-keyboard-hint', 'Click a key — it immediately appears on the table.');
      setText('#canvas-keys .keys-head > span', 'CONTROL SCHEME');
      setText('#canvas-keys [data-device="keyboard"]', 'keyboard');
      setText('#canvas-keys [data-device="gamepad"]', 'gamepad');
      setText('#canvas-keys [data-device="phone"]', 'phone');
      setText('#canvas-drawer .drawer-head > span', 'ADD TO THE TABLE');
      setAttr('#canvas-drawer-close', 'aria-label', 'Close panel');
      setText('#canvas-response-command', 'ready');
      setText('#canvas-response-reply', 'Click a placed element to run its command.');
      setText('#canvas-move-note', 'movement: 1 s by default · “walk down 10” — 10 s');

      setText('#view-card .eyebrow', 'CARD');
      setAttr('#card-close', 'aria-label', 'Return to the table');
      setText('#card-run', 'cast');
      setText('#card-place', 'to the table');
      setText('#card-back', '← to the table');

      setText('#view-story .eyebrow', 'BRANCH');
      setText('#story-title', 'Story');
      setAttr('#story-close', 'aria-label', 'Close story branch');

      setText('#view-settings .settings-title', 'Settings');
      setText('#view-settings .settings-subtitle', 'interface, sound and data');
      setAttr('#settings-close', 'aria-label', 'Close settings');
      setText('#setting-language-title', 'Language');
      setText('#setting-font-title', 'Global font size');
      setText('#setting-overrides-title', 'Sizes by section');
      setText('#setting-override-terminal-name', 'terminal');
      setText('#setting-override-table-name', 'table');
      setText('#setting-music-title', 'Music');
      setText('#setting-data-title', 'Data');
      setText('#open-term-settings', 'Terminal settings →');
      setText('#settings-reset', 'reset to defaults');
      setText('#setting-font-note', 'The global size applies to the whole interface. Sections can inherit it or set their own value.');
      setText('#setting-overrides-note', '0 — inherit the global size. Items and keys on the table scale with the section.');
      setText('#setting-language-state', 'English');

      setText('#view-term-settings .settings-title', 'Settings: terminal');
      setText('#view-term-settings .settings-subtitle', 'text and event recording');
      setAttr('#term-settings-close', 'aria-label', 'Close terminal settings');
      setText('#term-settings-back', '← general settings');
      setText('#setting-speed-title', 'Text appearance speed');
      setText('#setting-log-title', 'Action logging');
      setText('#setting-log-enable-text', 'record events in the terminal');
      setText('#setting-log-terminal-text', 'terminal');
      setText('#setting-log-scenes-text', 'scenes');
      setText('#setting-log-system-text', 'system');
      setText('#setting-log-world-text', 'world');
      setText('#setting-log-movement-text', 'movement');
      setText('#setting-log-actions-text', 'actions');
      setText('#setting-log-commands-text', 'commands');
      setText('#setting-log-note', 'The “logging” command enables everything or one category: “logging movement”, “logging actions”, “logging terminal”.');

      setText('#view-trial .trial-head .eyebrow', 'CIRCLE OF ENCHANTMENT');

      setText('#music-toggle', 'play');
      setText('#music-stop', 'stop');
      setText('#btn-save', 'save');
      setText('#btn-load', 'load');
      setText('#btn-export', 'export');
      setText('#data-save', 'save world');
      setText('#data-load', 'load save');
      setText('#data-export', 'export world');
      setAttr('#btn-settings', 'aria-label', 'Settings');
    } else {
      setPlaceholder('#command-input', 'Введите команду и нажмите отправить');
      setAttr('#command-input', 'aria-label', 'Ввод команды');
      setAttr('.term-send', 'aria-label', 'Отправить команду');
      setAttr('#btn-action', 'aria-label', 'Взаимодействие');
      setAttr('.dpad-up', 'aria-label', 'Вверх');
      setAttr('.dpad-left', 'aria-label', 'Влево');
      setAttr('.dpad-right', 'aria-label', 'Вправо');
      setAttr('.dpad-down', 'aria-label', 'Вниз');
      setAttr('#divider', 'aria-label', 'Разделитель игровой области и терминала');

      setText('#view-inventory .eyebrow', 'ПЕРЕНОСИМОЕ');
      setText('#inv-title', 'Рюкзак');
      setText('#inventory-note', 'Предметы можно вынести на стол и запускать их команды быстрым нажатием.');
      setAttr('#inventory-close', 'aria-label', 'Закрыть рюкзак');

      setText('#view-map .eyebrow', 'ЛОКАЛЬНЫЙ УЧАСТОК');
      setText('#map-title', 'Карта');
      setText('#map-note', 'Пока это только память о пройденном.');
      setAttr('#map-close', 'aria-label', 'Закрыть карту');

      setText('#canvas-title', 'стол');
      setText('#canvas-exit', 'Выйти из-за стола');
      setText('#canvas-add-toggle', '+');
      setText('#canvas-link-toggle', '→');
      setText('#canvas-keys-toggle', 'клавиши');
      setText('#canvas-hint', 'Перетаскивай элементы. Нажми, чтобы выполнить. Свяжи клавишу с целями, чтобы запускать их одной кнопкой.');
      setText('#canvas-empty span', 'здесь пока пусто');
      setText('#canvas-empty small', 'Добавь найденную вещь, команду или клавишу из панели «+». Клавишу можно связать с несколькими целями.');
      setText('#canvas-keyboard-hint', 'Нажми на клавишу — она сразу появится на столе.');
      setText('#canvas-keys .keys-head > span', 'СХЕМА УПРАВЛЕНИЯ');
      setText('#canvas-keys [data-device="keyboard"]', 'клавиатура');
      setText('#canvas-keys [data-device="gamepad"]', 'геймпад');
      setText('#canvas-keys [data-device="phone"]', 'телефон');
      setText('#canvas-drawer .drawer-head > span', 'ДОБАВИТЬ НА СТОЛ');
      setText('#canvas-response-command', 'готово');
      setText('#canvas-response-reply', 'Нажми на размещённый элемент, чтобы выполнить его команду.');
      setText('#canvas-move-note', 'движение: 1 с по умолчанию · «идти вниз 10» — 10 с');

      setText('#view-card .eyebrow', 'КАРТА');
      setText('#card-run', 'произнести');
      setText('#card-place', 'на стол');
      setText('#card-back', '← к столу');

      setText('#view-story .eyebrow', 'ВЕТВЬ');
      setText('#story-title', 'Сюжет');

      setText('#view-settings .settings-title', 'Настройки');
      setText('#view-settings .settings-subtitle', 'интерфейс, звук и данные');
      setText('#setting-language-title', 'Язык');
      setText('#setting-font-title', 'Общий размер шрифта');
      setText('#setting-overrides-title', 'Размеры по разделам');
      setText('#setting-override-terminal-name', 'терминал');
      setText('#setting-override-table-name', 'стол');
      setText('#setting-music-title', 'Музыка');
      setText('#setting-data-title', 'Данные');
      setText('#open-term-settings', 'Настройки терминала →');
      setText('#settings-reset', 'вернуть по умолчанию');
      setText('#setting-font-note', 'Общий размер применяется ко всему интерфейсу. Разделы могут наследовать его или задать своё значение.');
      setText('#setting-overrides-note', '0 — наследовать общий размер. Предметы и клавиши на столе масштабируются вместе с разделом.');
      setText('#setting-language-state', 'русский');

      setText('#view-term-settings .settings-title', 'Настройки: терминал');
      setText('#view-term-settings .settings-subtitle', 'текст и запись событий');
      setText('#term-settings-back', '← общие настройки');
      setText('#setting-speed-title', 'Скорость появления текста');
      setText('#setting-log-title', 'Логгирование действий');
      setText('#setting-log-enable-text', 'записывать события в терминал');
      setText('#setting-log-terminal-text', 'терминал');
      setText('#setting-log-scenes-text', 'сцены');
      setText('#setting-log-system-text', 'система');
      setText('#setting-log-world-text', 'мир');
      setText('#setting-log-movement-text', 'движение');
      setText('#setting-log-actions-text', 'действия');
      setText('#setting-log-commands-text', 'команды');
      setText('#setting-log-note', 'Команда «логгирование» включает лог целиком или отдельные категории: «логгирование движение», «логгирование действия», «логгирование терминал».');

      setText('#view-trial .trial-head .eyebrow', 'КРУГ ОЧАРОВАНИЯ');

      setText('#music-toggle', 'играть');
      setText('#music-stop', 'стоп');
      setText('#btn-save', 'сохранить');
      setText('#btn-load', 'загрузить');
      setText('#btn-export', 'экспорт');
      setText('#data-save', 'сохранить мир');
      setText('#data-load', 'загрузить сохранение');
      setText('#data-export', 'экспорт мира');
    }
    refreshLangButtons();
  }

  function refreshLangButtons() {
    document.querySelectorAll('[data-lang]').forEach((button) => {
      const active = button.dataset.lang === lang;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function recomputeHelp() {
    C.terminal.help = C.terminal.helpGroups.reduce(
      (list, group) => list.concat(group.commands.map((entry) => ({ ...entry, group: group.id }))),
      []
    );
  }

  function apply(targetLang, quiet) {
    lang = targetLang === 'en' ? 'en' : 'ru';
    deepApply(C, RU);
    if (lang === 'en') deepApply(C, EN);
    recomputeHelp();
    try {
      window.localStorage.setItem(KEY, lang);
    } catch (error) {
      /* private mode */
    }
    translateDom();

    const ZQ = window.ZQ;
    if (ZQ) {
      if (typeof ZQ.applyTermSettings === 'function') ZQ.applyTermSettings(false);
      if (typeof ZQ.applyFonts === 'function') ZQ.applyFonts();
      if (typeof ZQ.renderCanvasDrawer === 'function') ZQ.renderCanvasDrawer();
      if (typeof ZQ.renderCanvasElements === 'function') ZQ.renderCanvasElements();
      if (typeof ZQ.renderKeyScheme === 'function') ZQ.renderKeyScheme();
      if (typeof ZQ.renderStory === 'function' && ZQ.rt && ZQ.rt.termView === 'story') ZQ.renderStory();
      if (typeof ZQ.updatePrompt === 'function') ZQ.updatePrompt();
      if (typeof ZQ.updateMusicUI === 'function') ZQ.updateMusicUI();
      if (typeof ZQ.refreshCommandSuggestions === 'function') ZQ.refreshCommandSuggestions();
    }
    window.dispatchEvent(new CustomEvent('zqwy:lang', { detail: { lang } }));
    if (!quiet && ZQ) {
      const name = lang === 'en' ? 'English' : 'русский';
      const text = lang === 'en' ? `Language: ${name}` : `Язык: ${name}`;
      if (typeof ZQ.appendLog === 'function') ZQ.appendLog(text, 'sys', true, lang === 'en' ? 'system' : 'система');
    }
    return lang;
  }

  function initial() {
    let saved = 'ru';
    try {
      saved = window.localStorage.getItem(KEY) === 'en' ? 'en' : 'ru';
    } catch (error) {
      saved = 'ru';
    }
    apply(saved, true);
  }

  const I18N = {
    get lang() { return lang; },
    en: lang === 'en',
    tr,
    trLabel,
    apply,
    setLanguage(value) {
      const valueText = String(value || '').toLowerCase();
      if (valueText === 'en' || valueText === 'english' || valueText === 'английский') return apply('en');
      if (valueText === 'ru' || valueText === 'russian' || valueText === 'русский') return apply('ru');
      return lang;
    },
    toggle() {
      return apply(lang === 'en' ? 'ru' : 'en');
    },
    phrases: PHRASES
  };

  initial();
  window.ZQI18N = I18N;
  window.ZQ_TR = tr;
})();
