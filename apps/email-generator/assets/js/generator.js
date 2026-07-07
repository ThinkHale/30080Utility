(function () {
  let templates = [];
  let settings = {};
  let currentTemplate = null;
  let renderTimer = null;

  const emailTypeSel = document.getElementById('emailType');
  const clientSel = document.getElementById('client');
  const shiftField = document.getElementById('shiftField');
  const shiftSel = document.getElementById('shift');
  const dateField = document.getElementById('dateField');
  const dateLabelEl = document.getElementById('dateLabel');
  const dateInput = document.getElementById('dateInput');
  const recipientInput = document.getElementById('recipientEmail');
  const customFieldsCard = document.getElementById('customFieldsCard');
  const customFieldsContainer = document.getElementById('customFieldsContainer');

  const previewEmpty = document.getElementById('previewEmpty');
  const previewWrap = document.getElementById('previewWrap');
  const previewTo = document.getElementById('previewTo');
  const previewSubject = document.getElementById('previewSubject');
  const previewBody = document.getElementById('previewBody');

  async function init() {
    templates = await loadTemplates();
    settings = loadSettings();

    if (!templates.length) {
      document.getElementById('noTemplatesWarning').style.display = 'block';
      return;
    }

    populateTypes();
    bindEvents();
    onTypeChange();
  }

  function uniqueSorted(arr) {
    return [...new Set(arr)].sort((a, b) => a.localeCompare(b));
  }

  function populateTypes() {
    const types = uniqueSorted(templates.map((t) => t.type));
    emailTypeSel.innerHTML = types.map((t) => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join('');
  }

  function populateClients() {
    const type = emailTypeSel.value;
    const clients = uniqueSorted(templates.filter((t) => t.type === type).map((t) => t.client || 'None'));
    clientSel.innerHTML = clients.map((c) => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('');
  }

  function bindEvents() {
    emailTypeSel.addEventListener('change', onTypeChange);
    clientSel.addEventListener('change', onClientChange);
    shiftSel.addEventListener('change', scheduleRender);
    dateInput.addEventListener('change', scheduleRender);
    recipientInput.addEventListener('input', scheduleRender);

    document.getElementById('copyRichBtn').addEventListener('click', onCopyRich);
    document.getElementById('copyPlainBtn').addEventListener('click', onCopyPlain);
    document.getElementById('downloadEmlBtn').addEventListener('click', onDownloadEml);
    document.getElementById('resetBtn').addEventListener('click', onReset);
  }

  function onTypeChange() {
    populateClients();
    onClientChange();
  }

  function onClientChange() {
    const type = emailTypeSel.value;
    const client = clientSel.value;
    currentTemplate = templates.find((t) => t.type === type && (t.client || 'None') === client) || null;
    setupShiftField();
    setupDateField();
    setupCustomFields();
    scheduleRender();
  }

  function setupShiftField() {
    const shifts = (currentTemplate && currentTemplate.shifts) || [];
    if (shifts.length) {
      shiftField.style.display = '';
      shiftSel.innerHTML = shifts.map((s) => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join('');
    } else {
      shiftField.style.display = 'none';
      shiftSel.innerHTML = '';
    }
  }

  function setupDateField() {
    if (currentTemplate && currentTemplate.usesDate !== false) {
      dateField.style.display = '';
      dateLabelEl.textContent = currentTemplate.dateLabel || 'Date';
    } else {
      dateField.style.display = 'none';
      dateInput.value = '';
    }
  }

  function setupCustomFields() {
    customFieldsContainer.innerHTML = '';
    if (!currentTemplate) {
      customFieldsCard.style.display = 'none';
      return;
    }
    const tokens = getCustomFieldTokens(currentTemplate);
    if (!tokens.length) {
      customFieldsCard.style.display = 'none';
      return;
    }
    customFieldsCard.style.display = '';
    const meta = currentTemplate.fieldMeta || {};

    tokens.forEach((token) => {
      const m = meta[token] || {};
      const label = m.label || humanizeToken(token);
      const type = m.type || 'text';
      const wrap = document.createElement('div');
      wrap.className = 'field';

      let inputHtml;
      const idAttr = `cf_${token}`;
      if (type === 'textarea') {
        inputHtml = `<textarea id="${idAttr}"></textarea>`;
      } else if (type === 'select') {
        const opts = (m.options || []).map((o) => `<option value="${escapeAttr(o)}">${escapeHtml(o)}</option>`).join('');
        inputHtml = `<select id="${idAttr}">${opts}</select>`;
      } else if (type === 'date' || type === 'time') {
        inputHtml = `<input type="${type}" id="${idAttr}">`;
      } else {
        inputHtml = `<input type="text" id="${idAttr}">`;
      }

      wrap.innerHTML = `<label for="${idAttr}">${escapeHtml(label)}</label>${inputHtml}`;
      customFieldsContainer.appendChild(wrap);

      const el = wrap.querySelector(`#${CSS.escape(idAttr)}`);
      el.addEventListener('input', scheduleRender);
      el.addEventListener('change', scheduleRender);
    });
  }

  function collectValues() {
    const custom = {};
    if (currentTemplate) {
      getCustomFieldTokens(currentTemplate).forEach((token) => {
        const el = document.getElementById(`cf_${token}`);
        custom[token] = el ? el.value : '';
      });
    }
    return {
      client: clientSel.value,
      shift: shiftSel.value,
      date: dateInput.value,
      recipientEmail: recipientInput.value.trim(),
      custom,
    };
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderPreview, 80);
  }

  function renderPreview() {
    if (!currentTemplate) {
      previewEmpty.style.display = '';
      previewWrap.style.display = 'none';
      return;
    }
    const values = collectValues();
    const rendered = renderTemplate(currentTemplate, values, settings);
    previewSubject.textContent = rendered.subject;
    previewBody.innerHTML = rendered.body;
    previewTo.textContent = values.recipientEmail || '—';
    previewEmpty.style.display = 'none';
    previewWrap.style.display = '';
  }

  function currentRendered() {
    const values = collectValues();
    return { values, rendered: renderTemplate(currentTemplate, values, settings) };
  }

  async function onCopyRich() {
    if (!currentTemplate) return;
    const { rendered } = currentRendered();
    const text = htmlToPlainText(rendered.body);
    const ok = await copyRichText(rendered.body, text);
    showToast(ok ? 'Email copied — paste into Outlook.' : 'Copy failed. Try selecting the preview manually.', !ok);
  }

  async function onCopyPlain() {
    if (!currentTemplate) return;
    const { rendered } = currentRendered();
    const text = `${rendered.subject}\n\n${htmlToPlainText(rendered.body)}`;
    const ok = await copyPlainText(text);
    showToast(ok ? 'Plain text copied.' : 'Copy failed.', !ok);
  }

  function onDownloadEml() {
    if (!currentTemplate) return;
    const { values, rendered } = currentRendered();
    const text = htmlToPlainText(rendered.body);
    const blob = buildEmlBlob({ to: values.recipientEmail, subject: rendered.subject, html: rendered.body, text });
    downloadBlob(blob, `${safeFilename(rendered.subject)}.eml`);
    showToast('Downloaded .eml file.');
  }

  function onReset() {
    shiftSel.selectedIndex = 0;
    dateInput.value = '';
    recipientInput.value = '';
    setupCustomFields();
    renderPreview();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
