// Boot: one project, one editor. A `?shot=` query hands the page to a
// screenshot scene instead, so the stills in screenshots/ are posed by the same
// painter and encoder the app ships.

import { createProject } from './project.js';
import { mountEditor } from './ui.js';
import { poseEditor, runCoverShot } from './shots.js';

const query = new URLSearchParams(location.search);
const scene = query.get('shot');

async function boot() {
  if (scene === 'cover') {
    await runCoverShot(location.search);
    return;
  }

  const editor = mountEditor(createProject());
  // The editor's handles, so the screenshot and audit tools can pose a still or
  // read the framing after a drag the same way the person's hand does.
  window.coverStudio = editor;
  if (document.fonts?.ready) await document.fonts.ready;
  if (scene === 'editor') {
    await poseEditor(editor, location.search);
  }
}

boot().catch((error) => {
  const status = document.getElementById('status');
  if (status) status.textContent = `Something went wrong: ${error.message}`;
  console.error(error);
});
