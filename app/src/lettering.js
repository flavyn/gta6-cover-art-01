// Lettering. Everything here is drawn on the canvas with the system stack
// (Impact, then Haettenschweiler, then Arial Black): no font file ships with the
// app, so the poster has no typeface to license and nothing to download.
//
// The title is the poster's loudest element: capitals, tight tracking, a warm
// paper-white gradient, a heavy dark outline and a soft shadow, split over two
// lines when one would have to shrink too far. The tagline and the small credit
// lines are tracked-out capitals with hairlines, the way poster credits sit.

const TITLE_STACK = 'Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", sans-serif';
const SMALL_STACK = '"Helvetica Neue", Helvetica, Arial, sans-serif';

/** Draws `text` with manual tracking, so tracking is the same in every browser. */
function drawTracked(ctx, text, x, baseline, tracking, align = 'left') {
  const chars = [...text];
  const widths = chars.map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + tracking * Math.max(0, chars.length - 1);
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  for (let i = 0; i < chars.length; i += 1) {
    ctx.fillText(chars[i], cursor, baseline);
    cursor += widths[i] + tracking;
  }
  return total;
}

/** The width `drawTracked` will use, without drawing. */
function trackedWidth(ctx, text, tracking) {
  const chars = [...text];
  const widths = chars.map((char) => ctx.measureText(char).width);
  return widths.reduce((sum, width) => sum + width, 0) + tracking * Math.max(0, chars.length - 1);
}

/** Shrinks `start` until the tracked text fits `maxWidth`. */
function fitTracked(ctx, text, maxWidth, start, tracking, floor = 10) {
  let size = start;
  for (let guard = 0; guard < 240; guard += 1) {
    ctx.font = `900 ${size}px ${TITLE_STACK}`;
    if (trackedWidth(ctx, text, tracking * size) <= maxWidth || size <= floor) break;
    size = Math.floor(size * 0.96);
  }
  return size;
}

