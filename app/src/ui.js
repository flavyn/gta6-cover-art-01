// The editor's wiring: builds the control rail from the layout, grade and size
// tables, keeps the preview in step with the project, and turns pointer drags
// and wheel scrolls over a panel into that panel's framing. All state lives in
// the project object; this module only reads it, changes it and redraws.

import { LAYOUTS, SIZES, panelAt, panelsFor, unitCells } from './geometry.js';
import { GRADES } from './grades.js';
import { renderPoster } from './painter.js';
import { exportPng } from './export.js';
import { dragFraming, zoomFraming, defaultFraming, clampFraming } from './framing.js';
import { addPhotos, clearPhotos, cyclePanelPhoto, photoAt, setLayout, setPhotoMode, setSize, syncPanels } from './project.js';
import { loadFiles, loadSample, photoSize, SAMPLES } from './photos.js';

/** The SVG thumbnail of one layout, drawn from the same unit cells as the poster. */
function layoutThumb(layoutId) {
  const cells = unitCells(layoutId, 'square');
  const w = 40;
  const h = 30;
  const rects = cells
    .map(([nx, ny, nw, nh]) => {
      const pad = 0.7;
      const x = nx * w + pad;
      const y = ny * h + pad;
      const cw = Math.max(1, nw * w - pad * 2);
      const ch = Math.max(1, nh * h - pad * 2);
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" rx="1.4"/>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${rects}</svg>`;
}

/** Collects the elements the editor touches. */
function readElements() {
  const byId = (id) => document.getElementById(id);
  return {
    canvas: byId('poster'),
    drop: byId('drop'),
    photo: byId('photo'),
    sampleChips: byId('sample-chips'),
    cyclePhoto: byId('cycle-photo'),
    clearPhotos: byId('clear-photos'),
    mode: byId('mode'),
    photoStatus: byId('photo-status'),
    layoutGrid: byId('layout-grid'),
    layoutNote: byId('layout-note'),
    gradeGrid: byId('grade-grid'),
    title: byId('title'),
    tagline: byId('tagline'),
    captionNote: byId('caption-note'),
    exportList: byId('export-list'),
    stageMeta: byId('stage-meta'),
    status: byId('status'),
  };
}

/** Builds the layout, grade, sample and export buttons once at start. */
function buildRail(els) {
  els.layoutGrid.innerHTML = LAYOUTS.map(
    (layout) => `
      <button type="button" class="layout-btn" data-layout="${layout.id}" title="${layout.note}">
        ${layoutThumb(layout.id)}
        <span>${layout.name}</span>
      </button>`,
  ).join('');

  els.gradeGrid.innerHTML = GRADES.map((grade) => {
    const [a, b, c] = grade.swatch;
    return `
      <button type="button" class="grade-btn" data-grade="${grade.id}" title="${grade.note}">
        <span class="grade-swatch" style="background: linear-gradient(120deg, ${a}, ${b} 52%, ${c})"></span>
        <span class="grade-name">${grade.name}</span>
      </button>`;
  }).join('');

  els.sampleChips.innerHTML = SAMPLES.map(
    (sample) => `<button type="button" class="chip" data-sample="${sample.name}">${sample.label} sample</button>`,
  ).join('');

  els.exportList.innerHTML = Object.values(SIZES).map(
    (size) => `
      <button type="button" class="export-btn" data-size="${size.id}">
        <b>${size.label}</b>
        <small>${size.caption}</small>
      </button>`,
  ).join('');
}

/** Marks the button whose id matches, in a group. */
function selectOne(group, attribute, value) {
  group.querySelectorAll(`[data-${attribute}]`).forEach((button) => {
    button.classList.toggle('on', button.dataset[attribute] === value);
  });
}

/** Reads the canvas pixel position of a pointer event. */
function canvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
}

/**
 * Wires the page to one project. Returns handles the screenshot scenes use, so
 * a still can be posed through the same code path as a person's click.
 */
export function mountEditor(model, els = readElements()) {
  buildRail(els);

  let pending = 0;
  const redraw = () => {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      renderPoster(els.canvas, model, { selection: true });
      const layout = LAYOUTS.find((entry) => entry.id === model.layout);
      els.stageMeta.textContent = `${layout?.name ?? ''} · ${SIZES[model.size].label}`;
      els.photoStatus.textContent = model.photos.length
        ? `${model.photos.length} photo${model.photos.length === 1 ? '' : 's'} · ${model.photos
            .map((photo) => photo.name)
            .join(', ')}`
        : 'No photo yet — choose one above, or try a sample.';
      els.captionNote.textContent = `${model.title.trim().length}/34 title · ${model.tagline.trim().length}/48 tagline`;
      els.layoutNote.textContent = layout?.note ?? '';
    });
  };

  const setStatus = (text) => {
    els.status.textContent = text;
  };

  // ---------- controls ----------

  els.layoutGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-layout]');
    if (!button) return;
    setLayout(model, button.dataset.layout);
    selectOne(els.layoutGrid, 'layout', model.layout);
    redraw();
    setStatus(`Layout: ${button.textContent.trim().replace(/\s+/g, ' ')}`);
  });

  els.gradeGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-grade]');
    if (!button) return;
    model.grade = button.dataset.grade;
    selectOne(els.gradeGrid, 'grade', model.grade);
    redraw();
    setStatus(`Grade: ${GRADES.find((grade) => grade.id === model.grade)?.name ?? ''}`);
  });

  els.mode.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');
    if (!button) return;
    setPhotoMode(model, button.dataset.mode);
    selectOne(els.mode, 'mode', model.photoMode);
    redraw();
  });

  els.title.addEventListener('input', () => {
    model.title = els.title.value;
    redraw();
  });

  els.tagline.addEventListener('input', () => {
    model.tagline = els.tagline.value;
    redraw();
  });

  els.exportList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-size]');
    if (!button) return;
    const sizeId = button.dataset.size;
    setSize(model, sizeId);
    redraw();
    button.disabled = true;
    setStatus('Drawing the cover…');
    try {
      const name = await exportPng(model, sizeId);
      setStatus(`Saved ${name}`);
    } catch (error) {
      setStatus(`Export failed: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  });

  // ---------- photos ----------

  const addLoaded = async (photos, label) => {
    if (!photos.length) {
      setStatus('That file would not decode — try a PNG or JPEG.');
      return;
    }
    addPhotos(model, photos);
    redraw();
    setStatus(`${label} ${photos.map((photo) => photo.name).join(', ')} · ${photoSize(photos[0])}`);
  };

  els.photo.addEventListener('change', async (event) => {
    const files = [...(event.target.files ?? [])];
    if (!files.length) return;
    setStatus(`Reading ${files.length} photo${files.length === 1 ? '' : 's'}…`);
    await addLoaded(await loadFiles(files), 'Loaded');
    event.target.value = '';
  });

  els.sampleChips.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-sample]');
    if (!button) return;
    setStatus('Loading the sample…');
    await addLoaded([await loadSample(button.dataset.sample)], 'Sample');
  });

  // One panel's photo can be swapped for the next one in the list, so a poster
  // can mix two photos without reloading anything.
  els.cyclePhoto.addEventListener('click', () => {
    if (model.photos.length < 2) {
      setStatus('Load two photos to swap a panel between them.');
      return;
    }
    const index = model.selected;
    cyclePanelPhoto(model, index);
    redraw();
    const photo = photoAt(model, index);
    setStatus(`Panel ${index + 1} now shows ${photo?.name ?? 'nothing'}`);
  });

  els.clearPhotos.addEventListener('click', () => {
    clearPhotos(model);
    redraw();
    setStatus('Photos cleared — the panels are empty again.');
  });

  els.drop.addEventListener('dragover', (event) => {    event.preventDefault();
    els.drop.classList.add('over');
  });
  els.drop.addEventListener('dragleave', () => els.drop.classList.remove('over'));
  els.drop.addEventListener('drop', async (event) => {
    event.preventDefault();
    els.drop.classList.remove('over');
    const files = [...(event.dataTransfer?.files ?? [])];
    if (files.length) await addLoaded(await loadFiles(files), 'Dropped');
  });

  // ---------- panel framing ----------

  let drag = null;

  els.canvas.addEventListener('pointerdown', (event) => {
    const point = canvasPoint(els.canvas, event);
    const panels = panelsFor(model.layout, model.size);
    const index = panelAt(panels, point.x, point.y);
    if (index < 0) return;
    model.selected = index;
    drag = { index, panels, x: point.x, y: point.y };
    els.canvas.setPointerCapture(event.pointerId);
    els.canvas.classList.add('dragging');
    redraw();
  });

  els.canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const point = canvasPoint(els.canvas, event);
    const dx = point.x - drag.x;
    const dy = point.y - drag.y;
    drag.x = point.x;
    drag.y = point.y;
    const panel = drag.panels[drag.index];
    const photo = photoAt(model, drag.index);
    const framing = model.panels[drag.index]?.framing;
    if (!photo || !framing) return;
    model.panels[drag.index].framing = dragFraming(photo, panel, framing, dx, dy);
    redraw();
  });

  const endDrag = (event) => {
    if (!drag) return;
    drag = null;
    els.canvas.classList.remove('dragging');
    if (event.pointerId !== undefined && els.canvas.hasPointerCapture(event.pointerId)) {
      els.canvas.releasePointerCapture(event.pointerId);
    }
  };
  els.canvas.addEventListener('pointerup', endDrag);
  els.canvas.addEventListener('pointercancel', endDrag);

  els.canvas.addEventListener(
    'wheel',
    (event) => {
      if (!model.photos.length) return;
      const point = canvasPoint(els.canvas, event);
      const panels = panelsFor(model.layout, model.size);
      const index = panelAt(panels, point.x, point.y);
      if (index < 0) return;
      event.preventDefault();
      const panel = panels[index];
      const photo = photoAt(model, index);
      const framing = model.panels[index]?.framing;
      if (!photo || !framing) return;
      model.selected = index;
      const u = (point.x - panel.x) / panel.w;
      const v = (point.y - panel.y) / panel.h;
      const factor = Math.exp(-event.deltaY * 0.0016);
      model.panels[index].framing = zoomFraming(photo, panel, framing, factor, u, v);
      redraw();
    },
    { passive: false },
  );

  els.canvas.addEventListener('dblclick', () => {
    const index = model.selected;
    const panel = panelsFor(model.layout, model.size)[index];
    const photo = photoAt(model, index);
    if (!panel || !photo) return;
    model.panels[index].framing = clampFraming(photo, panel, defaultFraming());
    redraw();
    setStatus('Panel framing reset');
  });

  // Arrow keys nudge the selected panel, and +/- zoom it.
  els.canvas.tabIndex = 0;
  els.canvas.addEventListener('keydown', (event) => {
    const panel = panelsFor(model.layout, model.size)[model.selected];
    const photo = photoAt(model, model.selected);
    const framing = model.panels[model.selected]?.framing;
    if (!panel || !photo || !framing) return;
    const step = panel.w * 0.03;
    const moves = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[event.key]) {
      event.preventDefault();
      model.panels[model.selected].framing = dragFraming(photo, panel, framing, ...moves[event.key]);
      redraw();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      model.panels[model.selected].framing = zoomFraming(photo, panel, framing, 1.12, 0.5, 0.5);
      redraw();
    } else if (event.key === '-') {
      event.preventDefault();
      model.panels[model.selected].framing = zoomFraming(photo, panel, framing, 1 / 1.12, 0.5, 0.5);
      redraw();
    }
  });

  // ---------- start ----------

  selectOne(els.layoutGrid, 'layout', model.layout);
  selectOne(els.gradeGrid, 'grade', model.grade);
  selectOne(els.mode, 'mode', model.photoMode);
  syncPanels(model);
  els.title.value = model.title;
  els.tagline.value = model.tagline;
  redraw();

  return { redraw, setStatus, model, els };
}
