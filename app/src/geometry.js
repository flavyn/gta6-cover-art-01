// Panel geometry for the poster: three post sizes, five panel layouts, and the
// text zone the lettering painter draws into. Everything here is pure numbers,
// so the exporter and the live preview lay the same poster out.
//
// A poster is a plate (dark background) with panels inset from its edge by a
// margin and separated by a thin seam, then a bottom scrim the title sits over.
// Layouts are described in unit space (0..1 of the art rectangle) and turned
// into pixels once per render.

/** The three post sizes the app exports, keyed by the id the UI uses. */
export const SIZES = {
  square: { id: 'square', width: 1080, height: 1080, label: '1080 × 1080', caption: 'feed square' },
  portrait: { id: 'portrait', width: 1080, height: 1350, label: '1080 × 1350', caption: 'tall post' },
  landscape: { id: 'landscape', width: 1920, height: 1080, label: '1920 × 1080', caption: 'wide header' },
};

/** The layouts offered in the editor, in the order the buttons show them. */
export const LAYOUTS = [
  { id: 'quad', name: 'Quad', note: 'four panels in a grid' },
  { id: 'hero', name: 'Hero', note: 'one tall panel, two beside it' },
  { id: 'triptych', name: 'Triptych', note: 'three strips' },
  { id: 'stack', name: 'Marquee', note: 'wide panel over a row' },
  { id: 'full', name: 'Full bleed', note: 'one photo, no seam' },
];

// Layout descriptions in unit space: [x, y, w, h] per panel, chosen by the
// poster's shape so a tall post gets the stacked reading and a wide one the
// side-by-side reading.
const PLANS = {
  // A pinwheel: two columns whose splits sit at different heights, so four
  // panels read as a designed poster and not as a contact sheet.
  quad: {
    tall: [[0, 0, 0.5, 0.38], [0, 0.38, 0.5, 0.62], [0.5, 0, 0.5, 0.62], [0.5, 0.62, 0.5, 0.38]],
    square: [[0, 0, 0.46, 0.62], [0.46, 0, 0.54, 0.4], [0.46, 0.4, 0.54, 0.6], [0, 0.62, 0.46, 0.38]],
    wide: [[0, 0, 0.46, 0.62], [0.46, 0, 0.54, 0.4], [0.46, 0.4, 0.54, 0.6], [0, 0.62, 0.46, 0.38]],
  },
  hero: {
    tall: [[0, 0, 1, 0.58], [0, 0.58, 0.5, 0.42], [0.5, 0.58, 0.5, 0.42]],
    square: [[0, 0, 0.62, 1], [0.62, 0, 0.38, 0.5], [0.62, 0.5, 0.38, 0.5]],
    wide: [[0, 0, 0.6, 1], [0.6, 0, 0.4, 0.5], [0.6, 0.5, 0.4, 0.5]],
  },
  triptych: {
    tall: [[0, 0, 1, 0.335], [0, 0.335, 1, 0.33], [0, 0.665, 1, 0.335]],
    square: [[0, 0, 0.335, 1], [0.335, 0.045, 0.33, 0.91], [0.665, 0, 0.335, 1]],
    wide: [[0, 0, 0.335, 1], [0.335, 0.045, 0.33, 0.91], [0.665, 0, 0.335, 1]],
  },
  stack: {
    tall: [[0, 0, 1, 0.56], [0, 0.56, 0.5, 0.44], [0.5, 0.56, 0.5, 0.44]],
    square: [[0, 0, 1, 0.6], [0, 0.6, 0.335, 0.4], [0.335, 0.6, 0.33, 0.4], [0.665, 0.6, 0.335, 0.4]],
    wide: [[0, 0, 1, 0.6], [0, 0.6, 0.335, 0.4], [0.335, 0.6, 0.33, 0.4], [0.665, 0.6, 0.335, 0.4]],
  },
  full: {
    tall: [[0, 0, 1, 1]],
    square: [[0, 0, 1, 1]],
    wide: [[0, 0, 1, 1]],
  },
};

/** 'wide', 'tall' or 'square' for a size id: which layout reading applies. */
export function shapeOf(sizeId) {
  const size = SIZES[sizeId] ?? SIZES.square;
  const ratio = size.width / size.height;
  if (ratio > 1.18) return 'wide';
  if (ratio < 0.9) return 'tall';
  return 'square';
}

/** How many panels a layout has at this size. */
export function panelCount(layoutId, sizeId) {
  const shape = shapeOf(sizeId);
  return (PLANS[layoutId] ?? PLANS.quad)[shape].length;
}

/**
 * The poster's fixed measurements: plate size, margin, seam width, corner
 * radius, and where the art rectangle sits inside the plate.
 */
export function posterFrame(sizeId) {
  const size = SIZES[sizeId] ?? SIZES.square;
  const short = Math.min(size.width, size.height);
  const margin = Math.round(short * 0.03);
  const gap = Math.max(3, Math.round(short * 0.0075));
  return {
    width: size.width,
    height: size.height,
    short,
    margin,
    gap,
    radius: Math.max(2, Math.round(short * 0.0028)),
    art: {
      x: margin,
      y: margin,
      w: size.width - margin * 2,
      h: size.height - margin * 2,
    },
  };
}

/**
 * The panels of a poster in pixels, top-left origin, with the seam taken out
 * of each shared edge so the plate shows through as a thin line.
 */
export function panelsFor(layoutId, sizeId) {
  const frame = posterFrame(sizeId);
  const plan = (PLANS[layoutId] ?? PLANS.quad)[shapeOf(sizeId)];
  const { art, gap } = frame;
  return plan.map((cell) => {
    const [nx, ny, nw, nh] = cell;
    const left = art.x + nx * art.w + (nx > 0 ? gap / 2 : 0);
    const top = art.y + ny * art.h + (ny > 0 ? gap / 2 : 0);
    const right = art.x + (nx + nw) * art.w - (nx + nw < 0.999 ? gap / 2 : 0);
    const bottom = art.y + (ny + nh) * art.h - (ny + nh < 0.999 ? gap / 2 : 0);
    return {
      x: Math.round(left),
      y: Math.round(top),
      w: Math.max(1, Math.round(right - left)),
      h: Math.max(1, Math.round(bottom - top)),
    };
  });
}

/** The layout's cells in unit space, so the editor can draw a thumbnail of it. */
export function unitCells(layoutId, sizeId) {
  return (PLANS[layoutId] ?? PLANS.quad)[shapeOf(sizeId)].map((cell) => [...cell]);
}

/** The panel a point hits, or -1 for the plate between panels. */
export function panelAt(panels, x, y) {
  for (let i = 0; i < panels.length; i += 1) {
    const p = panels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}

/** The band the title and tagline live in, below the panels' visual weight. */
export function textZone(sizeId) {
  const frame = posterFrame(sizeId);
  const { width: w, height: h, short } = frame;
  const pad = Math.round(short * 0.07);
  return {
    pad,
    strip: { x: pad, y: Math.round(short * 0.075), w: w - pad * 2 },
    title: { x: pad, baseline: Math.round(h - short * 0.19), w: w - pad * 2 },
    tagline: { x: pad, baseline: Math.round(h - short * 0.104), w: w - pad * 2 },
    credits: { x: pad, baseline: Math.round(h - short * 0.045), w: w - pad * 2 },
    scrimTop: Math.round(h - short * 0.74),
  };
}
