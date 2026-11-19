// The poster painter. One call draws the whole cover into a canvas at the
// export size: the plate, every panel with its photo and grade, the scrim the
// words sit on, the lettering, and the grain and vignette that hold it together.
// The preview and the PNG both go through here, so what is exported is exactly
// what the editor shows.

import { SIZES } from './geometry.js';
import { panelsFor, posterFrame, textZone } from './geometry.js';
import { sourceRect } from './framing.js';
import { gradeById, gradeFilter, paintGrade, paintHalation } from './grades.js';
import { drawCredits, drawStrip, drawTagline, drawTitle } from './lettering.js';
import { photoAt } from './project.js';

const PLATE = '#0b0712';
const PLATE_WARM = '#1a0d20';

/** A rounded rectangle path, built by hand so it works on every canvas. */
function roundRectPath(ctx, x, y, w, h, radius) {
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** A deterministic noise tile: the same grain on every render and every export. */
function noiseTile(size, strength) {
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const ctx = tile.getContext('2d');
  if (!ctx) return tile;
  const image = ctx.createImageData(size, size);
  let seed = 0x2f6e2b1;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const value = 128 + ((seed >> 16) % 2 ? 1 : -1) * ((seed >> 8) % 40) * strength;
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return tile;
}

/** Paints one panel: the photo through its grade, or a quiet empty slot. */
function paintPanel(ctx, panel, photo, framing, grade, frame) {
  ctx.save();
  roundRectPath(ctx, panel.x, panel.y, panel.w, panel.h, frame.radius);
  ctx.clip();

  if (photo) {
    const source = sourceRect(photo, panel, framing);
    ctx.filter = gradeFilter(grade);
    ctx.drawImage(photo.element, source.sx, source.sy, source.sw, source.sh, panel.x, panel.y, panel.w, panel.h);
    ctx.filter = 'none';
    ctx.save();
    ctx.translate(panel.x, panel.y);
    paintGrade(ctx, panel.w, panel.h, grade);
    ctx.restore();
    paintHalation(ctx, photo, source, panel);
  } else {
    const slot = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.w, panel.y + panel.h);
    slot.addColorStop(0, PLATE_WARM);
    slot.addColorStop(1, '#0d0814');
    ctx.fillStyle = slot;
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    const mark = Math.min(panel.w, panel.h) * 0.09;
    ctx.strokeStyle = 'rgba(255, 236, 220, 0.16)';
    ctx.lineWidth = Math.max(1, frame.short * 0.002);
    ctx.setLineDash([mark * 0.5, mark * 0.4]);
    roundRectPath(ctx, panel.x + mark, panel.y + mark, panel.w - mark * 2, panel.h - mark * 2, frame.radius);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 236, 220, 0.24)';
    ctx.font = `700 ${Math.round(frame.short * 0.019)}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD A PHOTO', panel.x + panel.w / 2, panel.y + panel.h / 2);
  }

  // A hairline along the inside of the panel edge: printed-in shadow.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.lineWidth = Math.max(1, frame.short * 0.0025);
  roundRectPath(ctx, panel.x + 1, panel.y + 1, panel.w - 2, panel.h - 2, frame.radius);
  ctx.stroke();
  ctx.restore();

  // The seam's light edge: a bright hairline that separates two panels even
  // when both photos happen to be the same tone at the join.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 246, 234, 0.2)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, panel.x + 0.5, panel.y + 0.5, panel.w - 1, panel.h - 1, frame.radius);
  ctx.stroke();
  ctx.restore();

  // Selection ring, drawn over the panel while editing only.
  if (panel.selected) {
    ctx.save();
    roundRectPath(ctx, panel.x + 1, panel.y + 1, panel.w - 2, panel.h - 2, frame.radius);
    ctx.strokeStyle = 'rgba(255, 190, 120, 0.95)';
    ctx.lineWidth = Math.max(2, frame.short * 0.004);
    ctx.setLineDash([frame.short * 0.03, frame.short * 0.018]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

/** The dark plate the panels sit on, with a warm corner where the sun would be. */
function paintPlate(ctx, frame) {
  ctx.fillStyle = PLATE;
  ctx.fillRect(0, 0, frame.width, frame.height);
  const warm = ctx.createRadialGradient(
    frame.width * 0.22,
    frame.height * 0.16,
    0,
    frame.width * 0.22,
    frame.height * 0.16,
    frame.width * 0.8,
  );
  warm.addColorStop(0, 'rgba(74, 28, 62, 0.85)');
  warm.addColorStop(1, 'rgba(11, 7, 18, 0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, frame.width, frame.height);
}

/** The bottom scrim, so the title reads over any photo, and a light top band. */
function paintScrims(ctx, frame, zone, grade) {
  const bottom = ctx.createLinearGradient(0, zone.scrimTop, 0, frame.height);
  bottom.addColorStop(0, 'rgba(7, 3, 12, 0)');
  bottom.addColorStop(0.3, 'rgba(7, 3, 12, 0.2)');
  bottom.addColorStop(0.58, 'rgba(7, 3, 12, 0.55)');
  bottom.addColorStop(0.82, 'rgba(6, 2, 10, 0.8)');
  bottom.addColorStop(1, 'rgba(5, 2, 9, 0.9)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, zone.scrimTop, frame.width, frame.height - zone.scrimTop);

  const top = ctx.createLinearGradient(0, 0, 0, frame.height * 0.26);
  top.addColorStop(0, 'rgba(6, 2, 10, 0.72)');
  top.addColorStop(1, 'rgba(6, 2, 10, 0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, frame.width, frame.height * 0.26);

  // A soft spill of the grade's own light behind the lettering, which ties the
  // type to the photos without washing them out.
  const spill = ctx.createRadialGradient(
    frame.width * 0.5,
    frame.height * 1.04,
    0,
    frame.width * 0.5,
    frame.height * 1.04,
    frame.width * 0.58,
  );
  spill.addColorStop(0, `${grade.swatch[1]}30`);
  spill.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = spill;
  ctx.fillRect(0, frame.height * 0.62, frame.width, frame.height * 0.38);
  ctx.restore();
}

/** One hue wash over the whole plate, so every panel belongs to one poster. */
function paintUnifyingWash(ctx, frame, grade) {
  const wash = ctx.createLinearGradient(0, 0, frame.width, frame.height);
  wash.addColorStop(0, grade.top);
  wash.addColorStop(1, grade.bottom);
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, frame.width, frame.height);
  ctx.restore();
}

/** Grain and a global vignette: the last pass, over panels and type alike. */
function paintFinish(ctx, frame, grade) {
  const edge = Math.hypot(frame.width, frame.height) / 2;
  const vig = ctx.createRadialGradient(
    frame.width / 2,
    frame.height / 2,
    edge * 0.42,
    frame.width / 2,
    frame.height / 2,
    edge * 1.02,
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(4, 1, 8, 0.56)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, frame.width, frame.height);

  const tile = noiseTile(96, grade.grain);
  const pattern = ctx.createPattern(tile, 'repeat');
  if (pattern) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, frame.width, frame.height);
    ctx.restore();
  }

  ctx.strokeStyle = 'rgba(255, 238, 216, 0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, frame.width - 1, frame.height - 1);

  // The printed keyline: a hairline frame inside the plate edge, the way a
  // poster holds its image in.
  const inset = Math.round(frame.short * 0.013);
  ctx.strokeStyle = 'rgba(255, 242, 224, 0.22)';
  ctx.lineWidth = Math.max(1, Math.round(frame.short * 0.0018));
  ctx.strokeRect(inset + 0.5, inset + 0.5, frame.width - inset * 2 - 1, frame.height - inset * 2 - 1);
}

/**
 * Draws the poster for `project` into `canvas`, sizing the canvas to the post
 * size. `options.selection` draws the editor's panel ring; exports leave it off.
 */
export function renderPoster(canvas, project, options = {}) {
  const size = SIZES[project.size] ?? SIZES.square;
  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return { width: size.width, height: size.height };
  const frame = posterFrame(project.size);
  const zone = textZone(project.size);
  const grade = gradeById(project.grade);
  const showSelection = options.selection === true;

  paintPlate(ctx, frame);

  const panels = panelsFor(project.layout, project.size);
  panels.forEach((panel, index) => {
    const photo = photoAt(project, index);
    const framing = project.panels[index]?.framing;
    paintPanel(ctx, { ...panel, selected: showSelection && index === project.selected }, photo, framing, grade, frame);
  });

  paintUnifyingWash(ctx, frame, grade);
  paintScrims(ctx, frame, zone, grade);
  drawStrip(ctx, zone.strip, 'Vice cover studio', 'Original art');
  drawTitle(ctx, zone.title, project.title, frame.short * 0.225);
  drawTagline(ctx, zone.tagline, project.tagline);
  drawCredits(ctx, zone.credits, 'cut from your own photo · made offline');
  paintFinish(ctx, frame, grade);

  return { width: size.width, height: size.height };
}
