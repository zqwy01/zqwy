/* Backward-compatible entry point: the player now lives in
 * music/player/ and is loaded as ES modules. Keep this path so all pages
 * (and scripts/build_wiki_notes.mjs) can keep referencing scripts/player.js.
 */
import "./music/player/index.js";
