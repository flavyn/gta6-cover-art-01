// The project: everything the poster preview needs to know, and the small
// rules that keep it consistent when the size, the layout or the photos change.
// Pure data and functions, no DOM, so the exporter and the editor share it.

import { LAYOUTS, SIZES, panelCount } from './geometry.js';
import { defaultFraming } from './framing.js';

/** A blank project: a wide hero poster with the first grade and no photos. */
export function createProject() {
  return {
    layout: 'hero',
    size: 'landscape',
    grade: 'sunset',
    title: 'SUNSET HEIST',
    tagline: 'PARADISE ON CREDIT',
    photoMode: 'cycle',
    photos: [],
    panels: [],
    selected: 0,
  };
}

/** A photo record: the decoded image, its name, and the size it decodes at. */
export function makePhoto(id, name, element) {
  return {
    id,
    name,
    element,
    width: element.naturalWidth || element.width,
    height: element.naturalHeight || element.height,
  };
}

/**
 * Reconciles the panel list with the layout and the photos: the right number of
 * panels, each holding a photo and a framing, and no panel left over.
 */
export function syncPanels(project) {
  const wanted = panelCount(project.layout, project.size);
  const next = [];
  for (let i = 0; i < wanted; i += 1) {
    const old = project.panels[i];
    const photo = photoForSlot(project, i);
    const framing = old?.framing ? { ...old.framing } : defaultFraming();
    next.push({ photoId: photo ? photo.id : null, framing });
  }
  project.panels = next;
  project.selected = Math.min(Math.max(0, project.selected), Math.max(0, wanted - 1));
  return project;
}

/** The photo a panel slot should show, by the current fill mode. */
function photoForSlot(project, index) {
  const photos = project.photos;
  if (photos.length === 0) return null;
  if (project.photoMode === 'single') return photos[0];
  return photos[index % photos.length];
}

/** The photo record of panel `index`, or null when the panel is empty. */
export function photoAt(project, index) {
  const panel = project.panels[index];
  if (!panel || !panel.photoId) return null;
  return project.photos.find((photo) => photo.id === panel.photoId) ?? null;
}

/** Adds decoded photos to the project and refills the panels. */
export function addPhotos(project, photos) {
  const known = new Set(project.photos.map((photo) => photo.id));
  for (const photo of photos) {
    if (!known.has(photo.id)) {
      project.photos.push(photo);
      known.add(photo.id);
    }
  }
  refill(project);
  return project;
}

/** Drops every photo, keeping the layout, grade and words. */
export function clearPhotos(project) {
  project.photos = [];
  refill(project);
  return project;
}

/** Reassigns every panel from the photo list under the current fill mode. */
export function refill(project) {
  syncPanels(project);
  for (let i = 0; i < project.panels.length; i += 1) {
    const photo = photoForSlot(project, i);
    project.panels[i].photoId = photo ? photo.id : null;
    project.panels[i].framing = defaultFraming();
  }
  return project;
}

/** Puts the next photo of the list into one panel, keeping its framing. */
export function cyclePanelPhoto(project, index) {
  const panel = project.panels[index];
  if (!panel || project.photos.length === 0) return project;
  const now = project.photos.findIndex((photo) => photo.id === panel.photoId);
  const next = project.photos[(now + 1) % project.photos.length];
  panel.photoId = next.id;
  panel.framing = defaultFraming();
  return project;
}

/** Sets the layout and reconciles the panels. */
export function setLayout(project, layoutId) {
  if (!LAYOUTS.some((layout) => layout.id === layoutId)) return project;
  project.layout = layoutId;
  syncPanels(project);
  for (let i = 0; i < project.panels.length; i += 1) {
    const photo = photoForSlot(project, i);
    project.panels[i].photoId = photo ? photo.id : null;
    project.panels[i].framing = defaultFraming();
  }
  return project;
}

/** Sets the post size and reconciles the panels for its shape. */
export function setSize(project, sizeId) {
  if (!SIZES[sizeId]) return project;
  project.size = sizeId;
  syncPanels(project);
  for (let i = 0; i < project.panels.length; i += 1) {
    const photo = photoForSlot(project, i);
    project.panels[i].photoId = photo ? photo.id : null;
  }
  return project;
}

/** Sets the fill mode: one photo everywhere, or the list taking turns. */
export function setPhotoMode(project, mode) {
  project.photoMode = mode === 'single' ? 'single' : 'cycle';
  for (let i = 0; i < project.panels.length; i += 1) {
    const photo = photoForSlot(project, i);
    project.panels[i].photoId = photo ? photo.id : null;
  }
  return project;
}
