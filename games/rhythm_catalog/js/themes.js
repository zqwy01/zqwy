/* РИТМ-КАТАЛОГ — visual identities for every album.
   Each album gets its own scene, palette, weather and lane colours.
   Adding a new album without editing this file falls back to a generated
   theme, so the game never breaks on an unknown folder. */
(function () {
  'use strict';

  const THEMES = {
    'backers': {
      title: 'Backers', scene: 'arena', weather: 'sparks',
      sky: ['#0a0704', '#1a0d06', '#3a1a08'], horizon: ['#5a2a0c', '#8a3d10'],
      accent: '#ffc24a', accent2: '#ff7a3c', fog: '#b56a2a', sun: '#ffe6a3',
      lane: ['#ffc24a', '#ff8b4a', '#ffd98a', '#ff5e5e'], note: '#ffe1a0'
    },
    '008008008': {
      title: '008008008', scene: 'grid', weather: 'glyphs',
      sky: ['#050508', '#101018', '#242432'], horizon: ['#2e2e44', '#55557a'],
      accent: '#f2f2f7', accent2: '#ff2f5e', fog: '#64648c', sun: '#ffffff',
      lane: ['#ffffff', '#ff2f5e', '#a9b4ff', '#ffd23f'], note: '#ffffff'
    },
    'algiz': {
      title: 'Algiz', scene: 'forest', weather: 'leaves',
      sky: ['#040b08', '#07160f', '#0d2a1c'], horizon: ['#123623', '#1d4d2d'],
      accent: '#74e2a4', accent2: '#f5d67b', fog: '#5f9b74', sun: '#d8ffe8',
      lane: ['#74e2a4', '#8fd3ff', '#f5d67b', '#ff9f7a'], note: '#b8ffd4'
    },
    'alone': {
      title: 'Alone', scene: 'rain', weather: 'rain',
      sky: ['#070a10', '#0e141d', '#1a2431'], horizon: ['#22303f', '#34485c'],
      accent: '#7aa7cc', accent2: '#b8c9d8', fog: '#4f6a82', sun: '#9fc4e0',
      lane: ['#7aa7cc', '#9fbdd4', '#b8c9d8', '#6f86a0'], note: '#cfe2f2'
    },
    'axs': {
      title: 'AXS', scene: 'cathedral', weather: 'embers',
      sky: ['#0b0406', '#1b0709', '#331015'], horizon: ['#4a141b', '#6e1c25'],
      accent: '#ff4d5e', accent2: '#f0c060', fog: '#a83a44', sun: '#ffb0a0',
      lane: ['#ff4d5e', '#f0c060', '#ff8a6a', '#d93a55'], note: '#ffc2a8'
    },
    'be-simpler': {
      title: 'Be Simpler', scene: 'garden', weather: 'petals',
      sky: ['#11130c', '#1d2416', '#303a22'], horizon: ['#40502c', '#5f7440'],
      accent: '#c8e88a', accent2: '#ffd6a0', fog: '#8fa86a', sun: '#f5ffd6',
      lane: ['#c8e88a', '#a8e0c0', '#ffd6a0', '#f2a0b8'], note: '#eaffc4'
    },
    'biela': {
      title: 'Biela', scene: 'ice', weather: 'snow',
      sky: ['#070c14', '#0d1826', '#172c42'], horizon: ['#20415c', '#2f6687'],
      accent: '#d8f4ff', accent2: '#8fd0ff', fog: '#7fb3cf', sun: '#ffffff',
      lane: ['#d8f4ff', '#8fd0ff', '#b0e6d8', '#e0c8ff'], note: '#f2fdff'
    },
    'blizko-boha': {
      title: 'Blizko Boha', scene: 'cathedral', ui: { shape: 'rune', mark: 'cross', radius: 5, glow: 0.30, tilt: -1 }, weather: 'dust',
      sky: ['#0c0904', '#1c1408', '#38280e'], horizon: ['#5a4216', '#8a6524'],
      accent: '#f5d075', accent2: '#fff3c4', fog: '#b08d45', sun: '#fff6cf',
      lane: ['#f5d075', '#ffe8a8', '#d8b0ff', '#ffd98a'], note: '#fff3c4'
    },
    'broken-space': {
      title: 'Broken Space', scene: 'space', weather: 'stars',
      sky: ['#05030a', '#0d0818', '#1a1030'], horizon: ['#2a1a4a', '#44306e'],
      accent: '#b48cff', accent2: '#5ee6ff', fog: '#6e4fa8', sun: '#e6d8ff',
      lane: ['#b48cff', '#5ee6ff', '#ff8ad8', '#d8c4ff'], note: '#e0d0ff'
    },
    'cyber-absolutus': {
      title: 'Cyber Absolutus', scene: 'city', weather: 'data',
      sky: ['#04080e', '#08141f', '#0d2233'], horizon: ['#123a4f', '#1d5a70'],
      accent: '#3ff2e0', accent2: '#ff3fa4', fog: '#2a8090', sun: '#a8fff5',
      lane: ['#3ff2e0', '#ff3fa4', '#7f8cff', '#ffe23f'], note: '#b8fff8'
    },
    'cyber-logos': {
      title: 'Cyber Logos', scene: 'grid', weather: 'glyphs',
      sky: ['#030a05', '#07160c', '#0d2a16'], horizon: ['#124a26', '#1d7038'],
      accent: '#5eff8f', accent2: '#d8ff5e', fog: '#2a9a50', sun: '#c8ffd8',
      lane: ['#5eff8f', '#d8ff5e', '#5ee6ff', '#a0ffc8'], note: '#d0ffdc'
    },
    'cybernetic-lifeform': {
      title: 'Cybernetic Lifeform', scene: 'industrial', weather: 'sparks',
      sky: ['#080a09', '#121611', '#20281c'], horizon: ['#303c27', '#4c5c36'],
      accent: '#b8ff3f', accent2: '#ff8a3c', fog: '#6f8a3c', sun: '#e6ffb0',
      lane: ['#b8ff3f', '#ff8a3c', '#7fd8ff', '#e0ff7a'], note: '#e8ffb8'
    },
    'death-to-capital': {
      title: 'Death to Capital', scene: 'industrial', weather: 'embers',
      sky: ['#0c0605', '#1c0b08', '#34120d'], horizon: ['#521c12', '#7a2a18'],
      accent: '#ff5a3c', accent2: '#ffc84a', fog: '#a8402a', sun: '#ffb08a',
      lane: ['#ff5a3c', '#ffc84a', '#ff2f2f', '#ff9a6a'], note: '#ffc0a0'
    },
    'dystopian-future': {
      title: 'Dystopian Future', scene: 'ruins', weather: 'dust',
      sky: ['#0b0a08', '#171410', '#29241b'], horizon: ['#3d3528', '#5c513d'],
      accent: '#e0a84a', accent2: '#8fd0c0', fog: '#8a795e', sun: '#f0d8a0',
      lane: ['#e0a84a', '#8fd0c0', '#c4b090', '#ff8a5a'], note: '#ffe0b0'
    },
    'endorphin': {
      title: 'Endorphin', scene: 'orb', weather: 'bubbles',
      sky: ['#0d0412', '#1c0a26', '#34104a'], horizon: ['#501a6e', '#7a2a9a'],
      accent: '#ff5ee6', accent2: '#5ee6ff', fog: '#a84ab8', sun: '#ffd0ff',
      lane: ['#ff5ee6', '#5ee6ff', '#ffd05e', '#c48aff'], note: '#ffd0ff'
    },
    'everyday': {
      title: 'Everyday', scene: 'field', weather: 'petals',
      sky: ['#0b0d10', '#182028', '#2c3a42'], horizon: ['#435c52', '#688a6a'],
      accent: '#ffd27a', accent2: '#8fe0c0', fog: '#8aa887', sun: '#fff0c0',
      lane: ['#ffd27a', '#8fe0c0', '#ff9a8a', '#b8c8ff'], note: '#fff0c8'
    },
    'forty-hours': {
      title: 'Forty Hours', scene: 'industrial', weather: 'dust',
      sky: ['#0d0b07', '#1a1610', '#2e281a'], horizon: ['#443c28', '#665a3a'],
      accent: '#ffb03c', accent2: '#a8c4d8', fog: '#8a7a4f', sun: '#ffe0a0',
      lane: ['#ffb03c', '#a8c4d8', '#ff7a5a', '#d8d0a8'], note: '#ffe8b8'
    },
    'glioma': {
      title: 'Glioma', scene: 'organic', weather: 'cells',
      sky: ['#140508', '#260a10', '#42101c'], horizon: ['#601c2a', '#8a2a3c'],
      accent: '#ff8aa8', accent2: '#ffd0d8', fog: '#b84a64', sun: '#ffe0e6',
      lane: ['#ff8aa8', '#ffd0d8', '#d8a0ff', '#ff6a7a'], note: '#ffd8e0'
    },
    'hurting-other-people': {
      title: 'Hurting Other People', scene: 'rain', weather: 'rain',
      sky: ['#0a0710', '#150d1d', '#241832'], horizon: ['#35244a', '#4a3466'],
      accent: '#c88cff', accent2: '#ff6a8a', fog: '#7a5a9a', sun: '#e0c8ff',
      lane: ['#c88cff', '#ff6a8a', '#8c9aff', '#ffa0b8'], note: '#e8c8ff'
    },
    'in-forest': {
      title: 'In Forest', scene: 'forest', weather: 'fireflies',
      sky: ['#030806', '#06140d', '#0b2416'], horizon: ['#103a22', '#1a5230'],
      accent: '#8aff9a', accent2: '#e8ff7a', fog: '#4f9a66', sun: '#d8ffd8',
      lane: ['#8aff9a', '#e8ff7a', '#7fe0c0', '#c0ff8a'], note: '#d8ffd8'
    },
    'its-a-tablet': {
      title: "It's a Tablet", scene: 'desert', weather: 'dust',
      sky: ['#0a0806', '#1a120c', '#302016'], horizon: ['#4a3020', '#6e4a2c'],
      accent: '#e8c07a', accent2: '#5ee0d0', fog: '#a8804f', sun: '#ffe8b8',
      lane: ['#e8c07a', '#5ee0d0', '#ff9a6a', '#c8b0ff'], note: '#ffe8c0'
    },
    'joker': {
      title: 'Joker', scene: 'circus', weather: 'confetti',
      sky: ['#0d0612', '#1d0a26', '#35124a'], horizon: ['#521a6e', '#7a2a9a'],
      accent: '#ff3f8a', accent2: '#5eff8a', fog: '#b04a8a', sun: '#ffe0f0',
      lane: ['#ff3f8a', '#5eff8a', '#ffd23f', '#a08aff'], note: '#ffd0e8'
    },
    'kuzya': {
      title: 'Kuzya', scene: 'garden', weather: 'leaves',
      sky: ['#080b06', '#11180c', '#1f2c14'], horizon: ['#30451e', '#4a6630'],
      accent: '#b8e05e', accent2: '#ffb07a', fog: '#7a9a4a', sun: '#f0ffb8',
      lane: ['#b8e05e', '#ffb07a', '#8ad8c0', '#e8ff8a'], note: '#e0ffa8'
    },
    'mannequins': {
      title: 'Mannequins', scene: 'hall', weather: 'dust',
      sky: ['#0b0a0c', '#17151a', '#292530'], horizon: ['#3a3545', '#55505e'],
      accent: '#f0e8e0', accent2: '#c8a0a8', fog: '#8a8292', sun: '#fff8f0',
      lane: ['#f0e8e0', '#c8a0a8', '#a8b0c8', '#e0c8b8'], note: '#fff0e8'
    },
    'mice-inside': {
      title: 'Mice Inside', scene: 'organic', weather: 'cells',
      sky: ['#100507', '#220a0e', '#3c1218'], horizon: ['#581c22', '#7a2830'],
      accent: '#ff6a5e', accent2: '#ffb08a', fog: '#b04a40', sun: '#ffd0b8',
      lane: ['#ff6a5e', '#ffb08a', '#d88a6a', '#ff8a9a'], note: '#ffc8b8'
    },
    'must-all-things-end': {
      title: 'Must All Things End', scene: 'ruins', weather: 'ash',
      sky: ['#0b0907', '#181410', '#2c251c'], horizon: ['#43382a', '#64513a'],
      accent: '#e8b06a', accent2: '#8a9a8a', fog: '#9a8466', sun: '#ffe0b0',
      lane: ['#e8b06a', '#8a9a8a', '#c8b08a', '#ff8a5a'], note: '#ffe8c8'
    },
    'my-tablet': {
      title: 'My Tablet', scene: 'orb', weather: 'bubbles',
      sky: ['#040a0c', '#07161a', '#0c2830'], horizon: ['#12404a', '#1d5e6e'],
      accent: '#5ee6ff', accent2: '#8affd0', fog: '#2a8aa0', sun: '#c8ffff',
      lane: ['#5ee6ff', '#8affd0', '#ffd05e', '#8a9aff'], note: '#c8ffff'
    },
    'na-hrane': {
      title: 'Na Hrane', scene: 'edge', weather: 'sparks',
      sky: ['#0b0507', '#1b0a0e', '#321018'], horizon: ['#521a22', '#7a2830'],
      accent: '#ff5a6a', accent2: '#c8d0d8', fog: '#a84050', sun: '#ffb0b8',
      lane: ['#ff5a6a', '#c8d0d8', '#ffb03c', '#a08aff'], note: '#ffc0c8'
    },
    'new-adventure': {
      title: 'New Adventure', scene: 'forest', weather: 'fireflies',
      sky: ['#040a08', '#08180f', '#0f2c1a'], horizon: ['#164a28', '#226638'],
      accent: '#7aff8a', accent2: '#ffd85e', fog: '#4f9a5e', sun: '#e0ffe0',
      lane: ['#7aff8a', '#ffd85e', '#5ee6ff', '#ff9a6a'], note: '#d0ffd0'
    },
    'new-tablet': {
      title: 'New Tablet', scene: 'desert', weather: 'stars',
      sky: ['#070a14', '#0d1428', '#162444'], horizon: ['#203a60', '#2e5680'],
      accent: '#ffd27a', accent2: '#7ab8ff', fog: '#7a8ab0', sun: '#fff0c0',
      lane: ['#ffd27a', '#7ab8ff', '#8affd0', '#ff9a8a'], note: '#ffe8b8'
    },
    'not-diverse': {
      title: 'Not Diverse', scene: 'grid', weather: 'dust',
      sky: ['#0b0808', '#1a1010', '#2c1a1a'], horizon: ['#3d2424', '#5a3636'],
      accent: '#ff6a5a', accent2: '#e0d0c0', fog: '#8a5050', sun: '#ffc8b8',
      lane: ['#ff6a5a', '#e0d0c0', '#ff8a5a', '#a08080'], note: '#ffd0c0'
    },
    'petunia': {
      title: 'Petunia', scene: 'garden', weather: 'petals',
      sky: ['#0a0610', '#170c1e', '#2a1434'], horizon: ['#401c4a', '#602c6e'],
      accent: '#ff8ae0', accent2: '#8aff9a', fog: '#a85aa8', sun: '#ffd8f8',
      lane: ['#ff8ae0', '#8aff9a', '#ffd05e', '#a08aff'], note: '#ffd0f0'
    },
    'rastignac': {
      title: 'Rastignac', scene: 'hall', weather: 'confetti',
      sky: ['#0c0905', '#1c1408', '#352612'], horizon: ['#523a1a', '#7a5628'],
      accent: '#ffd075', accent2: '#fff0c8', fog: '#b08d45', sun: '#fff8d8',
      lane: ['#ffd075', '#fff0c8', '#ff8a5a', '#c8a8ff'], note: '#fff0c8'
    },
    'runner': {
      title: 'Runner', scene: 'city', weather: 'speed',
      sky: ['#050810', '#0a1420', '#102434'], horizon: ['#1a3a50', '#275a70'],
      accent: '#ff7a3c', accent2: '#3fd8ff', fog: '#3a8090', sun: '#ffd0a0',
      lane: ['#ff7a3c', '#3fd8ff', '#ffd23f', '#ff3f7a'], note: '#ffc8a0'
    },
    'someone': {
      title: 'Someone', scene: 'rain', weather: 'rain',
      sky: ['#08090c', '#11141a', '#1d242c'], horizon: ['#2a3640', '#405060'],
      accent: '#8aa0b8', accent2: '#c8b0a0', fog: '#5a7080', sun: '#b8c8d8',
      lane: ['#8aa0b8', '#c8b0a0', '#7a8aa0', '#a8b8c8'], note: '#d0e0f0'
    },
    'the-remaining-one': {
      title: 'The Remaining One', scene: 'desert', weather: 'dust',
      sky: ['#090a08', '#17180f', '#2c2a18'], horizon: ['#47432a', '#6a6038'],
      accent: '#e8d07a', accent2: '#7ad8c8', fog: '#a89860', sun: '#fff0c0',
      lane: ['#e8d07a', '#7ad8c8', '#ffb07a', '#b8b8ff'], note: '#fff0c8'
    },
    'voidstorm': {
      title: 'Voidstorm', scene: 'space', weather: 'stars',
      sky: ['#030207', '#08050f', '#120a1e'], horizon: ['#1e1030', '#301a4a'],
      accent: '#a07aff', accent2: '#5ee6ff', fog: '#5a3a8a', sun: '#d8c8ff',
      lane: ['#a07aff', '#5ee6ff', '#ff5ea8', '#d0b8ff'], note: '#d8c8ff'
    },
    'not-sorted': {
      title: 'Unsorted', scene: 'void', ui: { shape: 'cut', mark: 'dot', radius: 3, glow: 0.12, tilt: 0 }, weather: 'dust',
      sky: ['#09080b', '#141218', '#242030'], horizon: ['#332e42', '#4a445c'],
      accent: '#c8b8e8', accent2: '#8ad8c8', fog: '#7a7090', sun: '#e8e0ff',
      lane: ['#c8b8e8', '#8ad8c8', '#ffb88a', '#a8b0ff'], note: '#e8e0ff'
    }
  };

  // A stable, deliberately pleasant fallback for albums added after this file.
  const FALLBACK_SCENES = ['forest', 'city', 'space', 'desert', 'rain', 'garden', 'grid', 'orb'];
  const FALLBACK_WEATHER = ['leaves', 'dust', 'sparks', 'stars', 'rain', 'petals', 'glyphs', 'bubbles'];

  function hash32(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // UI identity: every release gets its own button silhouette, corner mark and
  // glow, derived from the album's scene plus a stable hash of its folder id.
  const UI_SHAPES = ['soft', 'cut', 'pill', 'sharp', 'round', 'hex'];
  const MARK_BY_SCENE = {
    arena: 'spark', cathedral: 'cross', circus: 'star', city: 'grid',
    desert: 'sun', edge: 'arc', field: 'leaf', forest: 'rune',
    garden: 'petal', grid: 'grid', hall: 'column', ice: 'shard',
    industrial: 'gear', orb: 'eye', organic: 'cell', rain: 'drop',
    ruins: 'ruin', space: 'star', void: 'dot'
  };
  const FALLBACK_MARKS = ['rune', 'grid', 'star', 'wave', 'dot', 'spark'];

  function uiFor(theme, id) {
    const h = hash32(String(id || theme.title || 'zqwy') + '|' + String(theme.scene || 'void'));
    return {
      shape: UI_SHAPES[h % UI_SHAPES.length],
      mark: MARK_BY_SCENE[theme.scene] || FALLBACK_MARKS[(h >>> 4) % FALLBACK_MARKS.length],
      radius: 4 + ((h >>> 9) % 20),
      glow: 0.14 + ((h >>> 15) % 22) / 100,
      tilt: ((h >>> 21) % 5) - 2
    };
  }

  function withUi(theme, id) {
    if (!theme.ui) theme.ui = uiFor(theme, id);
    return theme;
  }

  // ------------------------------------------------------- per-track variants
  function parseHex(c) {
    if (typeof c !== 'string') return null;
    const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function toHex(rgb) {
    return '#' + rgb.map(function (v) {
      const s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length === 1 ? '0' + s : s;
    }).join('');
  }

  function mix(a, b, t) {
    const A = parseHex(a);
    const B = parseHex(b);
    if (!A || !B) return a;
    return toHex([
      A[0] + (B[0] - A[0]) * t,
      A[1] + (B[1] - A[1]) * t,
      A[2] + (B[2] - A[2]) * t
    ]);
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h * 360, s, l];
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue = function (t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      r = hue(h + 1 / 3);
      g = hue(h);
      b = hue(h - 1 / 3);
    }
    return toHex([r * 255, g * 255, b * 255]);
  }

  function rotate(c, deg, satMul, lightAdd) {
    const rgb = parseHex(c);
    if (!rgb) return c;
    const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    return hslToHex(hsl[0] + deg, hsl[1] * (satMul || 1), hsl[2] + (lightAdd || 0));
  }

  const WEATHER_ALT = {
    leaves: 'fireflies', fireflies: 'leaves',
    petals: 'fireflies', sparks: 'embers', embers: 'sparks',
    stars: 'dust', dust: 'stars', rain: 'ash', snow: 'dust',
    ash: 'dust', glyphs: 'data', data: 'glyphs',
    bubbles: 'stars', confetti: 'petals', speed: 'data', cells: 'dust'
  };

  /* One album, one identity; every track bends that identity a little.
     The palette shift is deterministic, so a track always looks the same. */
  function forTrack(albumId, albumTitle, trackId, trackTitle) {
    const base = forAlbum(albumId, albumTitle);
    const h = hash32(String(albumId || '') + '|' + String(trackId || '') + '|' + String(trackTitle || ''));
    const p1 = (h & 1023) / 1023;
    const p2 = ((h >>> 10) & 1023) / 1023;
    const p3 = ((h >>> 20) & 511) / 511;

    const out = {};
    for (const k in base) out[k] = base[k];
    out.title = base.title;
    out.scene = base.scene;
    out.variant = h;

    // Each track turns the album's hue wheel by up to ±24° and shifts the
    // particle weather roughly a third of the time.
    const dh = ((h >>> 13) % 49) - 24;
    const satMul = 0.90 + ((h >>> 6) % 21) / 100;
    const lightAdd = (((h >>> 24) % 9) - 4) / 200;
    out.weather = (h >>> 27) % 10 < 3
      ? (WEATHER_ALT[base.weather] || base.weather)
      : base.weather;

    // Rotate the four lane colours so the same album still feels related but
    // two neighbouring tracks do not look identical.
    const rot = h % 4;
    out.lane = [0, 1, 2, 3].map(function (i) {
      return rotate(base.lane[(i + rot) % 4], dh, satMul, lightAdd);
    });

    // A palette drift around the album colours.
    out.sky = [
      mix(base.sky[0], '#000000', 0.04 + p1 * 0.12),
      mix(base.sky[1], base.accent, 0.03 + p2 * 0.10),
      rotate(mix(base.sky[2], base.accent2, 0.05 + p3 * 0.16), dh, satMul, lightAdd * 0.5)
    ];
    out.horizon = [
      rotate(mix(base.horizon[0], base.accent, 0.06 + p3 * 0.14), dh, satMul, lightAdd),
      rotate(mix(base.horizon[1], base.accent2, 0.08 + p1 * 0.18), dh, satMul, lightAdd)
    ];
    out.accent = rotate(mix(base.accent, base.accent2, p3 * 0.20), dh, satMul, lightAdd);
    out.accent2 = rotate(mix(base.accent2, base.accent, p1 * 0.18), dh, satMul, lightAdd);
    out.fog = rotate(mix(base.fog, base.accent, 0.05 + p2 * 0.12), dh, satMul, lightAdd * 0.5);
    out.sun = rotate(mix(base.sun, base.accent2, p2 * 0.10), dh, satMul, lightAdd);
    out.note = rotate(mix(base.note, base.accent, p1 * 0.16), dh, satMul, lightAdd);
    return out;
  }

  function generated(id, title) {
    const h = hash32(id);
    const hue = h % 360;
    const hsl = (dh, s, l) => 'hsl(' + ((hue + dh + 360) % 360) + ' ' + s + '% ' + l + '%)';
    return {
      title: title || id,
      scene: FALLBACK_SCENES[h % FALLBACK_SCENES.length],
      weather: FALLBACK_WEATHER[(h >>> 3) % FALLBACK_WEATHER.length],
      sky: [hsl(0, 38, 5), hsl(4, 42, 10), hsl(10, 46, 18)],
      horizon: [hsl(16, 48, 26), hsl(22, 52, 38)],
      accent: hsl(30, 88, 66),
      accent2: hsl(190, 82, 62),
      fog: hsl(24, 34, 50),
      sun: hsl(40, 90, 86),
      lane: [hsl(30, 88, 66), hsl(190, 82, 62), hsl(330, 82, 66), hsl(90, 72, 62)],
      note: hsl(40, 90, 80),
      generated: true
    };
  }

  function forAlbum(id, title) {
    return withUi(THEMES[id] || generated(String(id || 'unknown'), title), id);
  }

  window.RhythmThemes = {
    themes: THEMES,
    forAlbum: forAlbum,
    forTrack: forTrack,
    hash32: hash32
  };
})();
