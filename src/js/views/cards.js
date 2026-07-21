// Sezione BIGLIETTI DA VISITA 📇 — il "wallet": si fotografa il bigliettino
// fronte e retro, si segnano nome/mestiere/numero e da lì si chiama in due tap
// (idraulico, elettricista, meccanico...).
// Le foto sono ridimensionate qui e salvate come data URL nel DB: niente file
// sparsi, il backup JSON se le porta dietro e l'app resta offline.
import * as db from '../db.js';
import { t } from '../i18n/index.js';
import { toast } from '../ui/toast.js';
import { confirmDialog, esc } from '../ui/modal.js';
import {
  TRADES, DEFAULT_ICON, telHref, mailHref,
  cardMatches, cardInTrade, sortCards, tradeFilters, cardSubtitle,
} from '../logic/cards.js';

const $ = id => document.getElementById(id);

// Lato lungo massimo della foto salvata: leggibile a schermo senza gonfiare il DB.
const MAX_SIDE = 1400;
const JPEG_QUALITY = 0.75;

let navigate = null;
let currentId = null;   // biglietto aperto nel dettaglio
let query = '';
let tradeFilter = '';

export function initCards({ showScreen }) {
  navigate = showScreen;
  $('fabCard').addEventListener('click', () => openCardModal(null));
  $('cardSearch').addEventListener('input', e => {
    query = e.target.value;
    renderCards();
  });
  $('imgViewClose').addEventListener('click', closeViewer);
  $('imgOverlay').addEventListener('click', e => {
    if (e.target === $('imgOverlay')) closeViewer();
  });
}

/* ================= azioni di sistema ================= */
// tel: e mailto: passano dal plugin opener (già permesso da "opener:default").
async function openExternal(url) {
  try {
    await window.__TAURI__.opener.openUrl(url);
  } catch {
    window.open(url, '_blank');
  }
}

async function call(phone) {
  const href = telHref(phone);
  if (!href) { toast(t('card_no_phone')); return; }
  await openExternal(href);
}

/* ================= foto: scatto e ridimensionamento ================= */
// Un solo <input type=file>: con capture="environment" Android apre la fotocamera,
// senza apre la galleria; su desktop è sempre il selettore file.
function pickFile(useCamera) {
  return new Promise(resolve => {
    const input = $('cardFileInput');
    if (useCamera) input.setAttribute('capture', 'environment');
    else input.removeAttribute('capture');
    input.value = '';               // così ri-scegliere lo stesso file rilancia change
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      input.onchange = null;
      resolve(file);
    };
    input.click();
  });
}

// Ridimensiona a MAX_SIDE sul lato lungo e ricomprime in JPEG.
function shrink(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}

async function grabPhoto(useCamera) {
  const file = await pickFile(useCamera);
  if (!file) return null;
  try {
    return await shrink(file);
  } catch {
    toast(t('card_photo_error'));
    return null;
  }
}

/* ================= visore foto a schermo intero ================= */
function openViewer(dataUrl) {
  $('imgViewImg').src = dataUrl;
  $('imgOverlay').classList.add('open');
}

function closeViewer() {
  $('imgOverlay').classList.remove('open');
  $('imgViewImg').src = '';
}

/* ================= elenco ================= */
function mini(txt, onTap, label) {
  const b = document.createElement('button');
  b.className = 'icon-btn iconbtn-mini';
  b.style.minWidth = b.style.minHeight = '38px';
  b.style.fontSize = '15px';
  b.textContent = txt;
  if (label) b.setAttribute('aria-label', label);
  b.addEventListener('click', e => { e.stopPropagation(); onTap(); });
  return b;
}

export async function renderCards() {
  $('cardSearch').placeholder = t('card_search_placeholder');
  if ($('cardSearch').value !== query) $('cardSearch').value = query;

  const all = await db.listCards();
  renderTradeChips(all);

  const list = $('cardList');
  list.innerHTML = '';

  if (!all.length) {
    const e = document.createElement('div');
    e.className = 'sub';
    e.style.cssText = 'padding:16px 12px';
    e.textContent = t('no_cards');
    list.appendChild(e);
    return;
  }

  const shown = sortCards(all.filter(c => cardInTrade(c, tradeFilter) && cardMatches(c, query)));
  if (!shown.length) {
    const e = document.createElement('div');
    e.className = 'sub';
    e.style.cssText = 'padding:16px 12px';
    e.textContent = t('no_results');
    list.appendChild(e);
    return;
  }

  for (const c of shown) {
    const row = document.createElement('div');
    row.className = 'folder';
    const photo = c.has_front || c.has_back ? ' 📷' : '';
    row.innerHTML = `<span class="card-ico">${esc(c.icon || DEFAULT_ICON)}</span>
      <div class="nbody">
        <div class="fname">${c.favorite ? '★ ' : ''}${esc(c.name)}</div>
        <div class="nmeta">${esc(cardSubtitle(c))}${photo}</div>
      </div>`;
    // Chiamare è l'azione principale: tasto grande, sempre a destra.
    if (telHref(c.phone)) {
      const callBtn = mini('📞', () => call(c.phone), t('card_call'));
      callBtn.classList.add('callbtn');
      row.appendChild(callBtn);
    }
    row.addEventListener('click', e => {
      if (e.target.closest('.iconbtn-mini')) return;
      currentId = c.id;
      navigate('card');
    });
    list.appendChild(row);
  }
}

