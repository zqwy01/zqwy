# Vendor libraries

All files here are local, pinned copies used by the player engines in
`scripts/player.js` and by the graph engines in `scripts/graph.js`. They are
loaded lazily only when the corresponding engine is selected; the site never
depends on a CDN at runtime.

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
| `d3-dispatch.min.js` | D3 dispatch (d3-force dependency) | 3.0.1 | ISC |
| `d3-quadtree.min.js` | D3 quadtree (d3-force dependency) | 3.0.1 | ISC |
| `d3-timer.min.js` | D3 timer (d3-force dependency) | 3.0.1 | ISC |
| `d3-force.min.js` | D3 force layout for the graph engine | 3.0.0 | ISC |
| `cytoscape.min.js` | Cytoscape.js graph engine | 3.30.4 | MIT |

The three stylesheets above are loaded lazily together with their libraries:
they make APlayer, MediaElement.js and jPlayer render their own recognizable
controls in the player's "engine lab" panel instead of staying invisible.
AmplitudeJS ships no stylesheet, so its small skin lives in `styles/player.css`.

jPlayer is a jQuery plugin, so jQuery is pinned to the last 2.x release: it
still provides the `.bind()`/`.unbind()` API that jPlayer 2.9.2 expects.
