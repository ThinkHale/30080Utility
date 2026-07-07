// Small shared UI helpers: toast notifications and clipboard copy.

let toastTimer = null;

function showToast(message, isError) {
  let el = document.getElementById('nse-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'nse-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.toggle('error', !!isError);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

async function copyRichText(html, text) {
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return true;
    } catch (e) {
      // fall through to legacy method
    }
  }
  return copyRichTextLegacy(html);
}

function copyRichTextLegacy(html) {
  const container = document.createElement('div');
  container.contentEditable = 'true';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.innerHTML = html;
  document.body.appendChild(container);
  const range = document.createRange();
  range.selectNodeContents(container);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  sel.removeAllRanges();
  document.body.removeChild(container);
  return ok;
}

async function copyPlainText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) { /* fall through */ }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

function highlightActiveNav() {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav.main-nav a').forEach((a) => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', href === path);
  });
}

document.addEventListener('DOMContentLoaded', highlightActiveNav);
