// PNG export. A cover is always drawn at its full post size into a canvas of
// its own and encoded there, never upscaled from the preview, so the file that
// lands in the person's downloads is exactly the resolution they picked.

import { SIZES } from './geometry.js';
import { renderPoster } from './painter.js';

/** A safe file name stem from the poster's title. */
function stem(project) {
  const slug = project.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'cover';
}

/** The name an export is saved under, e.g. sunset-heist-1080x1350.png. */
export function exportName(project, sizeId) {
  const size = SIZES[sizeId] ?? SIZES.square;
  return `${stem(project)}-${size.width}x${size.height}.png`;
}

/** Renders the poster at `sizeId` and resolves to its PNG blob. */
export function renderPng(project, sizeId) {
  const size = SIZES[sizeId] ?? SIZES.square;
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  renderPoster(canvas, { ...project, size: sizeId });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('the browser could not encode the PNG'));
    }, 'image/png');
  });
}

/** Hands a blob to the browser's downloader. */
export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20_000);
}

/** Renders and downloads one cover; resolves to the name it saved. */
export async function exportPng(project, sizeId) {
  const blob = await renderPng(project, sizeId);
  const name = exportName(project, sizeId);
  saveBlob(blob, name);
  return name;
}
