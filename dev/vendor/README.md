# Vendor libraries

All files here are local, pinned copies used by the player engines in
`scripts/player.js`. They are loaded lazily only when the corresponding engine
is selected; the site never depends on a CDN at runtime.

| File | Library | Version | License |
| --- | --- | --- | --- |
| `wavesurfer.min.js` | WaveSurfer.js | 7.x (existing local copy) | BSD-2-Clause |
| `peaks.min.js` | Peaks.js | 3.1.0 | BSD-3-Clause |
| `howler.min.js` | Howler.js | 2.2.4 | MIT |
| `waviz.min.js` | Waviz | 1.0.0 | MIT |
| `mediaelement-and-player.min.js` | MediaElement.js | 7.1.0 | MIT |
| `amplitude.min.js` | AmplitudeJS | 5.3.2 | MIT |
| `aplayer.min.js` | APlayer | 1.10.1 | MIT |
| `jquery.min.js` | jQuery (jPlayer dependency) | 2.2.4 | MIT |
| `jquery.jplayer.min.js` | jPlayer | 2.9.2 | MIT |
| `aplayer.min.css` | APlayer stylesheet (visible engine UI) | 1.10.1 | MIT |
| `mediaelementplayer.min.css` | MediaElement.js stylesheet (visible engine UI) | 7.1.0 | MIT |
| `jplayer.blue.monday.min.css` | jPlayer blue.monday skin (visible engine UI) | 2.9.2 | MIT GPLv2 (skin images) |
| `image/jplayer.blue.monday.*` | background images for the jPlayer skin | 2.9.2 | MIT GPLv2 (skin images) |

The three stylesheets above are loaded lazily together with their libraries:
they make APlayer, MediaElement.js and jPlayer render their own recognizable
controls in the player's "engine lab" panel instead of staying invisible.
AmplitudeJS ships no stylesheet, so its small skin lives in `styles/player.css`.

jPlayer is a jQuery plugin, so jQuery is pinned to the last 2.x release: it
still provides the `.bind()`/`.unbind()` API that jPlayer 2.9.2 expects.