function renderTradeChips(all) {
  const bar = $('cardFilters');
  bar.innerHTML = '';
  const trades = tradeFilters(all);
  if (trades.length < 2) return;   // con un mestiere solo il filtro non serve

  const chip = (label, value) => {
    const b = document.createElement('button');
    b.className = 'fchip' + (tradeFilter === value ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      tradeFilter = value;
      renderCards();
    });
    bar.appendChild(b);
  };
  chip(t('filter_all'), '');
  for (const tr of trades) chip(`${tr.icon} ${tr.trade} (${tr.count})`, tr.trade);
}

/* ================= dettaglio ================= */
export async function renderCard() {
  if (currentId == null) { navigate('cards'); return; }
  const c = await db.getCard(currentId);
  if (!c) { navigate('cards'); return; }
  $('screenTitle').textContent = c.name;

  const body = $('cardBody');
  body.innerHTML = '';

  // foto fronte/retro: tap per ingrandire
  if (c.front || c.back) {
    const shots = document.createElement('div');
    shots.className = 'card-shots';
    for (const [img, key] of [[c.front, 'card_front'], [c.back, 'card_back']]) {
      if (!img) continue;
      const fig = document.createElement('button');
      fig.type = 'button';
      fig.className = 'shot';
      fig.innerHTML = `<img src="${img}" alt="${esc(t(key))}" /><span>${esc(t(key))}</span>`;
      fig.addEventListener('click', () => openViewer(img));
      shots.appendChild(fig);
    }
    body.appendChild(shots);
  }

  // azioni rapide: chiamare è la prima e la più grande
  const acts = document.createElement('div');
  acts.className = 'card-acts';
  const bigBtn = (label, cls, onTap) => {
    const b = document.createElement('button');
    b.className = 'btn ' + cls;
    b.textContent = label;
    b.addEventListener('click', onTap);
    acts.appendChild(b);
  };
  if (telHref(c.phone)) bigBtn(`📞 ${t('card_call')}`, 'accent', () => call(c.phone));
  if (telHref(c.phone2)) bigBtn(`📞 ${t('card_call2')}`, '', () => call(c.phone2));
  if (mailHref(c.email)) bigBtn(`✉ ${t('card_email')}`, '', () => openExternal(mailHref(c.email)));
  if (acts.children.length) body.appendChild(acts);

  // scheda dati
  const info = document.createElement('div');
  info.className = 'statcard';
  const line = (label, value) => value
    ? `<div class="payline"><span>${esc(label)}</span><span class="mono">${esc(value)}</span></div>`
    : '';
  info.innerHTML = [
    line(t('card_trade_label'), `${c.icon || DEFAULT_ICON} ${c.trade}`.trim()),
    line(t('card_phone_label'), c.phone),
    line(t('card_phone2_label'), c.phone2),
    line(t('card_email_label'), c.email),
    line(t('card_address_label'), c.address),
  ].join('');
  if (c.notes) {
    const n = document.createElement('div');
    n.className = 'nmeta';
    n.style.cssText = 'margin-top:8px;white-space:pre-wrap';
    n.textContent = c.notes;
    info.appendChild(n);
  }
  body.appendChild(info);

  // preferito / modifica / elimina
  const tools = document.createElement('div');
  tools.className = 'card-acts';
  const fav = document.createElement('button');
  fav.className = 'btn' + (c.favorite ? ' accent' : '');
  fav.textContent = c.favorite ? `★ ${t('card_favorite')}` : `☆ ${t('card_favorite')}`;
  fav.addEventListener('click', async () => {
    await db.setCardFavorite(c.id, !c.favorite);
    renderCard();
  });
  tools.appendChild(fav);

  const edit = document.createElement('button');
  edit.className = 'btn';
  edit.textContent = `✎ ${t('edit_card')}`;
  edit.addEventListener('click', () => openCardModal(c));
  tools.appendChild(edit);

  const del = document.createElement('button');
  del.className = 'btn danger';
  del.textContent = `✕ ${t('delete')}`;
  del.addEventListener('click', async () => {
    if (!(await confirmDialog(t('confirm_delete_card')))) return;
    await db.deleteCard(c.id);
    currentId = null;
    toast(t('deleted'));
    navigate('cards');
  });
  tools.appendChild(del);
  body.appendChild(tools);
}

