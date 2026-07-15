// Sezione PAGAMENTI 🧮: sezioni attivabili (Auto, Elettronica, + personali),
// dentro ogni sezione i pagamenti a rate. Il totale da versare si imposta a
// mano (opzionale); i "versati" li calcola l'app sommando le rate.
// Gli importi vivono in CENTESIMI (logic/money.js).
import * as db from '../db.js';
import { t, getLang } from '../i18n/index.js';
import { toast } from '../ui/toast.js';
import { confirmDialog, esc } from '../ui/modal.js';
import { toIso } from '../logic/recurrence.js';
import { parseAmount, fmtAmount, paidPercent } from '../logic/money.js';

const $ = id => document.getElementById(id);

const PAY_ICONS = ['🚗', '📱', '💻', '🏠', '💳', '🛵', '📺', '⌚', '🎮', '🎓', '✈️', '🛠'];
// Sezioni suggerite quando non ce n'è ancora nessuna.
const SUGGESTED = [
  { icon: '🚗', key: 'pay_suggest_car' },
  { icon: '📱', key: 'pay_suggest_electronics' },
];

let navigate = null;
let currentCat = null;    // { id, name, icon }
let currentPlan = null;   // { id, name, total, paid }

const fmt = cents => fmtAmount(cents, getLang());

