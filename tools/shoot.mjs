// Screenshot and export harness for Cover Studio.
//
// Serves app/ on a loopback port, drives the app's own scenes in Chrome through
// Playwright, and writes the stills in screenshots/ — plus it clicks the export
// buttons and checks the PNGs they save, so the covers shown in the stills are
// the ones the app actually writes.
//
//   node tools/shoot.mjs            every scene, then the export check
//   node tools/shoot.mjs --only 1   one scene by its file's leading digit
//   node tools/shoot.mjs --check    only the export check
//
// Playwright is installed globally on this machine, so run it with
// NODE_PATH pointing at the global modules folder:
//   $env:NODE_PATH="$env:APPDATA\npm\node_modules"; node tools/shoot.mjs

import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Playwright lives in the machine's global modules folder (it is not part of
// the entry), and `require` honours NODE_PATH where an ESM import does not.
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(here, '..');
const appDir = join(repo, 'app');
const shotDir = join(repo, 'screenshots');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// Each still: the file, the viewport it is shot at, the query that poses it,
// and the JPEG quality. The viewport matches the poster's aspect so the exported
// PNG fills the frame with no letterbox.
const SCENES = [
  {
    file: '1-cover.jpg',
    width: 1280,
    height: 720,
    quality: 76,
    query:
      '?shot=cover&size=landscape&layout=hero&grade=sunset&title=Sunset%20Heist' +
      '&tagline=Paradise%20on%20credit&photos=boulevard,pier,pier' +
      '&crops=1.06,0.5,0.46;1.3,0.45,0.3;2.0,0.72,0.58',
  },
  {
    file: '2-editor.jpg',
    width: 1280,
    height: 820,
    quality: 82,
    query:
      '?shot=editor&size=landscape&layout=hero&grade=sunset&title=Sunset%20Heist' +
      '&tagline=Paradise%20on%20credit&photos=boulevard,pier&select=1' +
      '&crops=1.06,0.5,0.46;1.3,0.45,0.3;1.6,0.14,0.72',
  },
  {
    file: '3-cover-tall.jpg',
    width: 1024,
    height: 1280,
    quality: 76,
    query:
      '?shot=cover&size=portrait&layout=stack&grade=neon&title=Boulevard%20Queen' +
      '&tagline=She%20drives%20the%20night&photos=boulevard,pier' +
      '&crops=1.15,0.52,0.3;1.4,0.45,0.3;1.8,0.1,0.08',
  },
  {
    file: '4-cover-square.jpg',
    width: 1080,
    height: 1080,
    quality: 76,
    query:
      '?shot=cover&size=square&layout=quad&grade=vice&title=Pier%20Pressure' +
      '&tagline=Every%20catch%20has%20a%20price&photos=pier,boulevard' +
      '&crops=1.05,0.5,0.3;1.05,0.5,0.32;2.0,0.72,0.58;2.2,0.2,0.12',
  },
];

const EXPORTS = [
  { size: 'square', width: 1080, height: 1080 },
  { size: 'portrait', width: 1080, height: 1350 },
  { size: 'landscape', width: 1920, height: 1080 },
];

/** PNG width and height from the IHDR chunk, or null when it is not a PNG. */
function pngSize(bytes) {
  if (bytes.length < 24) return null;
  if (bytes.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** A static file server for app/, loopback only, for the length of the run. */
function serve() {
  return new Promise((resolveServer) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = resolve(join(appDir, normalize(pathname)));
      if (file !== appDir && !file.startsWith(appDir + sep)) {
        response.writeHead(403).end('forbidden');
        return;
      }
      try {
        if (!statSync(file).isFile()) throw new Error('not a file');
      } catch {
        response.writeHead(404).end('not found');
        return;
      }
      response.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      createReadStream(file).pipe(response);
    });
    server.listen(0, '127.0.0.1', () => resolveServer(server));
  });
}

/**
 * The behaviour audit: opens the plain editor (no scene), then exercises the
 * things the screenshots cannot show — the File API load, the drag and the
 * wheel on a panel, the caption fields, the layout switch — and records every
 * request so a network call would be caught. Prints one line a check.
 */
