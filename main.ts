// Hands the entry in. The app in app/ is plain static files that run offline,
// so this program has one job: put app/ and screenshots/ under the output
// directory exactly as they are, then write dossier.json — the summary of the
// entry the judge reads — with the vendored make.fun library.
//
// The grader runs this twice and compares the two outputs byte for byte, so
// nothing here may depend on the clock, the machine or a random value: the copy
// is recursive and content-identical, and buildDossier walks app/ in path
// order.
//
//   node main.ts                      writes /output (the grader's directory)
//   MAKEFUN_OUTPUT_DIR=out node main.ts writes ./out instead
//
// Serve app/ for a look with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repo = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The entry's directory beside this file, checked before anything is written,
// so a mistake names the missing folder instead of half an output tree.
function requireDir(path: string, what: string): string {
  const full = join(repo, path);
  if (!existsSync(full) || !statSync(full).isDirectory()) {
    throw new Error(`main.ts: ${what} is missing at ${full}`);
  }
  return full;
}

const appDir = requireDir('app', 'the app folder');
const shotsDir = requireDir('screenshots', 'the screenshots folder');

mkdirSync(out, { recursive: true });
cpSync(appDir, join(out, 'app'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's limits, passed through to the library so the dossier it writes
// is one the scorer accepts: 160 KiB of source text, at most four screenshots
// of 256 KiB, and the app tree's own caps.
const dossier = buildDossier(out, {
  text_max_bytes: 160 * 1024,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  app_max_files: 993,
  app_max_bytes: 48 * 1024 * 1024,
  app_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(`main.ts: wrote ${join(out, 'app')}, ${join(out, 'screenshots')} and dossier.json (${dossier.length} bytes)`);