/* ================= modale nuovo/modifica ================= */
function openCardModal(existing) {
  const ov = $('cardOverlay');
  $('cardModalTitle').textContent = existing ? t('edit_card') : t('new_card');

  // stato locale della modale: le foto si applicano solo al salvataggio
  const draft = {
    front: existing?.front ?? '',
    back: existing?.back ?? '',
    icon: existing?.icon || DEFAULT_ICON,
  };

  $('cdName').value = existing?.name ?? '';
  $('cdName').placeholder = t('card_name_placeholder');
  $('cdTrade').value = existing?.trade ?? '';
  $('cdTrade').placeholder = t('card_trade_placeholder');
  $('cdPhone').value = existing?.phone ?? '';
  $('cdPhone2').value = existing?.phone2 ?? '';
  $('cdEmail').value = existing?.email ?? '';
  $('cdAddress').value = existing?.address ?? '';
  $('cdNotes').value = existing?.notes ?? '';
  $('cdFavorite').checked = !!existing?.favorite;

  // chip dei mestieri suggeriti: riempiono nome del mestiere + icona
  const chips = $('cdTrades');
  chips.innerHTML = '';
  for (const tr of TRADES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${tr.icon} ${t(tr.key)}`;
    b.className = draft.icon === tr.icon ? 'active' : '';
    b.addEventListener('click', () => {
      draft.icon = tr.icon;
      $('cdTrade').value = t(tr.key);
      chips.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    });
    chips.appendChild(b);
  }

  // riquadri foto fronte/retro con i tasti Scatta / Galleria / Rimuovi
  const paintShots = () => {
    for (const side of ['front', 'back']) {
      const box = $(side === 'front' ? 'cdShotFront' : 'cdShotBack');
      box.innerHTML = '';
      const cap = document.createElement('span');
      cap.className = 'shot-cap';
      cap.textContent = t(side === 'front' ? 'card_front' : 'card_back');
      box.appendChild(cap);

      if (draft[side]) {
        const img = document.createElement('img');
        img.src = draft[side];
        img.alt = cap.textContent;
        img.addEventListener('click', () => openViewer(draft[side]));
        box.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'shot-empty';
        ph.textContent = '📷';
        box.appendChild(ph);
      }

      const row = document.createElement('div');
      row.className = 'shot-btns';
      const sb = (label, onTap) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn small';
        b.textContent = label;
        b.addEventListener('click', onTap);
        row.appendChild(b);
      };
      sb(`📷 ${t('card_shoot')}`, async () => {
        const data = await grabPhoto(true);
        if (data) { draft[side] = data; paintShots(); }
      });
      sb(`🖼 ${t('card_gallery')}`, async () => {
        const data = await grabPhoto(false);
        if (data) { draft[side] = data; paintShots(); }
      });
      if (draft[side]) sb('✕', () => { draft[side] = ''; paintShots(); });
      box.appendChild(row);
    }
  };
  paintShots();

  const del = $('cdDelete');
  del.hidden = !existing;

  const done = () => {
    ov.classList.remove('open');
    $('cdSave').onclick = $('cdCancel').onclick = del.onclick = ov.onclick = null;
  };
  $('cdCancel').onclick = done;
  ov.onclick = e => { if (e.target === ov) done(); };
  del.onclick = async () => {
    if (!(await confirmDialog(t('confirm_delete_card')))) return;
    await db.deleteCard(existing.id);
    done();
    toast(t('deleted'));
    if (currentId === existing.id) { currentId = null; navigate('cards'); }
    else renderCards();
  };
  $('cdSave').onclick = async () => {
    const c = {
      name: $('cdName').value.trim(),
      trade: $('cdTrade').value.trim(),
      icon: draft.icon,
      phone: $('cdPhone').value.trim(),
      phone2: $('cdPhone2').value.trim(),
      email: $('cdEmail').value.trim(),
      address: $('cdAddress').value.trim(),
      notes: $('cdNotes').value.trim(),
      favorite: $('cdFavorite').checked,
      front: draft.front,
      back: draft.back,
    };
    if (!c.name) { toast(t('missing_title')); return; }
    if (existing) await db.updateCard(existing.id, c);
    else await db.createCard(c);
    done();
    toast(t('saved'));
    if (existing && currentId === existing.id) renderCard();
    else renderCards();
  };
  ov.classList.add('open');
  $('cdName').focus();
}
