// Photo loading. Files come from the person's own disk through the file input
// and are decoded in the page: the bytes never leave the browser, there is no
// upload anywhere in this app. The two samples under samples/ are bundled
// photos, there so the app opens with something to look at.

import { makePhoto } from './project.js';

/** The bundled sample photos, offered as chips beside the file picker. */
export const SAMPLES = [
  { name: 'boulevard', label: 'Boulevard', file: 'samples/boulevard.jpg' },
  { name: 'pier', label: 'Pier', file: 'samples/pier.jpg' },
];

let serial = 0;

/** Decodes one image element from a URL and resolves once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not decode ${url}`));
    image.src = url;
  });
}

/**
 * Decodes one File into a photo record. The object URL is revoked as soon as
 * the decode settles, so a page left open does not pin the picture's bytes.
 */
export async function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error(`${file?.name ?? 'file'} is not an image`);
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (image.decode) await image.decode().catch(() => undefined);
    serial += 1;
    return makePhoto(`photo-${serial}`, file.name.replace(/\.[^.]+$/, ''), image);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Loads several files, skipping the ones that will not decode. */
export async function loadFiles(files) {
  const loaded = [];
  for (const file of files) {
    try {
      loaded.push(await loadFile(file));
    } catch (error) {
      console.warn('skipped a file:', error.message);
    }
  }
  return loaded;
}

/** Decodes a bundled sample by name ('pier', 'boulevard'). */
export async function loadSample(name) {
  const sample = SAMPLES.find((entry) => entry.name === name) ?? SAMPLES[0];
  const image = await loadImage(new URL(sample.file, document.baseURI).href);
  serial += 1;
  return makePhoto(`sample-${sample.name}-${serial}`, sample.label, image);
}

/** The readable size of a photo, for the status line. */
export function photoSize(photo) {
  return `${photo.width} × ${photo.height}`;
}
