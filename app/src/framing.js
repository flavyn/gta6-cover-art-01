// Crop arithmetic for one panel: a photo, a panel rectangle, and the framing
// the user set (a centre point in the photo plus a zoom). It returns the source
// rectangle to hand to drawImage, and converts pointer drags and wheel zooms
// into new framing without ever letting the photo slide off the panel.
//
// Framing is {cx, cy, zoom}: cx and cy are 0..1 across the photo, the point the
// panel is centred on; zoom is 1 at the tightest cover that fills the panel.

/** A fresh centre-and-zoom framing. */
export function defaultFraming() {
  return { cx: 0.5, cy: 0.5, zoom: 1 };
}

/** Smallest cover scale a photo needs to fill a panel, in photo pixels. */
function coverSource(photo, panel) {
  const panelRatio = panel.w / panel.h;
  const photoRatio = photo.width / photo.height;
  if (photoRatio > panelRatio) {
    // Photo is wider than the panel: full height, a slice of the width.
    return { sw: photo.height * panelRatio, sh: photo.height };
  }
  return { sw: photo.width, sh: photo.width / panelRatio };
}

/**
 * The photo rectangle a panel shows: `{sx, sy, sw, sh}` in photo pixels.
 * `framing.zoom` of 1 is the plain cover crop; larger values tighten it.
 */
export function sourceRect(photo, panel, framing) {
  const base = coverSource(photo, panel);
  const zoom = Math.max(1, framing.zoom || 1);
  const sw = Math.min(photo.width, base.sw / zoom);
  const sh = Math.min(photo.height, base.sh / zoom);
  const cx = clamp01(framing.cx ?? 0.5);
  const cy = clamp01(framing.cy ?? 0.5);
  const sx = clamp(cx * photo.width - sw / 2, 0, photo.width - sw);
  const sy = clamp(cy * photo.height - sh / 2, 0, photo.height - sh);
  return { sx, sy, sw, sh };
}

/** Keeps a framing inside the photo: centre ranges where the crop still fits. */
export function clampFraming(photo, panel, framing) {
  const base = coverSource(photo, panel);
  const zoom = clamp(framing.zoom || 1, 1, 4);
  const halfW = Math.min(1, base.sw / zoom) / photo.width / 2;
  const halfH = Math.min(1, base.sh / zoom) / photo.height / 2;
  return {
    zoom,
    cx: clamp(framing.cx ?? 0.5, halfW, 1 - halfW),
    cy: clamp(framing.cy ?? 0.5, halfH, 1 - halfH),
  };
}

/**
 * Moves the photo under the pointer by a drag of `dx`, `dy` canvas pixels
 * across a panel of `panel` pixels. The photo follows the hand, so the centre
 * moves opposite the drag, by the distance in photo space that the drag covers.
 */
export function dragFraming(photo, panel, framing, dx, dy) {
  const rect = sourceRect(photo, panel, framing);
  const next = {
    zoom: framing.zoom,
    cx: framing.cx - (dx / panel.w) * (rect.sw / photo.width),
    cy: framing.cy - (dy / panel.h) * (rect.sh / photo.height),
  };
  return clampFraming(photo, panel, next);
}

/**
 * Zooms by `factor` while keeping the photo point under `u`, `v` (0..1 across
 * the panel) where it is, which is what a wheel over a photo should do.
 */
export function zoomFraming(photo, panel, framing, factor, u, v) {
  const before = sourceRect(photo, panel, framing);
  const px = before.sx + clamp01(u) * before.sw;
  const py = before.sy + clamp01(v) * before.sh;
  const zoom = clamp((framing.zoom || 1) * factor, 1, 4);
  const after = sourceRect(photo, panel, { cx: 0.5, cy: 0.5, zoom });
  const next = {
    zoom,
    cx: (px - clamp01(u) * after.sw + after.sw / 2) / photo.width,
    cy: (py - clamp01(v) * after.sh + after.sh / 2) / photo.height,
  };
  return clampFraming(photo, panel, next);
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

function clamp01(value) {
  return clamp(Number.isFinite(value) ? value : 0.5, 0, 1);
}