export function initPayments({ showScreen }) {
  navigate = showScreen;
  $('fabPayCat').addEventListener('click', () => openCategoryModal(null));
  $('fabPayPlan').addEventListener('click', () => openPlanModal(null));
  $('fabInstallment').addEventListener('click', () => openInstallmentModal(null));
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

const firstLine = s => (s ?? '').trim().split('\n')[0];

/* ================= elenco sezioni ================= */
export async function renderCategories() {
  const cats = await db.listPayCategories();
  const list = $('payCatList');
  list.innerHTML = '';

  if (!cats.length) {
    const e = document.createElement('div');
    e.className = 'sub';
    e.textContent = t('no_pay_categories');
    list.appendChild(e);
    // sezioni suggerite: un tocco e sono attive
    for (const s of SUGGESTED) {
      const b = document.createElement('button');
      b.className = 'btn accent';
      b.style.cssText = 'margin:6px 12px;display:block;width:calc(100% - 24px);text-align:left';
      b.textContent = `${s.icon} ${t(s.key)}`;
      b.addEventListener('click', async () => {
        await db.createPayCategory(t(s.key), s.icon);
        renderCategories();
      });
      list.appendChild(b);
    }
    return;
  }

  for (const c of cats) {
    const row = document.createElement('div');
    row.className = 'folder';
    row.innerHTML = `<span style="font-size:20px">${esc(c.icon)}</span>
      <div class="nbody">
        <div class="fname">${esc(c.name)}</div>
        <div class="nmeta">${c.plan_count} · ${t('paid_label')}: ${esc(fmt(c.paid))}</div>
      </div>`;
    row.appendChild(mini('✎', () => openCategoryModal(c)));
    row.appendChild(mini('✕', async () => {
      if (!(await confirmDialog(t('confirm_delete_pay_category')))) return;
      await db.deletePayCategory(c.id);
      toast(t('deleted'));
      renderCategories();
    }));
    row.addEventListener('click', e => {
      if (e.target.closest('.iconbtn-mini')) return;
      currentCat = c;
      navigate('paycat');
    });
    list.appendChild(row);
  }
}

/* ---------- modale sezione ---------- */
function openCategoryModal(existing) {
  const ov = $('pcatOverlay');
  $('pcatTitle').textContent = existing ? t('edit_pay_category') : t('new_pay_category');
  const nameInput = $('pcatName');
  nameInput.placeholder = t('pay_category_placeholder');
  nameInput.value = existing?.name ?? '';
  let icon = existing?.icon ?? PAY_ICONS[0];

  const icons = $('pcatIcons');
  icons.innerHTML = '';
  for (const em of PAY_ICONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = em;
    b.className = em === icon ? 'active' : '';
    b.addEventListener('click', () => {
      icon = em;
      icons.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    });
    icons.appendChild(b);
  }

  const done = () => {
    ov.classList.remove('open');
    $('pcatSave').onclick = $('pcatCancel').onclick = ov.onclick = null;
  };
  $('pcatCancel').onclick = done;
  ov.onclick = e => { if (e.target === ov) done(); };
  $('pcatSave').onclick = async () => {
    const name = nameInput.value.trim();
    if (!name) { toast(t('missing_title')); return; }
    if (existing) await db.updatePayCategory(existing.id, name, icon);
    else await db.createPayCategory(name, icon);
    done();
    toast(t('saved'));
    renderCategories();
  };
  ov.classList.add('open');
  nameInput.focus();
}

/* ================= sezione: elenco pagamenti ================= */
export async function renderCategory() {
  if (!currentCat) { navigate('payments'); return; }
  const cats = await db.listPayCategories();
  const c = cats.find(x => x.id === currentCat.id);
  if (!c) { navigate('payments'); return; }
  currentCat = c;
  $('screenTitle').textContent = `${c.icon} ${c.name}`;

  const body = $('payCatBody');
  body.innerHTML = '';

  const plans = await db.listPayPlans(c.id);
  if (!plans.length) {
    const e = document.createElement('div');
    e.className = 'sub';
    e.textContent = t('no_pay_plans');
    body.appendChild(e);
    return;
  }

  for (const p of plans) {
    const row = document.createElement('div');
    row.className = 'note';
    const pct = paidPercent(p.paid, p.total);
    const amounts = p.total != null
      ? `${t('paid_label')}: ${fmt(p.paid)} / ${fmt(p.total)} · ${t('remaining_label')}: ${fmt(Math.max(0, p.total - p.paid))}`
      : `${t('paid_label')}: ${fmt(p.paid)} · ${p.installment_count} ${t('installments_count')}`;
    row.innerHTML = `<div class="nbody">
        <div class="ntitle">${esc(p.name)}</div>
        <div class="nmeta">${esc(amounts)}</div>
        ${pct != null ? `<div class="paybar"><span style="width:${pct}%"></span></div>` : ''}
      </div>`;
    row.appendChild(mini('✕', async () => {
      if (!(await confirmDialog(t('confirm_delete_pay_plan')))) return;
      await db.deletePayPlan(p.id);
      toast(t('deleted'));
      renderCategory();
    }));
    row.addEventListener('click', e => {
      if (e.target.closest('.iconbtn-mini')) return;
      currentPlan = p;
      navigate('payplan');
    });
    body.appendChild(row);
  }
}

/* ---------- modale pagamento ---------- */
function openPlanModal(existing) {
  const ov = $('pplanOverlay');
  $('pplanTitle').textContent = existing ? t('edit_pay_plan') : t('new_pay_plan');
  $('pplanName').placeholder = t('pay_plan_placeholder');
  $('pplanName').value = existing?.name ?? '';
  $('pplanTotal').placeholder = t('amount_placeholder');
  $('pplanTotal').value = existing?.total != null ? fmt(existing.total) : '';
  $('pplanNotes').value = existing?.notes ?? '';

  const delBtn = $('pplanDelete');
  delBtn.hidden = !existing;

  const done = () => {
    ov.classList.remove('open');
    $('pplanSave').onclick = $('pplanCancel').onclick = delBtn.onclick = ov.onclick = null;
  };
  $('pplanCancel').onclick = done;
  ov.onclick = e => { if (e.target === ov) done(); };
  delBtn.onclick = async () => {
    if (!(await confirmDialog(t('confirm_delete_pay_plan')))) return;
    await db.deletePayPlan(existing.id);
    done();
    toast(t('deleted'));
    renderCategory();
  };
  $('pplanSave').onclick = async () => {
    const name = $('pplanName').value.trim();
    if (!name) { toast(t('missing_title')); return; }
    const totalTxt = $('pplanTotal').value.trim();
    let total = null;
    if (totalTxt) {
      total = parseAmount(totalTxt);
      if (total == null || total < 0) { toast(t('invalid_amount')); return; }
    }
    const p = { name, total, notes: $('pplanNotes').value.trim() };
    if (existing) await db.updatePayPlan(existing.id, p);
    else await db.createPayPlan(currentCat.id, p);
    done();
    toast(t('saved'));
    // se si arriva dal dettaglio pagamento, aggiorna anche quello
    if (existing && currentPlan?.id === existing.id) renderPlan();
    else renderCategory();
  };
  ov.classList.add('open');
  $('pplanName').focus();
}

/* ================= pagamento: rate + calcolo automatico ================= */
export async function renderPlan() {
  if (!currentPlan) { navigate('payments'); return; }
  const p = await db.getPayPlan(currentPlan.id);
  if (!p) { navigate('payments'); return; }
  currentPlan = p;
  $('screenTitle').textContent = p.name;

  const body = $('payPlanBody');
  body.innerHTML = '';

  // riepilogo: versati (somma automatica), totale manuale, rimanenti
  const sum = document.createElement('div');
  sum.className = 'statcard';
  const pct = paidPercent(p.paid, p.total);
  sum.innerHTML = `
    <div class="payline"><span>${t('paid_label')}</span><span class="mono accent-ink">${esc(fmt(p.paid))}</span></div>
    ${p.total != null ? `
      <div class="payline"><span>${t('total_label')}</span><span class="mono">${esc(fmt(p.total))}</span></div>
      <div class="payline"><span>${t('remaining_label')}</span><span class="mono">${esc(fmt(Math.max(0, p.total - p.paid)))}</span></div>
      <div class="paybar big"><span style="width:${pct}%"></span></div>` : ''}
    ${p.notes ? `<div class="nmeta" style="margin-top:8px">${esc(firstLine(p.notes))}</div>` : ''}`;
  const editBtn = document.createElement('button');
  editBtn.className = 'btn small';
  editBtn.style.marginTop = '10px';
  editBtn.textContent = `✎ ${t('edit_pay_plan')}`;
  editBtn.addEventListener('click', () => openPlanModal(p));
  sum.appendChild(editBtn);
  body.appendChild(sum);

  const installments = await db.listInstallments(p.id);
  if (!installments.length) {
    const e = document.createElement('div');
    e.className = 'sub';
    e.textContent = t('no_installments');
    body.appendChild(e);
    return;
  }

  for (const i of installments) {
    const row = document.createElement('div');
    row.className = 'note';
    row.innerHTML = `<div class="nbody">
        <div class="ntitle mono">${esc(fmt(i.amount))}</div>
        <div class="nmeta">${esc(i.date)}${i.notes ? ' · ' + esc(firstLine(i.notes)) : ''}</div>
      </div>`;
    row.appendChild(mini('✕', async () => {
      if (!(await confirmDialog(t('confirm_delete_installment')))) return;
      await db.deleteInstallment(i.id);
      toast(t('deleted'));
      renderPlan();
    }));
    row.addEventListener('click', e => {
      if (e.target.closest('.iconbtn-mini')) return;
      openInstallmentModal(i);
    });
    body.appendChild(row);
  }
}

/* ---------- modale rata ---------- */
function openInstallmentModal(existing) {
  const ov = $('instOverlay');
  $('instTitle').textContent = existing ? t('edit_installment') : t('new_installment');
  $('instDate').value = existing?.date ?? toIso(new Date());
  $('instAmount').placeholder = t('amount_placeholder');
  $('instAmount').value = existing ? fmt(existing.amount) : '';
  $('instNotes').value = existing?.notes ?? '';

  const delBtn = $('instDelete');
  delBtn.hidden = !existing;

  const done = () => {
    ov.classList.remove('open');
    $('instSave').onclick = $('instCancel').onclick = delBtn.onclick = ov.onclick = null;
  };
  $('instCancel').onclick = done;
  ov.onclick = e => { if (e.target === ov) done(); };
  delBtn.onclick = async () => {
    if (!(await confirmDialog(t('confirm_delete_installment')))) return;
    await db.deleteInstallment(existing.id);
    done();
    toast(t('deleted'));
    renderPlan();
  };
  $('instSave').onclick = async () => {
    const amount = parseAmount($('instAmount').value);
    if (amount == null || amount <= 0) { toast(t('invalid_amount')); return; }
    const i = {
      date: $('instDate').value || toIso(new Date()),
      amount,
      notes: $('instNotes').value.trim(),
    };
    if (existing) await db.updateInstallment(existing.id, i);
    else await db.addInstallment(currentPlan.id, i);
    done();
    toast(t('saved'));
    renderPlan();
  };
  ov.classList.add('open');
  $('instAmount').focus();
}
