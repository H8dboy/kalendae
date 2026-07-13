// Utility per modali: apertura/chiusura, conferma, prompt testuale.
// Tutte le eliminazioni passano da confirmDialog() — mai cancellare al primo tap.

export function openOverlay(id) {
  document.getElementById(id).classList.add('open');
}

export function closeOverlay(id) {
  document.getElementById(id).classList.remove('open');
}

/** Conferma sì/no. @returns {Promise<boolean>} */
export function confirmDialog(message) {
  return new Promise(resolve => {
    const ov = document.getElementById('confirmOverlay');
    document.getElementById('confirmMsg').textContent = message;
    const okBtn = document.getElementById('confirmOk');
    const noBtn = document.getElementById('confirmNo');
    const done = val => {
      ov.classList.remove('open');
      okBtn.onclick = noBtn.onclick = ov.onclick = null;
      resolve(val);
    };
    okBtn.onclick = () => done(true);
    noBtn.onclick = () => done(false);
    ov.onclick = e => { if (e.target === ov) done(false); };
    ov.classList.add('open');
    noBtn.focus();
  });
}

/** Prompt con un campo di testo (nuovo gruppo/cartella, rinomina). @returns {Promise<string|null>} */
export function promptDialog(title, label, placeholder = '', initial = '') {
  return new Promise(resolve => {
    const ov = document.getElementById('promptOverlay');
    document.getElementById('promptTitle').textContent = title;
    document.getElementById('promptLabel').textContent = label;
    const input = document.getElementById('promptInput');
    input.placeholder = placeholder;
    input.value = initial;
    const okBtn = document.getElementById('promptOk');
    const noBtn = document.getElementById('promptNo');
    const done = val => {
      ov.classList.remove('open');
      okBtn.onclick = noBtn.onclick = ov.onclick = input.onkeydown = null;
      resolve(val);
    };
    okBtn.onclick = () => done(input.value.trim() || null);
    noBtn.onclick = () => done(null);
    ov.onclick = e => { if (e.target === ov) done(null); };
    input.onkeydown = e => { if (e.key === 'Enter') done(input.value.trim() || null); };
    ov.classList.add('open');
    input.focus();
  });
}

/** Escape HTML per contenuti inseriti dall'utente. */
export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}
