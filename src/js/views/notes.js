// Sezione NOTE: cartelle → elenco note → editor con salvataggio automatico.
// La navigazione interna (indietro dall'editor all'elenco, ecc.) è gestita
// da main.js tramite lo stack delle schermate.
import * as db from '../db.js';
import { t } from '../i18n/index.js';
import { toast } from '../ui/toast.js';
import { confirmDialog, promptDialog, esc } from '../ui/modal.js';

const $ = id => document.getElementById(id);

let currentFolder = null;   // { id, name }
let currentNote = null;     // id della nota aperta
let saveTimer = null;
let navigate = null;        // showScreen di main.js

export function initNotes({ showScreen }) {
  navigate = showScreen;

  $('fabFolder').addEventListener('click', async () => {
    const name = await promptDialog(t('new_folder'), t('folder_name_label'));
    if (name) { await db.createFolder(name); renderFolders(); }
  });

  $('fabNote').addEventListener('click', async () => {
    const id = await db.createNote(currentFolder.id);
    openEditor(id);
  });

  // salvataggio automatico con debounce mentre si scrive
  const autosave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCurrentNote, 600);
  };
  $('noteTitle').addEventListener('input', autosave);
  $('noteBody').addEventListener('input', autosave);
  $('noteTitle').placeholder = t('note_title_placeholder');
  $('noteBody').placeholder = t('note_body_placeholder');
}

/* ---------- cartelle ---------- */
export async function renderFolders() {
  const folders = await db.listFolders();
  const list = $('folderList');
  list.innerHTML = '';
  for (const f of folders) {
    const row = document.createElement('div');
    row.className = 'folder';
    row.innerHTML = `<span style="font-size:18px">📁</span>
      <span class="fname">${esc(f.name)}</span>
      <span class="fcount mono">${f.note_count}</span>`;

    if (f.id !== 1) {
      row.appendChild(mini('✎', async () => {
        const name = await promptDialog(t('rename_folder'), t('folder_name_label'), '', f.name);
        if (name && name !== f.name) { await db.renameFolder(f.id, name); renderFolders(); }
      }));
      row.appendChild(mini('✕', async () => {
        if (!(await confirmDialog(t('confirm_delete_folder')))) return;
        await db.deleteFolder(f.id);
        renderFolders();
      }));
    }

    row.addEventListener('click', e => {
      if (e.target.closest('.iconbtn-mini')) return;
      currentFolder = f;
      navigate('notelist', f.name);
      renderNoteList();
    });
    list.appendChild(row);
  }
}

function mini(txt, onTap) {
  const b = document.createElement('button');
  b.className = 'icon-btn iconbtn-mini';
  b.style.minWidth = b.style.minHeight = '38px';
  b.style.fontSize = '15px';
  b.textContent = txt;
  b.addEventListener('click', e => { e.stopPropagation(); onTap(); });
  return b;
}

/* ---------- elenco note ---------- */
export async function renderNoteList() {
  $('screenTitle').textContent = currentFolder.name;
  const notes = await db.listNotes(currentFolder.id);
  const list = $('noteList');
  list.innerHTML = '';
  if (!notes.length) {
    const e = document.createElement('div');
    e.className = 'sub';
    e.textContent = t('no_notes');
    list.appendChild(e);
    return;
  }
  for (const n of notes) {
    const row = document.createElement('div');
    row.className = 'note';
    row.innerHTML = `<div class="nbody">
        <div class="ntitle">${esc(n.title || firstLine(n.body) || '(…)')}</div>
        <div class="nmeta">${t('last_edit')} ${n.updated_at}</div>
      </div>`;
    row.appendChild(mini('✕', async () => {
      if (!(await confirmDialog(t('confirm_delete_note')))) return;
      await db.deleteNote(n.id);
      toast(t('deleted'));
      renderNoteList();
    }));
    row.addEventListener('click', e => {
      if (e.target.closest('.iconbtn-mini')) return;
      openEditor(n.id);
    });
    list.appendChild(row);
  }
}

const firstLine = s => (s ?? '').trim().split('\n')[0];

/* ---------- editor ---------- */
export async function openEditor(noteId) {
  currentNote = noteId;
  const n = await db.getNote(noteId);
  $('noteTitle').value = n.title;
  $('noteBody').value = n.body;
  $('noteMeta').textContent = `${t('last_edit')} ${n.updated_at}`;
  navigate('noteedit', n.title || t('new_note'));
  if (!n.title) $('noteTitle').focus();
}

async function saveCurrentNote() {
  if (!currentNote) return;
  const title = $('noteTitle').value.trim();
  const body = $('noteBody').value;
  await db.saveNote(currentNote, title, body);
  $('noteMeta').textContent = t('note_saved') + ' ✓';
}

/** Chiamata da main.js quando si lascia l'editor: salva subito ed elimina le note vuote. */
export async function leaveEditor() {
  clearTimeout(saveTimer);
  if (!currentNote) return;
  const title = $('noteTitle').value.trim();
  const body = $('noteBody').value;
  if (!title && !body.trim()) await db.deleteNote(currentNote);
  else await db.saveNote(currentNote, title, body);
  currentNote = null;
}

/** Apertura nota dai risultati di ricerca: prepara la cartella giusta. */
export async function openNoteFromSearch(note) {
  const folders = await db.listFolders();
  currentFolder = folders.find(f => f.id === note.folder_id) ?? folders[0];
  openEditor(note.id);
}
