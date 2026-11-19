# Cover Studio — a GTA 6 style cover art maker

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/flavyn/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/flavyn/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Turn a photo of your own and a caption into a multi-panel poster in the style of
GTA 6 cover art, then export it as a PNG at 1080 × 1080, 1080 × 1350 or
1920 × 1080. Static files only: no build step, no network request at run time,
and photos are decoded in the browser — nothing is ever uploaded.

- **Panels.** Five layouts (quad pinwheel, hero row, triptych, marquee, full bleed)
  in three post shapes, with one photo filling every panel or several taking turns.
- **Framing.** Click a panel, drag to move its photo, scroll to zoom it. Each panel
  keeps its own crop, and double-click resets it.
- **Grades.** Six canvas colour grades — sunset, neon, vice, golden hour, noir, heat —
  each a filter plus a duotone wash, a bloom and a vignette, with halation and grain
  laid over the poster at the end.
- **Lettering.** Title and tagline are drawn on the canvas with the system stack
  (`Impact`, `Haettenschweiler`, `Arial Black`): no font file ships with the app.
- **Export.** One click per size; the cover is always drawn at full resolution, never
  upscaled from the preview.

The app is original cover-art machinery: no Rockstar Games logo, wordmark, artwork
or font file is included. The two sample photos under `app/samples/` were made with
an image model and are free to use.

## Run it

The app is plain static files under `app/`, so any static server will do:

```sh
node serve.ts          # serves app/ on http://localhost:8080
```

Open <http://localhost:8080>, choose a photo (or one of the samples), pick a layout,
a grade and a size, then save the PNG.

`main.ts` hands the entry in: it copies `app/` and `screenshots/` to `/output` and
writes `/output/dossier.json`. Outside the grader, `MAKEFUN_OUTPUT_DIR` stands in:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`tools/shoot.mjs` re-takes the screenshots, audits the editor (photo load, drag,
zoom, caption, layouts, export sizes) and checks the three exported PNGs. It needs
Playwright, resolved from the global modules folder through `NODE_PATH`:

```sh
NODE_PATH="$(npm root -g)" node tools/shoot.mjs --audit
```

MIT licensed, see [LICENSE](./LICENSE).
