import fs from "node:fs";

/*
 * SMB/Samba mounts often refuse to reopen an existing file for writing
 * (EACCES on O_TRUNC), even though creating a new file and renaming it over
 * the old one works. Every generated file in dev/data is written through this
 * helper so a failed catalog/index generation cannot abort build_dist.sh and
 * leave dist/ serving stale CSS.
 */
export function writeFileSafe(file, content) {
  const temp = `${file}.tmp`;
  try { fs.rmSync(temp, { force: true }); } catch {}
  fs.writeFileSync(temp, content, "utf8");
  try {
    fs.renameSync(temp, file);
  } catch {
    // Some mounts do not allow replacing a file either: remove it first.
    fs.rmSync(file, { force: true });
    fs.writeFileSync(file, content, "utf8");
    try { fs.rmSync(temp, { force: true }); } catch {}
  }
}
