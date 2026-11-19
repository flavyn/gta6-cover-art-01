// Fixed scenes for the screenshots, reached with a `?shot=` query. `cover`
// poses a poster, exports it through the same PNG path a person's click uses,
// and shows the encoded PNG on its own; `editor` poses the full editor with
// photos loaded. A scene sets `window.__shotReady` once it has painted.

import { renderPng } from './export.js';
import { LAYOUTS } from './geometry.js';
import { GRADES } from './grades.js';
import { addPhotos, createProject, setLayout, setPhotoMode, setSize } from './project.js';
import { loadSample } from './photos.js';

/** The query as a typed bag with the defaults the scenes fall back on. */
function readScene(search) {
  const q = new URLSearchParams(search);
  const photos = (q.get('photos') ?? 'boulevard,pier')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const crops = (q.get('crops') ?? '')
    .split(';')
    .map((entry) => entry.split(',').map(Number))
    .filter((entry) => entry.length === 3 && entry.every(Number.isFinite));
  return {
    scene: q.get('shot') ?? '',
    size: q.get('size') ?? 'landscape',
    layout: LAYOUTS.some((layout) => layout.id === q.get('layout')) ? q.get('layout') : 'hero',
    grade: GRADES.some((grade) => grade.id === q.get('grade')) ? q.get('grade') : 'sunset',
    title: q.get('title') ?? 'Sunset Heist',
    tagline: q.get('tagline') ?? 'Paradise on credit',
    photos,
    crops,
    mode: q.get('mode') === 'single' ? 'single' : 'cycle',
    select: Number(q.get('select') ?? '0'),
  };
}

/** A project posed from a scene: size, layout, grade, words and photos. */
async function buildSceneModel(scene) {
  const model = createProject();
  model.title = scene.title;
  model.tagline = scene.tagline;
  model.grade = scene.grade;
  setSize(model, scene.size);
  setLayout(model, scene.layout);
  setPhotoMode(model, scene.mode);

  const loaded = [];
  for (const name of scene.photos) {
    loaded.push(await loadSample(name));
  }
  addPhotos(model, loaded);

  scene.crops.forEach(([zoom, cx, cy], index) => {
    if (!model.panels[index]) return;
    model.panels[index].framing = { zoom, cx, cy };
  });
  model.selected = Math.min(Math.max(0, scene.select), Math.max(0, model.panels.length - 1));
  return model;
}

/** Waits for two frames, so the camera sees the painted result. */
function settle() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** Poses the cover scene: the poster, encoded as the PNG the app writes. */
export async function runCoverShot(search) {
  const scene = readScene(search);
  const model = await buildSceneModel(scene);
  const blob = await renderPng(model, scene.size);
  document.body.classList.add('shot-cover');
  const frame = document.createElement('div');
  frame.className = 'shot-frame';
  const image = document.createElement('img');
  image.alt = `${model.title} — exported cover`;
  image.src = URL.createObjectURL(blob);
  await new Promise((resolve) => {
    image.onload = resolve;
    image.onerror = resolve;
  });
  frame.append(image);
  document.body.replaceChildren(frame);
  await settle();
  window.__shotReady = true;
  window.__coverBytes = blob.size;
}

/** Poses the editor scene: the same editor a person uses, with photos in it. */
export async function poseEditor(editor, search) {
  const scene = readScene(search);
  const model = editor.model;
  model.title = scene.title;
  model.tagline = scene.tagline;
  model.grade = scene.grade;
  setSize(model, scene.size);
  setLayout(model, scene.layout);
  setPhotoMode(model, scene.mode);

  const loaded = [];
  for (const name of scene.photos) loaded.push(await loadSample(name));
  addPhotos(model, loaded);
  scene.crops.forEach(([zoom, cx, cy], index) => {
    if (!model.panels[index]) return;
    model.panels[index].framing = { zoom, cx, cy };
  });
  model.selected = Math.min(Math.max(0, scene.select), Math.max(0, model.panels.length - 1));

  editor.els.title.value = model.title;
  editor.els.tagline.value = model.tagline;
  editor.els.layoutGrid.querySelectorAll('[data-layout]').forEach((button) => {
    button.classList.toggle('on', button.dataset.layout === model.layout);
  });
  editor.els.gradeGrid.querySelectorAll('[data-grade]').forEach((button) => {
    button.classList.toggle('on', button.dataset.grade === model.grade);
  });
  editor.els.mode.querySelectorAll('[data-mode]').forEach((button) => {
    button.classList.toggle('on', button.dataset.mode === model.photoMode);
  });

  document.body.classList.add('shot-editor');
  editor.setStatus('Cover drawn — pick a size below to save the PNG.');
  editor.redraw();
  await settle();
  window.__shotReady = true;
}
