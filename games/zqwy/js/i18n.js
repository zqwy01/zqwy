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
            { command: 'walk up', description: 'walks up for one second; “walk up 10” — ten seconds', bindable: true },
            { command: 'walk down', description: 'walks down for one second; “walk down 10” — ten seconds', bindable: true },
            { command: 'walk left', description: 'walks left for one second; “walk left 10” — ten seconds', bindable: true },
            { command: 'walk right', description: 'walks right for one second; “walk right 10” — ten seconds', bindable: true },
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

  /* Английская справка получает те же группы «данные» и «музыка», что и
     русская: сохранение/загрузка и плеер больше не спрятаны в «терминале». */
  (function extendEnglishHelp() {
    const groups = EN.terminal.helpGroups;
    const terminal = groups.find((group) => group.id === 'терминал');
    if (!terminal) return;
    terminal.description = 'settings, history and language';
    terminal.commands = terminal.commands.filter((entry) =>
      !['save', 'load', 'export', 'music'].includes(entry.command)
    );
    const index = groups.indexOf(terminal) + 1;
    groups.splice(index, 0,
      {
        id: 'данные',
        title: 'data',
        description: 'saving, loading and moving the world',
        commands: [
          { command: 'save', description: 'saves the world and state in the browser; also under “settings” → “Data”', bindable: true },
          { command: 'load', description: 'loads the latest browser save', bindable: true },
          { command: 'export', description: 'downloads a world file with seed and state', bindable: true }
        ]
      },
      {
        id: 'музыка',
        title: 'music',
        description: 'player, seek, volume and playback speed',
        commands: [
          { command: 'music', description: 'opens the player: stop, seek, volume, waveform and 0.5×–2× speed', bindable: true }
        ]
      }
    );
  })();

  /* Немецкий — частичный оверлей. Он переводит интерфейс, команды,
     описания и сюжетные тексты; недостающие повествовательные фрагменты
     берутся из английского словаря, а затем из русского. */
  const DE = {
    title: 'Labyrinth der Bewusstseine',
    subtitle: 'Zemic · Browser-Prototyp',
    roomMeta: {
      tablet: { name: 'Tafel', tag: 'Rückkehrpunkt' },
      hazard: { name: 'Blinde Halle', tag: 'Stille' },
      low: { name: 'Niedriges Gewölbe', tag: 'Durchgang' },
      trial: { name: 'Kreis der Verzauberung', tag: 'Prüfung' },
      storage: { name: 'Vorratskammer', tag: 'Funde' },
      crossroad: { name: 'Stille Kreuzung', tag: 'Spur' }
    },
    proceduralNames: [
      'Flüsterkorridor', 'Halle des Grinds', 'Raum mit dem Riss', 'Wiederholung',
      'Niedriges Gewölbe', 'Trockene Galerie', 'Blinde Tasche', 'Langer Gang',
      'Halle ohne Echo', 'Raum vergessener Dinge', 'Krummer Korridor', 'Warmer Stein',
      'Wartehalle', 'Gabelung', 'Der Raum, der nicht war', 'Stiller Flug',
      'Zerfallende Halle', 'Korridor der Kerben', 'Ort zum Atmen', 'Wiederkehrendes Motiv'
    ],
    ambientRoomLines: [
      'Die Wände wiederholen einander mit kleinen Abweichungen. Du bist nicht sicher, ob du hier zum ersten Mal gehst.',
      'Steinsplitter knirschen unter den Füßen. Der Klang kommt ein wenig zu spät zurück.',
      'Die Luft hier ist trocken und still. Irgendwo weit weg tropft Wasser.',
      'Eine Reihe alter Kerben markiert die Wand. Einige davon passen zu deinen Schritten.',
      'Die Decke verliert sich im Dunkeln. Nur für wenige Schritte gibt es Licht.',
      'Es riecht nach Staub und nach etwas anderem, wie vergessenes Papier.'
    ],
    items: {
      card_angel: {
        name: 'Verzauberung',
        action: 'wirken',
        description: 'Eine Bleistiftzeichnung auf kariertem Papier. Darunter steht: „Verzauberung“.',
        note: 'Die Fähigkeit wird als eigenes Modul angebunden.'
      },
      map_fragment: {
        name: 'Kartenfragment',
        action: 'entfalten',
        description: 'Ein von der Zeit weich gewordenes Blatt. Die örtlichen Räume und Gänge scheinen hindurch.',
        note: 'Zeigt den Teil des Labyrinths, den du durchquert hast, und die Räume in der Nähe.'
      },
      chalk: {
        name: 'Holzkohlekreide',
        action: 'markieren',
        description: 'Ein kurzer Stummel, warm von deiner Hand. Er hinterlässt eine klare Spur auf Stein.',
        note: 'Setzt im aktuellen Raum eine Markierung auf der Karte.'
      },
      bead: {
        name: 'Glasperle',
        description: 'Eine trübe Perle mit einem Loch. Eine winzige Luftblase scheint darin eingefroren.',
        note: 'Tut nichts. Sie ruht einfach in deinem Rucksack.'
      }
    },
    controlActions: {
      up: { label: 'oben' },
      down: { label: 'unten' },
      left: { label: 'links' },
      right: { label: 'rechts' },
      interact: { label: 'handlung' },
      look: { label: 'umschauen' },
      stop: { label: 'halt' },
      inventory: { label: 'rucksack' },
      map: { label: 'karte' },
      canvas: { label: 'tisch' }
    },
    story: {
      tablet: {
        title: 'Tafel',
        speaker: 'TAFEL',
        lines: [
          'Der flache Stein unter deiner Hand ist wärmer als die Luft.',
          'Du erinnerst dich nicht, wie du hierher gekommen bist. Du erinnerst dich nur, dass du schon einmal gegangen bist.',
          'Die Tafel ist kein Schutz. Nur ein Ort, an dem du wieder du selbst wirst.'
        ]
      },
      hazard: {
        title: 'Blinde Halle',
        speaker: 'BLINDE HALLE',
        lines: [
          'Hier gibt es keine Schatten, keine Verfolger. Nur Wände, die zu lange geschwiegen haben.',
          'Die Blinde Halle prüft nicht die Geschwindigkeit, sondern die Erinnerung an die Richtung.'
        ]
      },
      trial: {
        title: 'Kreis der Verzauberung',
        speaker: 'KREIS',
        lines: [
          'Der Kreis tritt auf den Boden, als wäre er immer hier gewesen.',
          'Er erklärt die Regeln nicht. Atme. Bewege dich. Schließe die Siegel.'
        ]
      },
      storage: {
        title: 'Vorratskammer',
        speaker: 'VORRATSKAMMER',
        lines: [
          'Trockenes Papier, Staub, jemandes sorgfältige Regale.',
          'Im Regal liegen ein Kartenfragment und Holzkohlekreide. Du nimmst sie, ohne zu fragen, wem sie gehören.'
        ]
      },
      crossroad: {
        title: 'Stille Kreuzung',
        speaker: 'SPUR',
        lines: [
          'Vier Striche an der Wand: drei lange, einer kurz.',
          'Jemand hat den Anfang eines Satzes darunter ausgelöscht. Geblieben ist: „…und doch, nach Osten“.',
          'Du weißt nicht, wer es geschrieben hat. Die Handschrift kommt dir bekannt vor.'
        ]
      },
      trialSuccess: {
        title: 'Der Kreis hat angenommen',
        speaker: 'KREIS',
        lines: [
          'Die Siegel erlöschen eines nach dem anderen. In der Mitte des Kreises bleibt eine Karte.',
          'Darauf ist eine geflügelte Gestalt, mit Bleistift auf kariertes Papier gezeichnet.',
          'Auf der Rückseite: „Verzauberung“.'
        ]
      },
      death: {
        title: 'Rückkehr',
        speaker: 'TAFEL',
        lines: [
          'Dein Atem setzt aus. Der Stein liegt wieder unter deiner Hand.',
          'Der Rucksack blieb, wo du warst. Er wird nicht verschwinden.'
        ]
      }
    },
    storyTree: {
      title: 'Zweig des Labyrinths',
      intro: 'Ein Zweig von vielen. Was durchschritten ist, ist markiert; was verfügbar ist, wartet; was geschlossen ist, ist noch nicht geschehen.',
      nodes: {
        awakening: {
          stage: 'I · Erwachen',
          title: 'An der Tafel',
          summary: 'Du kommst neben einem warmen Stein zu dir und erinnerst dich nicht an den Weg hierher.',
          finds: ['Tafel'],
          seeking: ['erinnern, wie du hierher kamst'],
          hint: 'Berühre die Tafel: gehe nach oben und drücke E.'
        },
        tablet: {
          stage: 'I · Erwachen',
          title: 'Tafel',
          summary: 'Die Tafel öffnet Rucksack und Tisch — kein Schutz, sondern ein Rückkehrpunkt.',
          finds: ['Rucksack', 'Tisch'],
          seeking: ['das erste Gespräch mit der Tafel'],
          hint: 'Die Tafel steht im Startraum.'
        },
        storage: {
          stage: 'II · Erste Funde',
          title: 'Vorratskammer',
          summary: 'Sorgfältige Regale und fremde Erinnerung. Karte und Kreide liegen hier.',
          finds: ['Kartenfragment', 'Holzkohlekreide'],
          seeking: ['Kartenfragment'],
          hint: 'Die Vorratskammer liegt westlich der Tafel.'
        },
        crossroad: {
          stage: 'II · Erste Funde',
          title: 'Stille Kreuzung',
          summary: 'Vier Striche an der Wand und ein ausgelöschter Satz über den Osten.',
          finds: ['Glasperle', 'fremde Spur'],
          seeking: ['verstehen, wer die Spur hinterließ'],
          hint: 'Die Kreuzung liegt östlich der Tafel.'
        },
        hazard: {
          stage: 'II · Erste Funde',
          title: 'Blinde Halle',
          summary: 'Eine Halle ohne Schatten und Verfolger. Sie prüft die Erinnerung an die Richtung.',
          finds: ['Erinnerung an die Richtung'],
          seeking: ['die Halle durchqueren, ohne die Richtung zu verlieren'],
          hint: 'Die Blinde Halle liegt nördlich der Tafel.'
        },
        map: {
          stage: 'II · Erste Funde',
          title: 'Örtliche Karte',
          summary: 'Das Kartenfragment zeigt, was du durchquert hast, und die Räume in der Nähe.',
          finds: ['örtliche Karte'],
          seeking: ['die Karte entfalten und die erste Markierung setzen'],
          hint: 'Der Befehl „map“ öffnet den Bereich; „mark“ setzt eine Markierung.'
        },
        low: {
          stage: 'III · Kreis',
          title: 'Niedriges Gewölbe',
          summary: 'Ein Gang, in dem man leicht die Richtung verliert, führt zum Kreis auf dem Boden.',
          finds: ['Eingang zum Kreis der Verzauberung'],
          seeking: ['den Kreis auf dem Boden finden'],
          hint: 'Folge dem Gang zum Kreis der Verzauberung.'
        },
        trial: {
          stage: 'III · Kreis',
          title: 'Kreis der Verzauberung',
          summary: 'Der Kreis erklärt die Regeln nicht. Schließe zwei Siegel und halte durch.',
          finds: ['die Karte „Verzauberung“'],
          seeking: ['zwei Siegel schließen und bis zum Ende durchhalten'],
          hint: 'Betritt den Kreis; ein Siegel schließt sich mit Leertaste.'
        },
        card: {
          stage: 'IV · Fund',
          title: 'Verzauberung',
          summary: 'Eine Bleistiftkarte mit einer geflügelten Gestalt bleibt in der Mitte des Kreises.',
          finds: ['die Karte „Verzauberung“'],
          seeking: ['die Karte aus der Mitte des Kreises aufnehmen'],
          hint: 'Nach der Prüfung liegt die Karte in der Mitte des Kreises.'
        },
        table: {
          stage: 'IV · Fund',
          title: 'Deine eigene Ordnung',
          summary: 'Am Tisch lassen sich Funde auslegen, eine Taste erzeugen und mit Befehlen verknüpfen.',
          finds: ['verknüpfte Tasten', 'Geschichte'],
          seeking: ['mindestens eine Taste mit einem Befehl verknüpfen'],
          hint: 'Füge am Tisch eine Taste hinzu und verknüpfe sie mit einem Befehl.'
        },
        death: {
          stage: 'Nebenzweig',
          title: 'Rückkehr',
          optional: true,
          summary: 'Der Tod bringt dich zur Tafel zurück, aber der Rucksack bleibt, wo er war.',
          finds: ['der zurückgelassene Rucksack'],
          seeking: ['den Rucksack zurückholen'],
          hint: 'Der Rucksack kann dort aufgenommen werden, wo du warst.'
        }
      }
    },
    terminal: {
      greeting: [
        'Versionen: {Kern: 2} {Schrift: 1}',
        'Terminal erwacht. Systemmeldungen tragen die Marke „system“. Tippe „hilfe“, um Befehlsgruppen zu sehen.'
      ],
      controls: [
        'Steuerung: W/A/S/D oder Pfeile — gehen; E — Handlung; Enter — Befehl senden; ↑/↓ — Befehlsverlauf.',
        'LMB auf die Welt — zum Punkt gehen; LMB halten — dem Cursor folgen.',
        'Befehle öffnen sich mit der Geschichte. Einstellungen — „einstellungen“, Geschichtsweg — „geschichte“, Aktionsprotokoll — „protokoll“.'
      ],
      helpGroups: [
        {
          id: 'основное',
          title: 'grundlagen',
          description: 'Terminal und Orientierung',
          commands: [
            { command: 'help', description: 'zeigt Befehlsgruppen; „hilfe bewegung“ öffnet eine Gruppe', bindable: true },
            { command: 'hello', description: 'kurze Antwort des Terminals; ändert nichts in der Welt', bindable: true },
            { command: 'where did you go', description: 'erinnert daran, dass das Terminal nie gegangen ist und auf Eingabe wartet', bindable: true },
            { command: 'come closer', description: 'prüft, ob die Tafel in der Nähe ist; das Terminal bewegt sich nicht', bindable: true },
            { command: 'look around', description: 'beschreibt den aktuellen Raum, seine Ausgänge und was in der Nähe liegt', bindable: true }
          ]
        },
        {
          id: 'сюжет',
          title: 'geschichte',
          description: 'Geschichtszweig, Funde und Ziel',
          commands: [
            { command: 'story', description: 'öffnet den Geschichtszweig: aktuelle Etappe, Funde und Ziel', bindable: true }
          ]
        },
        {
          id: 'движение',
          title: 'bewegung',
          description: 'sanfte zeitgesteuerte Schritte und Halt',
          commands: [
            { command: 'walk up', description: 'geht eine Sekunde nach oben; „walk up 10“ — zehn Sekunden', bindable: true },
            { command: 'walk down', description: 'geht eine Sekunde nach unten; „walk down 10“ — zehn Sekunden', bindable: true },
            { command: 'walk left', description: 'geht eine Sekunde nach links; „walk left 10“ — zehn Sekunden', bindable: true },
            { command: 'walk right', description: 'geht eine Sekunde nach rechts; „walk right 10“ — zehn Sekunden', bindable: true },
            { command: 'stop', description: 'löst gehaltene Tasten und das Cursorziel', bindable: true }
          ]
        },
        {
          id: 'рюкзак',
          title: 'rucksack',
          description: 'Getragenes und Gefundenes',
          unlock: 'backpack',
          commands: [
            { command: 'backpack', description: 'zeigt den Inhalt des Rucksacks und öffnet ihn im Terminal', bindable: true }
          ]
        },
        {
          id: 'карта',
          title: 'karte',
          description: 'Weg und Markierungen',
          unlock: 'map',
          commands: [
            { command: 'map', description: 'entfaltet die örtliche Karte, wenn das Kartenfragment gefunden wurde', bindable: true },
            { command: 'mark', description: 'setzt im aktuellen Raum eine Markierung auf der Karte; Holzkohlekreide nötig', bindable: true }
          ]
        },
        {
          id: 'стол',
          title: 'tisch',
          description: 'Arbeitsfläche und Tasten',
          unlock: 'table',
          commands: [
            { command: 'table', description: 'öffnet die Arbeitsfläche für Gegenstände, Befehle und Steuerungstasten', bindable: true }
          ]
        },
        {
          id: 'карты',
          title: 'karten',
          description: 'Fähigkeiten',
          unlock: 'cards',
          commands: [
            { command: 'enchant', description: 'aktiviert die Karte „Verzauberung“; derzeit ein neutraler Platzhalter', bindable: true }
          ]
        },
        {
          id: 'логгирование',
          title: 'protokoll',
          description: 'Aufzeichnung von Schritten, Handlungen, Szenen, Welt und Befehlen',
          commands: [
            { command: 'logging', description: 'schaltet die Ereignisaufzeichnung ein; „logging movement“ — nur Schritte', bindable: true }
          ]
        },
        {
          id: 'терминал',
          title: 'terminal',
          description: 'Einstellungen, Verlauf und Sprache',
          commands: [
            { command: 'history', description: 'zeigt den Befehlsverlauf — dieselbe Liste wie mit ↑/↓', bindable: true },
            { command: 'settings', description: 'öffnet die allgemeinen Einstellungen: Sprache, Schrift, Musik und Daten', bindable: true },
            { command: 'settings terminal', description: 'öffnet die Terminal-Einstellungen: Texttempo und Protokollierung', bindable: true },
            { command: 'language', description: 'wechselt die Sprache: „sprache deutsch“, „sprache englisch“ oder „sprache russisch“', bindable: true },
            { command: 'clear', description: 'leert das Terminal-Protokoll und stellt die Begrüßung wieder her', bindable: true },
            { command: 'new game', description: 'erzeugt ein neues Labyrinth mit zufälligem Seed und beginnt von vorn', bindable: false }
          ]
        },
        {
          id: 'данные',
          title: 'daten',
          description: 'Speichern, Laden und Übertragen der Welt',
          commands: [
            { command: 'save', description: 'speichert Welt und Zustand im Browser; auch unter „einstellungen“ → „Daten“', bindable: true },
            { command: 'load', description: 'lädt die letzte Speicherung aus dem Browser', bindable: true },
            { command: 'export', description: 'lädt eine Weltdatei mit Seed und Zustand herunter', bindable: true }
          ]
        },
        {
          id: 'музыка',
          title: 'musik',
          description: 'Player, Spulen, Lautstärke und Geschwindigkeit',
          commands: [
            { command: 'music', description: 'öffnet den Player: Stopp, Spulen, Lautstärke, Welle und Tempo 0.5×–2×', bindable: true }
          ]
        }
      ],
      unlocks: {
        backpack: { title: 'rucksack', hint: 'Die Tafel öffnet den Rucksack nach dem ersten Gespräch.' },
        map: { title: 'karte', hint: 'Das Kartenfragment liegt in der Vorratskammer.' },
        table: { title: 'tisch', hint: 'Die Tafel öffnet den Tisch nach dem ersten Gespräch.' },
        cards: { title: 'karten', hint: 'Die Karte „Verzauberung“ wartet in der Mitte des Kreises.' }
      },
      helpHint: 'Gruppen: {groups}. Details: „hilfe bewegung“.',
      helpGroup: 'Gruppe „{title}“: {description}',
      helpLocked: 'Gruppe „{title}“ ist noch geschlossen. {hint}',
      unknownGroup: 'Keine solche Befehlsgruppe: ',
      unknown: 'Unbekannter Befehl: '
    },
    musicCues: {
      tablet: { title: 'Tafel' },
      hazard: { title: 'Blinde Halle' },
      low: { title: 'Niedriges Gewölbe' },
      trial: { title: 'Kreis' },
      storage: { title: 'Vorratskammer' },
      crossroad: { title: 'Spur' },
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
    'Мир загружен за ': 'World loaded in ',
    'пройдено': 'done',
    'сейчас': 'now',
    'закрыто': 'locked',
    'находки': 'finds',
    'ищешь': 'seeking',
    'текущий этап': 'current stage',
    'доступно узлов': 'available nodes',
    'все доступные узлы пройдены': 'all available nodes are done',
    'что ищешь': 'what you seek',
    'доступные находки': 'available finds',
    'новых находок не осталось': 'no new finds left',
    'Ветвь пройдена. Можно перечитать её или начать новый Лабиринт.': 'The branch is complete. You can reread it or start a new Labyrinth.',
    'Клавиша уже на столе. Связано целей: ': 'The key is already on the table. Linked targets: ',
    'Клавиша уже на столе, но пока ни с чем не связана.': 'The key is already on the table, but not linked to anything yet.',
    'Добавить клавишу ': 'Add key ',
    ' на стол': ' to the table',
    'Ровно одна клетка за ': 'Exactly one tile in ',
    ' с.': ' s.',
    'Ты в переходе между комнатами. Здесь только камень и твоё дыхание.': 'You are in the passage between rooms. Only stone and your breathing are here.',
    'Плоский камень теплее воздуха. Скрижаль не укрытие — просто место, где ты снова становишься собой.': 'The flat stone is warmer than the air. The Tablet is not a shelter — just a place where you become yourself again.',
    'Слепой зал молчит. Ни теней, ни преследователей — только стены и твоя память о направлении.': 'The Blind Hall is silent. No shadows, no pursuers — only walls and your memory of direction.',
    'Низкий свод заставляет согнуться. Здесь легко потерять направление.': 'The Low Vault forces you to stoop. It is easy to lose direction here.',
    'Круг молчит. Печати погасли, и в центре больше ничего нет.': 'The Circle is silent. The seals are out, and there is nothing left in the centre.',
    'Круг проступает на полу. Он не объясняет правил.': 'The Circle surfaces on the floor. It does not explain the rules.',
    'Сухая бумага, пыль, чьи-то аккуратные полки. Здесь что-то оставили до тебя.': 'Dry paper, dust, someone’s careful shelves. Something was left here before you.',
    'На стене четыре чёрточки: три длинные, одна короткая. Под ними — стёртая фраза.': 'Four notches on the wall: three long, one short. Beneath them, a worn-out phrase.',
    'У тебя нет угольного мелка. Метку не поставить.': 'You have no charcoal chalk. You cannot place a mark.',
    'Здесь не на что поставить метку.': 'There is nothing here to mark.',
    'Получена карта «Очарование»': 'Received the “Enchantment” card',
    'Карта «Очарование» лежит в рюкзаке. Её можно вынести на стол.': 'The “Enchantment” card is in your backpack. You can place it on the table.',
    'Рюкзак возвращён. Внутри ничего не было.': 'Backpack recovered. There was nothing inside.',
    'Пусто. Всё, что было, осталось на месте смерти — или ещё не найдено.': 'Empty. Everything you had stayed where you died — or has not been found yet.',
    'Предметы можно вынести на стол, связать с клавишей и запускать быстрым нажатием.': 'Items can be placed on the table, linked to a key and run with a quick press.',
    'Обрывок карты разворачивается: видны комнаты вокруг и оставленные рюкзаки.': 'The map fragment unfolds: nearby rooms and left backpacks become visible.',
    'Пока это только память о пройденном и о соседних комнатах.': 'For now this is only the memory of what you have crossed and the rooms nearby.',
    'Двигайся. Печать закроется — нажми ПРОБЕЛ.': 'Move. The seal will close — press SPACE.',
    'Круг выдохнул искры. Не стой на месте.': 'The Circle exhaled sparks. Do not stand still.',
    'Печать проступила. Встань в неё и нажми ПРОБЕЛ.': 'A seal has surfaced. Stand in it and press SPACE.',
    'Печать ещё не проступила. Жди и двигайся.': 'The seal has not surfaced yet. Wait and keep moving.',
    'Печати сомкнуты. Додержись до конца круга.': 'The seals are closed. Hold out until the end of the Circle.',
    'Ты не внутри печати.': 'You are not inside the seal.',
    'Печать погасла. Следующая будет позже.': 'The seal went out. The next one will come later.',
    'Круг принял печати. Додержись.': 'The Circle accepted the seals. Hold out.',
    'Встань в печать и нажми ПРОБЕЛ.': 'Stand in the seal and press SPACE.',
    'Круг остыл. Можно войти снова': 'The Circle has cooled. You can enter again',
    'Ты покидаешь круг. Печати гаснут, но остаются на месте.': 'You leave the Circle. The seals fade but remain in place.',
    'В центре круга лежит карта': 'A card lies in the centre of the Circle',
    'элемент': 'element',
    'готово': 'done',
    'клавиша': 'key',
    'команда': 'command',
    'способность': 'ability',
    'карта': 'map',
    'инструмент': 'tool',
    'кнопка управления': 'control button',
    'без клавиши': 'without key',
    'ни с чем не связана': 'not linked to anything',
    'связка': 'bundle',
    'кнопка': 'button',
    'нажать': 'press',
    'произнести': 'cast',
    'развернуть': 'unfold',
    'открыть': 'open',
    'на стол': 'to table',
    'выполнить': 'run',
    'состояние: в рюкзаке': 'state: in backpack',
    'состояние: размещена на столе': 'state: placed on the table',
    'Убрать со стола': 'Remove from the table',
    'ПРЕДМЕТЫ': 'ITEMS',
    'УПРАВЛЕНИЕ': 'CONTROLS',
    'КЛАВШИ': 'KEYS',
    'ядро управления': 'control core',
    'Добавить клавишу и связать её с элементами': 'Add a key and link it to elements',
    'Кнопка без клавиши: свяжи её с клавишей': 'Button without a key: link it to a key',
    'Пока нечего добавить. Найди предметы в Лабиринте.': 'Nothing to add yet. Find items in the Labyrinth.',
    'Нажми на клавишу в схеме — она выполнит все связанные цели. На клавиатуре связанные клавиши работают, пока открыт стол.': 'Click a key in the scheme — it will run all linked targets. On the keyboard, linked keys work while the table is open.',
    'Связанных клавиш пока нет. Добавь клавишу на стол через «+ элемент» → «+ клавиша».': 'No linked keys yet. Add a key to the table via “+ element” → “+ key”.',
    'Геймпад остаётся для движения и действия. Клавиши стола настраиваются на клавиатуре и запускают связанные цели.': 'The gamepad is still used for movement and action. Table keys are configured on the keyboard and run linked targets.',
    'На телефоне движение и действие остаются на экранных кнопках. Клавиши стола — для клавиатуры.': 'On a phone, movement and action stay on the on-screen buttons. Table keys are for the keyboard.',
    'WASD или стрелки — идти · E — действие · Enter — команда · Space — печать': 'WASD or arrows — walk · E — action · Enter — command · Space — seal',
    'Добавить клавишу': 'Add a key',
    'Назначить клавишу': 'Assign a key',
    'Нажми нужную клавишу. Esc — отмена.': 'Press the key you need. Esc — cancel.',
    'Перетаскивай элементы. Нажми на элемент, чтобы выполнить. Клавиша запускает все связанные с ней цели.': 'Drag elements. Click an element to run it. A key launches all its linked targets.',
    'Перетаскивай элементы. Нажми, чтобы выполнить. Свяжи клавишу с целями, чтобы запускать их одной кнопкой.': 'Drag elements. Click to run. Link a key to targets to launch them with one button.',
    'Клавиша запускает все связанные с ней цели.': 'A key launches all its linked targets.',
    'клавиатура': 'keyboard',
    'телефон': 'phone',
    'геймпад': 'gamepad',
    'движение': 'movement',
    'действие': 'action',
    'стоп': 'stop',
    'настройки': 'settings',
    'закрыть раздел': 'close section',
    'D-pad / левый стик': 'D-pad / left stick',
    'D-pad': 'D-pad',
    '✦': '✦',
    'Масштаб и положение стола сброшены.': 'Table zoom and position reset.'
  };

  const DE_LABELS = {
    'система': 'system',
    'сцена': 'szene',
    'шаг': 'schritt',
    'действие': 'handlung',
    'команда': 'befehl',
    'комната': 'raum',
    'находка': 'fund',
    'смерть': 'tod',
    'карта': 'karte',
    'рюкзак': 'rucksack',
    'терминал': 'terminal',
    'мир': 'welt',
    'сюжет': 'geschichte',
    'системы': 'system',
    'сцены': 'szenen'
  };

  const DE_PHRASES = {
    'Сейчас не до команд.': 'Jetzt ist keine Zeit für Befehle.',
    'Готово.': 'Erledigt.',
    'Движение остановлено.': 'Bewegung angehalten.',
    'Рюкзак пуст.': 'Der Rucksack ist leer.',
    'Рюкзак открыт.': 'Rucksack geöffnet.',
    'Карта открыта.': 'Karte geöffnet.',
    'Стол открыт. Предметы, команды и клавиши можно разложить самому.': 'Der Tisch ist offen. Gegenstände, Befehle und Tasten lassen sich selbst anordnen.',
    'Ты уже за столом.': 'Du bist bereits am Tisch.',
    'Мир сохранён.': 'Welt gespeichert.',
    'Сохранение загружено.': 'Speicherung geladen.',
    'Сохранения пока нет.': 'Es gibt noch keine Speicherung.',
    'Мир выгружен в файл.': 'Welt in eine Datei exportiert.',
    'Пока недоступно. ': 'Noch nicht verfügbar. ',
    'Это откроется позже.': 'Das öffnet sich später.',
    'сборка': 'Build',
    'Версия ядра:': 'Kernversion:',
    'Мир загружен:': 'Welt geladen:',
    'за': 'in',
    'мс': 'ms',
    'комнат:': 'Räume:',
    'чанков:': 'Chunks:',
    'Управление: W/A/S/D или стрелки — идти; E — действие; Enter — отправить команду; ↑/↓ — история команд.': 'Steuerung: W/A/S/D oder Pfeile — gehen; E — Handlung; Enter — Befehl senden; ↑/↓ — Befehlsverlauf.',
    'ЛКМ по миру — идти к точке; удержание ЛКМ — следовать за курсором.': 'LMB auf die Welt — zum Punkt gehen; LMB halten — dem Cursor folgen.',
    'Введи «помоги», чтобы увидеть команды. Команды открываются по мере истории. Настройки — «настройки», сюжет — «сюжет», запись действий — «логгирование».': 'Tippe „hilfe“, um die Befehle zu sehen. Befehle öffnen sich mit der Geschichte. Einstellungen — „einstellungen“, Geschichte — „geschichte“, Aktionsprotokoll — „protokoll“.',
    'Музыкальный плеер открывается из основной вкладки терминала командой «музыка».': 'Der Musikplayer öffnet sich aus der Hauptregisterkarte des Terminals mit dem Befehl „musik“.',
    'Логгирование выключено.': 'Protokollierung aus.',
    'Логгирование включено для всех категорий.': 'Protokollierung für alle Kategorien an.',
    'Ветвь истории открывается из основной вкладки терминала командой «сюжет».': 'Der Geschichtszweig öffnet sich aus der Hauptregisterkarte des Terminals mit dem Befehl „geschichte“.',
    'Настройки открываются из основной вкладки терминала.': 'Die Einstellungen öffnen sich aus der Hauptregisterkarte des Terminals.'
  };

  function translatePlace(text) {
    const room = String(text || '').match(/^в комнате «(.+)»$/);
    if (room) return `in the room “${room[1]}”`;
    if (text === 'в переходе между комнатами') return 'in the passage between rooms';
    return text;
  }

  function translateDirection(text) {
    const map = {
      'вверх': 'up',
      'вниз': 'down',
      'влево': 'left',
      'вправо': 'right',
      'вверх-влево': 'up-left',
      'вверх-вправо': 'up-right',
      'вниз-влево': 'down-left',
      'вниз-вправо': 'down-right'
    };
    return map[text] || text;
  }

  function translateCause(text) {
    const map = {
      'искра': 'spark',
      'неизвестно': 'unknown'
    };
    return map[text] || text;
  }

  const PATTERNS = [
    [/^(.+) \(([^()]*)\)\.$/, (m) => {
      const parts = m[2].split('; ');
      const known = parts.every((part) =>
        /^выходов: \d+$/.test(part) ||
        part === 'рядом что-то лежит' ||
        part === 'здесь оставлен рюкзак'
      );
      if (!known) return `${tr(m[1])} (${m[2]}).`;
      const details = parts.map((part) => {
        const exits = part.match(/^выходов: (\d+)$/);
        if (exits) return `exits: ${exits[1]}`;
        if (part === 'рядом что-то лежит') return 'something lies nearby';
        if (part === 'здесь оставлен рюкзак') return 'a backpack was left here';
        return part;
      });
      return `${tr(m[1])} (${details.join('; ')}).`;
    }],
    [/^Ты снова у Скрижали\. Рюкзак остался (.+?): (\d+) (?:предмет|предмета|предметов)\. Он никуда не денется\.$/, (m) => `You are at the Tablet again. The backpack stayed ${translatePlace(m[1])}: ${m[2]} items. It will not go anywhere.`],
    [/^Ты снова у Скрижали\. Рюкзак остался (.+?) — пустой, но никуда не денется\.$/, (m) => `You are at the Tablet again. The backpack stayed ${translatePlace(m[1])} — empty, but it will not go anywhere.`],
    [/^Рюкзак возвращён\. Внутри: (.+)\.$/, (m) => `Backpack recovered. Inside: ${m[1]}.`],
    [/^Печатей закрыто: (\d+)\. Круг принял\. В центре проступает карта\.$/, (m) => `Seals closed: ${m[1]}. The Circle accepted. A card surfaces in the centre.`],
    [/^Печатей закрыто: (\d+)\. Нужно не меньше (\d+)\. Круг не принял, но можно войти снова — ничего не потеряно\.$/, (m) => `Seals closed: ${m[1]}. At least ${m[2]} are needed. The Circle did not accept, but you can enter again — nothing is lost.`],
    [/^Печать закрыта \((\d+) \/ (\d+)\)\.$/, (m) => `Seal closed (${m[1]} / ${m[2]}).`],
    [/^Искра обожгла\. Осталось искр: (\d+)\.$/, (m) => `A spark burned you. Sparks left: ${m[1]}.`],
    [/^вошёл в комнату «(.+)»$/, (m) => `entered the room “${m[1]}”`],
    [/^взял карту «Очарование»$/, () => 'took the “Enchantment” card'],
    [/^взял «(.+)»$/, (m) => `took “${m[1]}”`],
    [/^вернул рюкзак: (.+)$/, (m) => `recovered backpack: ${m[1]}`],
    [/^вернул пустой рюкзак$/, () => 'recovered an empty backpack'],
    [/^поставил метку: «(.+)»$/, (m) => `placed a mark: “${m[1]}”`],
    [/^смерть: (.+)$/, (m) => `death: ${translateCause(m[1])}`],
    [/^шаг (.+?)( \((\d+(?:[.,]\d+)?) с\)| \(к курсору\))?$/, (m) => {
      const suffix = m[2] === ' (к курсору)'
        ? ' (towards the cursor)'
        : (m[3] ? ` (${m[3]} s)` : '');
      return `step ${translateDirection(m[1])}${suffix}`;
    }],
    [/^Новый Лабиринт\. Seed: (.+)$/, (m) => `New Labyrinth. Seed: ${m[1]}`],
    [/^Мир загружен за (\d+) мс · комнат: (\d+) · чанков: (\d+) · seed: (.*)$/, (m) => `World loaded in ${m[1]} ms · rooms: ${m[2]} · chunks: ${m[3]} · seed: ${m[4]}`],
    [/^Мир загружен за (\d+) мс\. (.*)$/, (m) => `World loaded in ${m[1]} ms. ${m[2]}`],
    [/^Клавиша уже на столе\. Связано целей: (\d+)\.$/, (m) => `The key is already on the table. Linked targets: ${m[1]}.`],
    [/^Ровно одна клетка за (.+) с\.$/, (m) => `Exactly one tile in ${m[1]} s.`],
    [/^доступно узлов: (\d+)$/, (m) => `available nodes: ${m[1]}`],
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
    const value = String(text);
    if (lang === 'de') {
      if (Object.prototype.hasOwnProperty.call(DE_PHRASES, value)) return DE_PHRASES[value];
      if (Object.prototype.hasOwnProperty.call(PHRASES, value)) return PHRASES[value];
      for (const [re, fn] of PATTERNS) {
        const match = value.match(re);
        if (match) return fn(match);
      }
      return value;
    }
    if (lang !== 'en') return text;
    if (Object.prototype.hasOwnProperty.call(PHRASES, value)) return PHRASES[value];
    for (const [re, fn] of PATTERNS) {
      const match = value.match(re);
      if (match) return fn(match);
    }
    return value;
  }

  function trLabel(label) {
    if (!label) return label;
    if (lang === 'de') return DE_LABELS[String(label).toLowerCase()] || label;
    if (lang !== 'en') return label;
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
    const de = lang === 'de';
    document.documentElement.lang = de ? 'de' : en ? 'en' : 'ru';
    document.title = de
      ? 'Labyrinth der Bewusstseine · Zemic'
      : en
        ? 'Labyrinth of Minds · Zemic'
        : 'Лабиринт сознаний · Zemic';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', de
        ? 'Labyrinth der Bewusstseine — ein Browser-Prototyp über Zemic: Räume, Terminal und ein Tisch mit verknüpften Tasten.'
        : en
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

      setText('#canvas-title', 'Table');
      setText('#canvas-exit', '×');
      setAttr('#canvas-exit', 'aria-label', 'Close table');
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
      setText('#canvas-keys [data-device="mouse"]', 'mouse');
      setText('#canvas-drawer .drawer-head > span', 'ADD TO THE TABLE');
      setAttr('#canvas-drawer-close', 'aria-label', 'Close panel');
      setText('#canvas-response-command', 'ready');
      setText('#canvas-response-reply', 'Click a placed element to run its command.');
      setText('#canvas-move-note', 'movement: 1 s by default · “walk down 10” — 10 s');
      setText('#canvas-move-seconds-label', 'seconds');
      setAttr('[data-canvas-move="up"]', 'aria-label', 'Walk up');
      setAttr('[data-canvas-move="down"]', 'aria-label', 'Walk down');
      setAttr('[data-canvas-move="left"]', 'aria-label', 'Walk left');
      setAttr('[data-canvas-move="right"]', 'aria-label', 'Walk right');
      setAttr('#canvas-move-stop', 'aria-label', 'Stop movement');
      setAttr('#canvas-move-seconds', 'aria-label', 'Movement duration in seconds');
      setAttr('#music-seek', 'aria-label', 'Track position');
      setAttr('#music-volume', 'aria-label', 'Music volume');
      setText('#music-volume-label', 'volume');

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
      setText('#open-font-settings', 'Font settings →');
      setText('#open-music', 'Open player →');
      setText('#settings-reset', 'reset to defaults');
      setText('#setting-font-note', 'The global size applies to the whole interface. Sections can inherit it or set their own value.');
      setText('#setting-overrides-note', '0 — inherit the global size. Items and keys on the table scale with the section.');
      setText('#setting-language-state', 'English');

      setText('#view-term-settings .settings-title', 'Settings: terminal');
      setText('#view-term-settings .settings-subtitle', 'text and event recording');
      setAttr('#term-settings-close', 'aria-label', 'Close terminal settings');
      setText('#term-settings-back', '← general settings');
      setText('#setting-speed-title', 'Text appearance speed');
      setText('#setting-log-title', 'Action log');
      setText('#setting-log-enable-text', 'record events in the terminal');
      setText('#setting-log-terminal-text', 'terminal');
      setText('#setting-log-scenes-text', 'scenes');
      setText('#setting-log-system-text', 'system');
      setText('#setting-log-world-text', 'world');
      setText('#setting-log-movement-text', 'movement');
      setText('#setting-log-actions-text', 'actions');
      setText('#setting-log-commands-text', 'commands');
      setText('#setting-log-note', 'The action log filters useful text. For example, “movement” records steps. The “logging” command enables everything or one category: “logging movement”, “logging actions”, “logging terminal”.');

      setText('#view-font-settings .eyebrow', 'INTERFACE');
      setText('#view-font-settings .settings-title', 'Settings: font');
      setText('#view-font-settings .settings-subtitle', 'global size and sizes by section');
      setAttr('#font-settings-close', 'aria-label', 'Close font settings');
      setText('#font-settings-back', '← general settings');
      setText('#setting-font-size-title', 'Global font size');
      setText('#setting-font-size-note', 'The global size applies to the whole interface.');

      setText('#view-music .eyebrow', 'SOUND');
      setText('#view-music .settings-title', 'Music');
      setText('#view-music .settings-subtitle', 'player of the Labyrinth');
      setAttr('#music-close', 'aria-label', 'Close player');
      setText('#music-toggle', 'play');
      setText('#music-stop', 'stop');
      setText('#music-rate-title', 'Speed');
      setText('#music-rate-note', 'Slowing down and speeding up change the tempo without restarting the track.');
      setText('#music-back', '← general settings');
      setText('#music-player-state', 'on');

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

      setText('#canvas-title', 'Стол');
      setText('#canvas-exit', '×');
      setAttr('#canvas-exit', 'aria-label', 'Закрыть стол');
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
      setText('#canvas-keys [data-device="mouse"]', 'мышь');
      setText('#canvas-drawer .drawer-head > span', 'ДОБАВИТЬ НА СТОЛ');
      setText('#canvas-response-command', 'готово');
      setText('#canvas-response-reply', 'Нажми на размещённый элемент, чтобы выполнить его команду.');
      setText('#canvas-move-note', 'движение: 1 с по умолчанию · «идти вниз 10» — 10 с');
      setText('#canvas-move-seconds-label', 'секунды');
      setAttr('[data-canvas-move="up"]', 'aria-label', 'Идти вверх');
      setAttr('[data-canvas-move="down"]', 'aria-label', 'Идти вниз');
      setAttr('[data-canvas-move="left"]', 'aria-label', 'Идти влево');
      setAttr('[data-canvas-move="right"]', 'aria-label', 'Идти вправо');
      setAttr('#canvas-move-stop', 'aria-label', 'Остановить движение');
      setAttr('#canvas-move-seconds', 'aria-label', 'Длительность движения в секундах');
      setAttr('#music-seek', 'aria-label', 'Позиция трека');
      setAttr('#music-volume', 'aria-label', 'Громкость музыки');
      setText('#music-volume-label', 'громкость');

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
      setText('#setting-log-title', 'Запись действий');
      setText('#setting-log-enable-text', 'записывать события в терминал');
      setText('#setting-log-terminal-text', 'терминал');
      setText('#setting-log-scenes-text', 'сцены');
      setText('#setting-log-system-text', 'система');
      setText('#setting-log-world-text', 'мир');
      setText('#setting-log-movement-text', 'движение');
      setText('#setting-log-actions-text', 'действия');
      setText('#setting-log-commands-text', 'команды');
      setText('#setting-log-note', 'Запись действий — это фильтр полезного текста. Например, «движение» записывает шаги. Команда «логгирование» включает всё или одну категорию: «логгирование движение», «логгирование действия», «логгирование терминал».');

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

    if (de) {
      setPlaceholder('#command-input', 'Befehl eingeben und senden');
      setAttr('#command-input', 'aria-label', 'Befehlseingabe');
      setAttr('.term-send', 'aria-label', 'Befehl senden');
      setAttr('#btn-action', 'aria-label', 'Handlung');
      setAttr('.dpad-up', 'aria-label', 'Oben');
      setAttr('.dpad-left', 'aria-label', 'Links');
      setAttr('.dpad-right', 'aria-label', 'Rechts');
      setAttr('.dpad-down', 'aria-label', 'Unten');
      setAttr('#divider', 'aria-label', 'Trenner zwischen Spielfläche und Terminal');

      setText('#view-inventory .eyebrow', 'GETRAGEN');
      setText('#inv-title', 'Rucksack');
      setText('#inventory-note', 'Gegenstände lassen sich auf den Tisch legen und ihre Befehle mit einem kurzen Druck ausführen.');
      setAttr('#inventory-close', 'aria-label', 'Rucksack schließen');

      setText('#view-map .eyebrow', 'ÖRTLICHER BEREICH');
      setText('#map-title', 'Karte');
      setText('#map-note', 'Vorerst ist dies nur die Erinnerung an das Durchquerte.');
      setAttr('#map-close', 'aria-label', 'Karte schließen');

      setText('#canvas-title', 'Tisch');
      setText('#canvas-exit', '×');
      setAttr('#canvas-exit', 'aria-label', 'Tisch schließen');
      setText('#canvas-add-toggle', '+');
      setAttr('#canvas-add-toggle', 'aria-label', 'Element hinzufügen');
      setText('#canvas-link-toggle', '→');
      setAttr('#canvas-link-toggle', 'aria-label', 'Verknüpfen');
      setText('#canvas-keys-toggle', 'tasten');
      setAttr('#canvas-keys-toggle', 'aria-label', 'Tasten');
      setAttr('#canvas-zoom-out', 'aria-label', 'Verkleinern');
      setAttr('#canvas-zoom-reset', 'aria-label', 'Zoom und Position zurücksetzen');
      setAttr('#canvas-zoom-in', 'aria-label', 'Vergrößern');
      setText('#canvas-hint', 'Elemente ziehen. Klicken zum Ausführen. Eine Taste mit Zielen verknüpfen, um sie mit einem Druck zu starten.');
      setAttr('#canvas-workspace', 'aria-label', 'Arbeitsfläche des Tisches');
      setText('#canvas-empty span', 'hier ist noch leer');
      setText('#canvas-empty small', 'Füge einen Fund, einen Befehl oder eine Taste aus dem „+“-Panel hinzu. Eine Taste kann mit mehreren Zielen verknüpft werden.');
      setText('#canvas-keyboard-hint', 'Klicke eine Taste — sie erscheint sofort auf dem Tisch.');
      setText('#canvas-keys .keys-head > span', 'STEUERUNGSSCHEMA');
      setText('#canvas-keys [data-device="keyboard"]', 'tastatur');
      setText('#canvas-keys [data-device="gamepad"]', 'gamepad');
      setText('#canvas-keys [data-device="phone"]', 'telefon');
      setText('#canvas-keys [data-device="mouse"]', 'maus');
      setText('#canvas-drawer .drawer-head > span', 'ZUM TISCH HINZUFÜGEN');
      setAttr('#canvas-drawer-close', 'aria-label', 'Panel schließen');
      setText('#canvas-response-command', 'bereit');
      setText('#canvas-response-reply', 'Klicke ein platziertes Element, um seinen Befehl auszuführen.');
      setText('#canvas-move-note', 'Bewegung: standardmäßig 1 s · „walk down 10“ — 10 s');
      setText('#canvas-move-seconds-label', 'sekunden');
      setAttr('[data-canvas-move="up"]', 'aria-label', 'Nach oben gehen');
      setAttr('[data-canvas-move="down"]', 'aria-label', 'Nach unten gehen');
      setAttr('[data-canvas-move="left"]', 'aria-label', 'Nach links gehen');
      setAttr('[data-canvas-move="right"]', 'aria-label', 'Nach rechts gehen');
      setAttr('#canvas-move-stop', 'aria-label', 'Bewegung anhalten');
      setAttr('#canvas-move-seconds', 'aria-label', 'Bewegungsdauer in Sekunden');
      setAttr('#music-seek', 'aria-label', 'Position im Track');
      setAttr('#music-volume', 'aria-label', 'Musiklautstärke');
      setText('#music-volume-label', 'lautstärke');

      setText('#view-card .eyebrow', 'KARTE');
      setAttr('#card-close', 'aria-label', 'Zum Tisch zurückkehren');
      setText('#card-run', 'wirken');
      setText('#card-place', 'auf den Tisch');
      setText('#card-back', '← zum Tisch');

      setText('#view-story .eyebrow', 'ZWEIG');
      setText('#story-title', 'Geschichte');
      setAttr('#story-close', 'aria-label', 'Geschichtszweig schließen');

      setText('#view-settings .settings-title', 'Einstellungen');
      setText('#view-settings .settings-subtitle', 'Oberfläche, Ton und Daten');
      setAttr('#settings-close', 'aria-label', 'Einstellungen schließen');
      setText('#setting-language-title', 'Sprache');
      setText('#setting-font-title', 'Schriftgröße');
      setText('#setting-overrides-title', 'Größen nach Bereichen');
      setText('#setting-override-terminal-name', 'terminal');
      setText('#setting-override-table-name', 'tisch');
      setText('#setting-music-title', 'Musik');
      setText('#setting-data-title', 'Daten');
      setText('#open-term-settings', 'Terminal-Einstellungen →');
      setText('#open-font-settings', 'Schrifteinstellungen →');
      setText('#open-music', 'Musikplayer →');
      setText('#settings-reset', 'auf Standard zurücksetzen');
      setText('#setting-font-note', 'Die globale Größe gilt für die gesamte Oberfläche. Bereiche können sie erben oder einen eigenen Wert setzen.');
      setText('#setting-overrides-note', '0 — globale Größe erben. Gegenstände und Tasten auf dem Tisch skalieren mit dem Bereich.');
      setText('#setting-language-state', 'Deutsch');

      setText('#view-term-settings .settings-title', 'Einstellungen: Terminal');
      setText('#view-term-settings .settings-subtitle', 'Text und Ereignisaufzeichnung');
      setAttr('#term-settings-close', 'aria-label', 'Terminal-Einstellungen schließen');
      setText('#term-settings-back', '← allgemeine Einstellungen');
      setText('#setting-speed-title', 'Geschwindigkeit der Textanzeige');
      setText('#setting-log-title', 'Aktionsprotokoll');
      setText('#setting-log-enable-text', 'Ereignisse im Terminal aufzeichnen');
      setText('#setting-log-terminal-text', 'terminal');
      setText('#setting-log-scenes-text', 'szenen');
      setText('#setting-log-system-text', 'system');
      setText('#setting-log-world-text', 'welt');
      setText('#setting-log-movement-text', 'bewegung');
      setText('#setting-log-actions-text', 'handlungen');
      setText('#setting-log-commands-text', 'befehle');
      setText('#setting-log-note', 'Das Aktionsprotokoll filtert nützlichen Text. „Bewegung“ zeichnet zum Beispiel Schritte auf. Der Befehl „protokoll“ aktiviert alles oder eine Kategorie: „logging movement“, „logging actions“, „logging terminal“.');

      setText('#view-font-settings .eyebrow', 'OBERFLÄCHE');
      setText('#view-font-settings .settings-title', 'Einstellungen: Schrift');
      setText('#view-font-settings .settings-subtitle', 'globale Größe und Größen nach Bereichen');
      setAttr('#font-settings-close', 'aria-label', 'Schrifteinstellungen schließen');
      setText('#font-settings-back', '← allgemeine Einstellungen');
      setText('#setting-font-size-title', 'Globale Schriftgröße');
      setText('#setting-font-size-note', 'Die globale Größe gilt für die gesamte Oberfläche.');

      setText('#view-music .eyebrow', 'TON');
      setText('#view-music .settings-title', 'Musik');
      setText('#view-music .settings-subtitle', 'Player des Labyrinths');
      setAttr('#music-close', 'aria-label', 'Player schließen');
      setText('#music-toggle', 'abspielen');
      setText('#music-stop', 'stopp');
      setText('#music-rate-title', 'Geschwindigkeit');
      setText('#music-rate-note', 'Verlangsamen und Beschleunigen ändern das Tempo ohne Neustart des Tracks.');
      setText('#music-back', '← allgemeine Einstellungen');
      setText('#music-player-state', 'an');

      setText('#view-trial .trial-head .eyebrow', 'KREIS DER VERZAUBERUNG');

      setText('#btn-save', 'speichern');
      setText('#btn-load', 'laden');
      setText('#btn-export', 'exportieren');
      setText('#data-save', 'welt speichern');
      setText('#data-load', 'speicherung laden');
      setText('#data-export', 'welt exportieren');
      setAttr('#btn-settings', 'aria-label', 'Einstellungen');
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
    lang = targetLang === 'en' ? 'en' : targetLang === 'de' ? 'de' : 'ru';
    deepApply(C, RU);
    if (lang === 'en' || lang === 'de') deepApply(C, EN);
    if (lang === 'de') deepApply(C, DE);
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
      const name = lang === 'de' ? 'Deutsch' : lang === 'en' ? 'English' : 'русский';
      const text = lang === 'de'
        ? `Sprache: ${name}`
        : lang === 'en'
          ? `Language: ${name}`
          : `Язык: ${name}`;
      if (typeof ZQ.appendLog === 'function') {
        ZQ.appendLog(text, 'sys', true, lang === 'de' ? 'system' : lang === 'en' ? 'system' : 'система');
      }
    }
    return lang;
  }

  function initial() {
    let saved = 'ru';
    try {
      const stored = window.localStorage.getItem(KEY);
      saved = stored === 'en' || stored === 'de' ? stored : 'ru';
    } catch (error) {
      saved = 'ru';
    }
    apply(saved, true);
  }

  const I18N = {
    get lang() { return lang; },
    get en() { return lang === 'en'; },
    get de() { return lang === 'de'; },
    tr,
    trLabel,
    apply,
    setLanguage(value) {
      const valueText = String(value || '').toLowerCase();
      if (valueText === 'en' || valueText === 'english' || valueText === 'английский') return apply('en');
      if (valueText === 'de' || valueText === 'deutsch' || valueText === 'german' || valueText === 'немецкий') return apply('de');
      if (valueText === 'ru' || valueText === 'russian' || valueText === 'русский') return apply('ru');
      return lang;
    },
    toggle() {
      return apply(lang === 'ru' ? 'en' : lang === 'en' ? 'de' : 'ru');
    },
    phrases: PHRASES
  };

  initial();
  window.ZQI18N = I18N;
  window.ZQ_TR = tr;
})();
