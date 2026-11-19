// Colour grades. A grade is a canvas filter for the photo plus a small recipe
// of gradient washes laid over it: a duotone wash that pushes the highlights to
// one hue and the shadows to another, a light bloom, and a vignette. The Vice
// City looks in the picker are the same machinery with different stops.
//
// Each grade keeps a `swatch` of two or three hex colours so the editor can
// draw a believable little chip of it.

/** Every grade the editor offers, in picker order. */
export const GRADES = [
  {
    id: 'sunset',
    name: 'Sunset',
    note: 'amber high, violet low',
    swatch: ['#ffcf82', '#ff7a4d', '#4b1b63'],
    filter: 'saturate(1.42) contrast(1.14) brightness(0.97) sepia(0.16)',
    top: '#ffc98a',
    bottom: '#43195f',
    wash: 0.5,
    tint: 'soft-light',
    bloom: { x: 0.72, y: 0.18, r: 0.62, color: 'rgba(255, 214, 150, 0.42)', mode: 'screen' },
    vignette: 0.34,
    grain: 0.055,
  },
  {
    id: 'neon',
    name: 'Neon',
    note: 'magenta and cyan, hard',
    swatch: ['#ff4fa3', '#8b5cf6', '#13c8dd'],
    filter: 'saturate(1.6) contrast(1.2) brightness(0.95)',
    top: '#ff5cae',
    bottom: '#0f9fc4',
    wash: 0.4,
    tint: 'overlay',
    bloom: { x: 0.28, y: 0.16, r: 0.6, color: 'rgba(255, 108, 196, 0.4)', mode: 'screen' },
    vignette: 0.42,
    grain: 0.05,
  },
  {
    id: 'vice',
    name: 'Vice',
    note: 'pink sky, blue shade',
    swatch: ['#ffa8c2', '#c07bff', '#2f6fb5'],
    filter: 'saturate(1.3) contrast(1.1) brightness(1.0) sepia(0.08)',
    top: '#ffb3c8',
    bottom: '#265f9e',
    wash: 0.36,
    tint: 'soft-light',
    bloom: { x: 0.62, y: 0.22, r: 0.68, color: 'rgba(255, 200, 220, 0.34)', mode: 'screen' },
    vignette: 0.3,
    grain: 0.045,
  },
  {
    id: 'golden',
    name: 'Golden hour',
    note: 'sepia warm, burnt low',
    swatch: ['#ffe0a3', '#e3992f', '#5b2a10'],
    filter: 'sepia(0.34) saturate(1.45) contrast(1.12) brightness(0.98)',
    top: '#ffe2a6',
    bottom: '#5c2b12',
    wash: 0.52,
    tint: 'soft-light',
    bloom: { x: 0.34, y: 0.24, r: 0.66, color: 'rgba(255, 236, 190, 0.45)', mode: 'screen' },
    vignette: 0.36,
    grain: 0.06,
  },
  {
    id: 'noir',
    name: 'Noir',
    note: 'cold steel, deep blue',
    swatch: ['#dbe9ff', '#5c7fa8', '#0b1524'],
    filter: 'saturate(0.3) contrast(1.24) brightness(0.95)',
    top: '#d6e8ff',
    bottom: '#0a1424',
    wash: 0.58,
    tint: 'soft-light',
    bloom: { x: 0.5, y: 0.14, r: 0.58, color: 'rgba(206, 230, 255, 0.28)', mode: 'screen' },
    vignette: 0.5,
    grain: 0.07,
  },
  {
    id: 'heat',
    name: 'Heat',
    note: 'blood orange, night red',
    swatch: ['#ffb066', '#ff5a2b', '#3d0b28'],
    filter: 'saturate(1.5) contrast(1.18) brightness(0.96) sepia(0.1)',
    top: '#ffa564',
    bottom: '#3a0a24',
    wash: 0.5,
    tint: 'overlay',
    bloom: { x: 0.78, y: 0.3, r: 0.6, color: 'rgba(255, 162, 96, 0.4)', mode: 'screen' },
    vignette: 0.44,
    grain: 0.055,
  },
];

const BY_ID = new Map(GRADES.map((grade) => [grade.id, grade]));

/** The grade for an id, falling back to the first (sunset) for unknown ids. */
export function gradeById(id) {
  return BY_ID.get(id) ?? GRADES[0];
}

/** The canvas filter a photo is drawn through for a grade. */
export function gradeFilter(grade) {
  return grade.filter;
}

/**
 * Lays the grade's washes over the panel already painted in `ctx`, which the
 * caller has clipped to the panel rectangle. `w` and `h` are the panel's size.
 */
export function paintGrade(ctx, w, h, grade) {
  ctx.save();
  // Duotone wash: one hue in the light, another in the shadow.
  const duo = ctx.createLinearGradient(0, 0, 0, h);
  duo.addColorStop(0, grade.top);
  duo.addColorStop(1, grade.bottom);
  ctx.globalCompositeOperation = grade.tint;
  ctx.globalAlpha = grade.wash;
  ctx.fillStyle = duo;
  ctx.fillRect(0, 0, w, h);

  // A hue pass, which is what makes two unrelated photos read as one poster:
  // it keeps each photo's light and shade but pulls their colour to the grade.
  const hue = ctx.createLinearGradient(0, 0, w, h);
  hue.addColorStop(0, grade.top);
  hue.addColorStop(1, grade.bottom);
  ctx.globalCompositeOperation = 'color';
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = hue;
  ctx.fillRect(0, 0, w, h);

  // Deepened foot: every panel gets a darker base, which is what makes the
  // sunset posters look like evening rather than noon.
  const shade = ctx.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(0.62, 'rgba(20, 4, 30, 0.16)');
  shade.addColorStop(1, 'rgba(28, 6, 40, 0.52)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 1;
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);

  // A soft light source, so the grade reads as weather and not as a filter.
  const bloom = grade.bloom;
  const reach = Math.max(w, h) * bloom.r;
  const glow = ctx.createRadialGradient(w * bloom.x, h * bloom.y, 0, w * bloom.x, h * bloom.y, reach);
  glow.addColorStop(0, bloom.color);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalCompositeOperation = bloom.mode;
  ctx.globalAlpha = 1;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Vignette: darkest in the corners, so the centre of the panel holds focus.
  const edge = Math.hypot(w, h) / 2;
  const vig = ctx.createRadialGradient(w / 2, h / 2, edge * 0.36, w / 2, h / 2, edge);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, `rgba(9, 3, 16, ${grade.vignette})`);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * A small blurred copy of the photo laid back over the panel with `screen`,
 * which gives bright edges their glow (halation) the way film does.
 */
export function paintHalation(ctx, photo, source, rect) {
  const step = 5;
  const wide = Math.max(8, Math.round(rect.w / step));
  const tall = Math.max(8, Math.round(rect.h / step));
  const small = document.createElement('canvas');
  small.width = wide;
  small.height = tall;
  const sctx = small.getContext('2d');
  if (!sctx) return;
  sctx.filter = 'blur(3px) brightness(1.5) saturate(1.1)';
  sctx.drawImage(photo.element, source.sx, source.sy, source.sw, source.sh, 0, 0, wide, tall);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.08;
  ctx.drawImage(small, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}