/** Splits a title in two at the space closest to its middle. */
function splitTitle(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [text];
  let best = 1;
  let bestGap = Infinity;
  for (let cut = 1; cut < words.length; cut += 1) {
    const left = words.slice(0, cut).join(' ');
    const right = words.slice(cut).join(' ');
    const gap = Math.abs(left.length - right.length);
    if (gap < bestGap) {
      bestGap = gap;
      best = cut;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

/**
 * Lays out the title: one line while it still reads big, two balanced lines
 * only when one line would have to shrink under half the starting size. Two
 * lines are then capped, so a long title never swallows the poster.
 */
function layoutTitle(ctx, text, maxWidth, start) {
  const one = text.trim();
  const single = fitTracked(ctx, one, maxWidth, start, -0.015);
  if (single >= start * 0.5 || !one.includes(' ')) {
    return { lines: [one], size: single };
  }
  const [first, second] = splitTitle(one);
  const size = Math.min(
    fitTracked(ctx, first, maxWidth, start, -0.015),
    fitTracked(ctx, second, maxWidth, start, -0.015),
    start * 0.62,
  );
  return { lines: [first, second], size: Math.max(size, start * 0.4) };
}

/**
 * The title block. `box` is `{x, baseline, w}` from the text zone; `start` is
 * the size it would like to be. Two lines stack upward from the baseline.
 */
export function drawTitle(ctx, box, title, start) {
  const text = title.trim().toUpperCase();
  if (!text) return;
  const layout = layoutTitle(ctx, text, box.w, start);
  const size = layout.size;
  const lineHeight = size * 0.92;
  const tracking = -0.015 * size;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 ${size}px ${TITLE_STACK}`;
  const widest = Math.max(...layout.lines.map((line) => trackedWidth(ctx, line, tracking)));
  const left = box.x + (box.w - widest) / 2;

  const fill = ctx.createLinearGradient(0, box.baseline - size * 0.9, 0, box.baseline + size * 0.06);
  fill.addColorStop(0, '#fffdf9');
  fill.addColorStop(0.46, '#fceacb');
  fill.addColorStop(0.78, '#f0c692');
  fill.addColorStop(1, '#e2a86d');

  layout.lines.forEach((line, index) => {
    const baseline = box.baseline - (layout.lines.length - 1 - index) * lineHeight;
    ctx.font = `900 ${size}px ${TITLE_STACK}`;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    // Shadow, then the dark outline, then the warm fill on top of it.
    ctx.shadowColor = 'rgba(8, 2, 14, 0.62)';
    ctx.shadowBlur = size * 0.24;
    ctx.shadowOffsetY = size * 0.055;
    ctx.strokeStyle = '#170a1d';
    ctx.lineWidth = size * 0.14;
    ctx.strokeText(line, left, baseline);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#170a1d';
    ctx.lineWidth = size * 0.075;
    ctx.strokeText(line, left, baseline);
    ctx.fillStyle = fill;
    ctx.fillText(line, left, baseline);
    // A thin bright edge inside the dark outline reads as printed ink.
    ctx.strokeStyle = 'rgba(255, 216, 178, 0.34)';
    ctx.lineWidth = Math.max(1, size * 0.012);
    ctx.strokeText(line, left, baseline);
  });
  ctx.restore();
  return { lines: layout.lines.length, size };
}

/** The tagline: tracked capitals between two hairlines. */
export function drawTagline(ctx, box, tagline) {
  const text = tagline.trim().toUpperCase();
  if (!text) return;
  const size = Math.round(Math.min(box.w * 0.03, 40));
  const tracking = size * 0.34;
  ctx.save();
  ctx.font = `600 ${size}px ${SMALL_STACK}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const width = Math.min(box.w * 0.92, trackedWidth(ctx, text, tracking));
  const left = box.x + (box.w - width) / 2;
  const middle = box.baseline - size * 0.34;
  ctx.fillStyle = 'rgba(255, 246, 233, 0.92)';
  const drawn = drawTracked(ctx, text, left, middle - 0, tracking, 'left');
  const room = (box.w - drawn) / 2;
  if (room > size * 2.4) {
    ctx.strokeStyle = 'rgba(255, 241, 223, 0.4)';
    ctx.lineWidth = Math.max(1, Math.round(size * 0.06));
    ctx.beginPath();
    ctx.moveTo(box.x + size * 0.6, middle);
    ctx.lineTo(box.x + room - size * 1.1, middle);
    ctx.moveTo(box.x + box.w - room + size * 1.1, middle);
    ctx.lineTo(box.x + box.w - size * 0.6, middle);
    ctx.stroke();
  }
  ctx.restore();
}

/** The production strip along the top of the plate. */
export function drawStrip(ctx, box, leftText, rightText) {
  const size = Math.max(10, Math.round(box.w * 0.0135));
  const tracking = size * 0.42;
  ctx.save();
  ctx.font = `700 ${size}px ${SMALL_STACK}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 247, 236, 0.82)';
  drawTracked(ctx, leftText.toUpperCase(), box.x, box.y, tracking, 'left');
  ctx.fillStyle = 'rgba(255, 247, 236, 0.58)';
  drawTracked(ctx, rightText.toUpperCase(), box.x + box.w, box.y, tracking, 'right');
  ctx.strokeStyle = 'rgba(255, 244, 231, 0.32)';
  ctx.lineWidth = Math.max(1, Math.round(size * 0.07));
  ctx.beginPath();
  ctx.moveTo(box.x, box.y + size * 1.15);
  ctx.lineTo(box.x + box.w, box.y + size * 1.15);
  ctx.stroke();
  ctx.restore();
}

/** The little credit line at the foot of the plate. */
export function drawCredits(ctx, box, text) {
  const size = Math.max(9, Math.round(box.w * 0.0115));
  ctx.save();
  ctx.font = `500 ${size}px ${SMALL_STACK}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 245, 232, 0.62)';
  drawTracked(ctx, text.toUpperCase(), box.x + box.w / 2, box.baseline, size * 0.36, 'center');
  ctx.restore();
}