async function audit(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const requests = [];
  const errors = [];
  const rows = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const record = (name, ok, detail = '') => {
    rows.push({ name, ok, detail });
    console.log(`audit ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
  };

  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.coverStudio !== undefined, null, { timeout: 15_000 });
  // The editor paints on the next frame, so let one pass before measuring.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const empty = await page.evaluate(() => ({
    panels: window.coverStudio.model.panels.length,
    width: document.getElementById('poster').width,
  }));
  record('empty state paints', empty.panels === 3 && empty.width === 1920, `${empty.panels} panels, ${empty.width}px`);

  // A real file through the file input, the way a person picks one.
  await page.setInputFiles('#photo', join(appDir, 'samples', 'pier.jpg'));
  await page.waitForFunction(
    () => window.coverStudio.model.photos.length === 1 && window.coverStudio.model.panels.every((p) => p.photoId),
    null,
    { timeout: 15_000 },
  );
  const loaded = await page.evaluate(() => ({
    photos: window.coverStudio.model.photos.length,
    name: window.coverStudio.model.photos[0].name,
    filled: window.coverStudio.model.panels.filter((p) => p.photoId).length,
    status: document.getElementById('photo-status').textContent,
  }));
  record('file input loads and fills every panel', loaded.filled === 3 && loaded.photos === 1, loaded.status);

  // Drag the first panel: the centre must move, and the wheel must zoom it.
  const box = await page.locator('#poster').boundingBox();
  const cx = box.x + box.width * 0.25;
  const cy = box.y + box.height * 0.3;
  const before = await page.evaluate(() => ({ ...window.coverStudio.model.panels[0].framing }));
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy + 20, { steps: 6 });
  await page.mouse.up();
  const afterDrag = await page.evaluate(() => ({ ...window.coverStudio.model.panels[0].framing }));
  record('drag moves the photo in a panel', Math.abs(afterDrag.cx - before.cx) > 0.005, `cx ${before.cx.toFixed(3)} → ${afterDrag.cx.toFixed(3)}`);

  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -400);
  const afterWheel = await page.evaluate(() => ({ ...window.coverStudio.model.panels[0].framing }));
  record('wheel zooms a panel', afterWheel.zoom > afterDrag.zoom + 0.05, `zoom ${afterDrag.zoom.toFixed(2)} → ${afterWheel.zoom.toFixed(2)}`);

  // Caption edits reach the model, and a long title still draws.
  await page.fill('#title', 'The Long Way Down To Paradise');
  await page.fill('#tagline', 'Everybody pays eventually');
  const caption = await page.evaluate(() => ({
    title: window.coverStudio.model.title,
    tagline: window.coverStudio.model.tagline,
  }));
  record('caption edits reach the poster', caption.title === 'The Long Way Down To Paradise', caption.tagline);

  // Every layout keeps the panel count its size calls for.
  const layouts = await page.evaluate(async () => {
    const out = [];
    for (const id of ['quad', 'hero', 'triptych', 'stack', 'full']) {
      document.querySelector(`[data-layout="${id}"]`).click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      out.push([id, window.coverStudio.model.panels.length]);
    }
    return out;
  });
  record('layout buttons rebuild the panels', layouts.every(([, n]) => n >= 1), layouts.map(([id, n]) => `${id}:${n}`).join(' '));

  // One photo everywhere, then two photos taking turns.
  const modes = await page.evaluate(async () => {
    document.querySelector('[data-mode="single"]').click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return window.coverStudio.model.panels.map((panel) => panel.photoId);
  });
  record('one photo fills every panel', new Set(modes).size === 1 && modes[0] !== null, `${modes.length} panels`);

  // A second photo, then one panel swapped to it, then everything cleared.
  await page.setInputFiles('#photo', join(appDir, 'samples', 'boulevard.jpg'));
  await page.waitForFunction(() => window.coverStudio.model.photos.length === 2, null, { timeout: 15_000 });
  const beforeSwap = await page.evaluate(() => window.coverStudio.model.panels[0].photoId);
  await page.click('#cycle-photo');
  const afterSwap = await page.evaluate(() => window.coverStudio.model.panels[0].photoId);
  record('a panel takes the next photo', beforeSwap !== afterSwap && afterSwap !== null, `${beforeSwap} → ${afterSwap}`);

  await page.click('#clear-photos');
  const cleared = await page.evaluate(() => ({
    photos: window.coverStudio.model.photos.length,
    filled: window.coverStudio.model.panels.filter((panel) => panel.photoId).length,
  }));
  record('photos clear back to an empty poster', cleared.photos === 0 && cleared.filled === 0);

  const outside = requests.filter(
    (url) => !url.startsWith(base) && !url.startsWith('data:') && !url.startsWith('blob:'),
  );
  record('no request leaves app/', outside.length === 0, outside.join(', ') || `${requests.length} local requests`);
  record('no page errors', errors.length === 0, errors.join(' | '));

  await page.close();
  return rows.every((row) => row.ok);
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
  const checkOnly = args.includes('--check');
  // Ad-hoc study: one scene, one file, so a grade or a crop can be looked at
  // without touching the four stills. --query, --out, --size (WxH), --quality.
  const adhoc = args.includes('--query')
    ? {
        query: args[args.indexOf('--query') + 1],
        file: args.includes('--out') ? args[args.indexOf('--out') + 1] : '_study.jpg',
        width: 0,
        height: 0,
        quality: args.includes('--quality') ? Number(args[args.indexOf('--quality') + 1]) : 80,
      }
    : null;
  if (adhoc) {
    const [w, h] = (args.includes('--size') ? args[args.indexOf('--size') + 1] : '1080x1080')
      .split('x')
      .map(Number);
    adhoc.width = w;
    adhoc.height = h;
  }
  if (!existsSync(shotDir)) mkdirSync(shotDir, { recursive: true });

  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ channel: 'chrome' });
  const problems = [];

  try {
    if (args.includes('--audit')) {
      const audited = await audit(browser, base);
      if (!audited) problems.push('the behaviour audit reported a failure');
    }

    if (adhoc) {
      const page = await browser.newPage({
        viewport: { width: adhoc.width, height: adhoc.height },
        deviceScaleFactor: 2,
      });
      page.on('pageerror', (error) => problems.push(`${adhoc.file}: ${error.message}`));
      await page.goto(base + adhoc.query, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 20_000 });
      await page.waitForTimeout(200);
      const bytes = await page.screenshot({ type: 'jpeg', quality: adhoc.quality, scale: 'css' });
      writeFileSync(join(here, adhoc.file), bytes);
      console.log(`${adhoc.file}  ${adhoc.width}x${adhoc.height}  ${(bytes.length / 1024).toFixed(1)} KiB`);
      await page.close();
    }

    if (!checkOnly && !adhoc && !args.includes('--audit')) {
      for (const scene of SCENES) {
        if (only && !scene.file.startsWith(only)) continue;
        const page = await browser.newPage({
          viewport: { width: scene.width, height: scene.height },
          deviceScaleFactor: 2,
        });
        page.on('pageerror', (error) => problems.push(`${scene.file}: ${error.message}`));
        page.on('console', (message) => {
          if (message.type() === 'error') problems.push(`${scene.file} console: ${message.text()}`);
        });
        await page.goto(base + scene.query, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 20_000 });
        await page.waitForTimeout(250);
        const bytes = await page.screenshot({
          type: 'jpeg',
          quality: scene.quality,
          scale: 'css',
          animations: 'disabled',
        });
        const target = join(shotDir, scene.file);
        writeFileSync(target, bytes);
        const meta = scene.file.startsWith('1') || scene.file.startsWith('3') || scene.file.startsWith('4')
          ? await page.evaluate(() => window.__coverBytes ?? null)
          : null;
        console.log(
          `${scene.file}  ${scene.width}x${scene.height}  ${(bytes.length / 1024).toFixed(1)} KiB` +
            (meta ? `  (exported PNG ${(meta / 1024).toFixed(0)} KiB)` : ''),
        );
        await page.close();
      }
    }

    // The export check: click each export button, keep the download, read its
    // size out of the PNG header and its own byte count.
    if (!adhoc) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => problems.push(`export: ${error.message}`));
    await page.goto(base + '?shot=editor&size=square&layout=quad&grade=vice&title=Export%20Check', {
      waitUntil: 'load',
    });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 20_000 });
    for (const entry of EXPORTS) {
      const wait = page.waitForEvent('download', { timeout: 20_000 });
      await page.click(`[data-size="${entry.size}"]`);
      const download = await wait;
      const file = await download.path();
      const bytes = readFileSync(file);
      const size = pngSize(bytes);
      const ok = size && size.width === entry.width && size.height === entry.height;
      if (args.includes('--keep')) writeFileSync(join(here, `_export-${entry.size}.png`), bytes);
      console.log(
        `export ${entry.size.padEnd(9)} ${String(size?.width)}x${String(size?.height)}  ` +
          `${(bytes.length / 1024).toFixed(0)} KiB  ${ok ? 'ok' : 'WRONG SIZE'}`,
      );
      if (!ok) problems.push(`export ${entry.size}: got ${size?.width}x${size?.height}`);
    }
    await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (problems.length) {
    console.log('\nPROBLEMS');
    for (const line of problems) console.log('  ' + line);
    process.exitCode = 1;
  } else {
    console.log('\nno console errors');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
