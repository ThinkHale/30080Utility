(function () {
  let templates = [];
  let settings = {};
  let editingId = null;
  let shifts = [];
  let fieldRows = new Map(); // token -> { rowEl, getMeta() }
  let detectedScanTimer = null;
  let savedRange = null;

  // Elements
  const templateListEl = document.getElementById('templateList');
  const editorEmpty = document.getElementById('editorEmpty');
  const editorForm = document.getElementById('editorForm');
  const editorTitle = document.getElementById('editorTitle');
  const previewCard = document.getElementById('previewCard');

  const tplType = document.getElementById('tplType');
  const tplClient = document.getElementById('tplClient');
  const typeOptions = document.getElementById('typeOptions');
  const clientOptions = document.getElementById('clientOptions');

  const shiftInput = document.getElementById('shiftInput');
  const addShiftBtn = document.getElementById('addShiftBtn');
  const shiftChips = document.getElementById('shiftChips');

  const usesDate = document.getElementById('usesDate');
  const dateLabelInput = document.getElementById('dateLabelInput');
  const tplSubject = document.getElementById('tplSubject');
  const bodyEditor = document.getElementById('bodyEditor');

  const detectedFieldsWrap = document.getElementById('detectedFieldsWrap');
  const detectedFields = document.getElementById('detectedFields');

  const tokenInsertSelect = document.getElementById('tokenInsertSelect');
  const imageFileInput = document.getElementById('imageFileInput');

  async function init() {
    templates = await loadTemplates();
    settings = loadSettings();
    populateTokenSelect();
    refreshDatalists();
    renderTemplateList();
    bindStaticEvents();
    loadSettingsIntoForm();
  }

  // ---------- Tabs ----------
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('templatesTab').style.display = 'none';
      document.getElementById('settingsTab').style.display = 'none';
      document.getElementById(btn.dataset.tab).style.display = '';
    });
  });

  // ---------- Template list ----------
  function renderTemplateList() {
    const sorted = [...templates].sort((a, b) => {
      const t = a.type.localeCompare(b.type);
      return t !== 0 ? t : (a.client || '').localeCompare(b.client || '');
    });
    if (!sorted.length) {
      templateListEl.innerHTML = '<div class="empty-state">No templates yet.</div>';
      return;
    }
    templateListEl.innerHTML = '';
    sorted.forEach((t) => {
      const item = document.createElement('div');
      item.className = 'template-list-item' + (t.id === editingId ? ' active' : '');
      item.innerHTML = `
        <div class="tli-main">
          <div class="tli-type">${escapeHtml(t.type)}</div>
          <div class="tli-client">${escapeHtml(t.client || 'None')}</div>
        </div>
        <span class="badge muted">${(t.shifts && t.shifts.length) ? t.shifts.length + ' shifts' : 'no shift'}</span>
      `;
      item.addEventListener('click', () => loadTemplateIntoEditor(t.id));
      templateListEl.appendChild(item);
    });
  }

  function refreshDatalists() {
    const types = [...new Set(templates.map((t) => t.type))].sort();
    const clients = [...new Set(templates.map((t) => t.client || 'None'))].sort();
    typeOptions.innerHTML = types.map((t) => `<option value="${escapeAttr(t)}">`).join('');
    clientOptions.innerHTML = clients.map((c) => `<option value="${escapeAttr(c)}">`).join('');
  }

  function populateTokenSelect() {
    let html = '<option value="">Insert field…</option><optgroup label="Standard Fields">';
    RESERVED_TOKENS.forEach((t) => {
      html += `<option value="${t}">${escapeHtml(RESERVED_TOKEN_LABELS[t] || humanizeToken(t))}</option>`;
    });
    html += '</optgroup><option value="__new__">+ Add new custom field…</option>';
    tokenInsertSelect.innerHTML = html;
  }

  // ---------- Editor lifecycle ----------
  function resetEditor() {
    editingId = null;
    shifts = [];
    fieldRows.clear();
    tplType.value = '';
    tplClient.value = '';
    usesDate.checked = true;
    dateLabelInput.value = '';
    tplSubject.value = '';
    bodyEditor.innerHTML = '';
    renderShiftChips();
    renderDetectedFields({});
    editorTitle.textContent = 'New Template';
    previewCard.style.display = 'none';
    editorEmpty.style.display = 'none';
    editorForm.style.display = '';
  }

  function loadTemplateIntoEditor(id) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    editingId = id;
    shifts = [...(t.shifts || [])];
    fieldRows.clear();
    tplType.value = t.type || '';
    tplClient.value = t.client || '';
    usesDate.checked = t.usesDate !== false;
    dateLabelInput.value = t.dateLabel || '';
    tplSubject.value = t.subject || '';
    bodyEditor.innerHTML = t.body || '';
    renderShiftChips();
    renderDetectedFields(t.fieldMeta || {});
    editorTitle.textContent = `${t.type} — ${t.client || 'None'}`;
    previewCard.style.display = 'none';
    editorEmpty.style.display = 'none';
    editorForm.style.display = '';
    renderTemplateList();
  }

  // ---------- Shift chips ----------
  function renderShiftChips() {
    shiftChips.innerHTML = '';
    shifts.forEach((s, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `${escapeHtml(s)} <button type="button" aria-label="Remove">&times;</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        shifts.splice(i, 1);
        renderShiftChips();
      });
      shiftChips.appendChild(chip);
    });
  }

  function addShift() {
    const v = shiftInput.value.trim();
    if (!v) return;
    if (!shifts.includes(v)) shifts.push(v);
    shiftInput.value = '';
    renderShiftChips();
  }

  // ---------- Rich text editor ----------
  function saveSelection() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && bodyEditor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    bodyEditor.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    if (savedRange) {
      sel.addRange(savedRange);
    } else {
      const r = document.createRange();
      r.selectNodeContents(bodyEditor);
      r.collapse(false);
      sel.addRange(r);
    }
  }

  function insertTokenAtCursor(token) {
    restoreSelection();
    document.execCommand('insertText', false, `{{${token}}}`);
    scheduleDetectedFieldsScan();
  }

  function resizeImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const maxWidth = 1100;
          let { width, height } = img;
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ---------- Detected custom fields ----------
  function buildFieldRow(token, meta) {
    const wrapper = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'field-meta-row';
    row.innerHTML = `
      <div class="fm-token">{{${escapeHtml(token)}}}</div>
      <input type="text" class="fm-label" placeholder="Label">
      <select class="fm-type">
        <option value="text">Text</option>
        <option value="textarea">Text Area</option>
        <option value="date">Date</option>
        <option value="time">Time</option>
        <option value="select">Dropdown</option>
      </select>
    `;
    const optionsRow = document.createElement('div');
    optionsRow.innerHTML = '<input type="text" class="fm-options" placeholder="Comma-separated options (for dropdown)">';
    optionsRow.style.paddingBottom = '10px';

    const labelInput = row.querySelector('.fm-label');
    const typeSel = row.querySelector('.fm-type');
    const optionsInput = optionsRow.querySelector('.fm-options');

    labelInput.value = meta.label || humanizeToken(token);
    typeSel.value = meta.type || 'text';
    optionsInput.value = (meta.options || []).join(', ');
    optionsRow.style.display = typeSel.value === 'select' ? '' : 'none';

    typeSel.addEventListener('change', () => {
      optionsRow.style.display = typeSel.value === 'select' ? '' : 'none';
    });

    wrapper.appendChild(row);
    wrapper.appendChild(optionsRow);

    return {
      rowEl: wrapper,
      getMeta() {
        const type = typeSel.value;
        const out = { label: labelInput.value.trim() || humanizeToken(token), type };
        if (type === 'select') {
          out.options = optionsInput.value.split(',').map((s) => s.trim()).filter(Boolean);
        }
        return out;
      },
    };
  }

  function scheduleDetectedFieldsScan() {
    clearTimeout(detectedScanTimer);
    detectedScanTimer = setTimeout(() => renderDetectedFields(), 250);
  }

  function renderDetectedFields(seedMeta) {
    const tokens = getCustomFieldTokens({ subject: tplSubject.value, body: bodyEditor.innerHTML });
    if (!tokens.length) {
      detectedFieldsWrap.style.display = 'none';
      detectedFields.innerHTML = '';
      fieldRows.clear();
      return;
    }
    detectedFieldsWrap.style.display = '';
    // remove rows no longer referenced
    [...fieldRows.keys()].forEach((t) => {
      if (!tokens.includes(t)) {
        fieldRows.get(t).rowEl.remove();
        fieldRows.delete(t);
      }
    });
    tokens.forEach((token) => {
      if (!fieldRows.has(token)) {
        const meta = (seedMeta && seedMeta[token]) || {};
        fieldRows.set(token, buildFieldRow(token, meta));
      }
      detectedFields.appendChild(fieldRows.get(token).rowEl);
    });
  }

  function collectFieldMeta() {
    const out = {};
    fieldRows.forEach((row, token) => { out[token] = row.getMeta(); });
    return out;
  }

  // ---------- Save / delete / duplicate ----------
  function buildTemplateFromForm(idOverride) {
    return {
      id: idOverride,
      type: tplType.value.trim(),
      client: tplClient.value.trim() || 'None',
      shifts: [...shifts],
      usesDate: usesDate.checked,
      dateLabel: dateLabelInput.value.trim() || 'Date',
      subject: tplSubject.value.trim(),
      body: bodyEditor.innerHTML,
      fieldMeta: collectFieldMeta(),
    };
  }

  function onSave(e) {
    e.preventDefault();
    if (!tplType.value.trim() || !tplClient.value.trim()) {
      showToast('Email Type and Client are required.', true);
      return;
    }
    const newId = editingId || uid();
    const templateObj = buildTemplateFromForm(newId);

    const conflict = templates.find((t) => t.id !== newId
      && t.type === templateObj.type
      && (t.client || 'None') === templateObj.client);
    if (conflict) {
      const ok = confirm(`A template for "${templateObj.type}" / "${templateObj.client}" already exists. Replace it?`);
      if (!ok) return;
      templates = templates.filter((t) => t.id !== conflict.id);
    }

    const idx = templates.findIndex((t) => t.id === newId);
    if (idx >= 0) templates[idx] = templateObj; else templates.push(templateObj);

    saveTemplates(templates);
    editingId = newId;
    refreshDatalists();
    renderTemplateList();
    editorTitle.textContent = `${templateObj.type} — ${templateObj.client}`;
    showToast('Template saved.');
  }

  function onDuplicate() {
    if (!tplType.value.trim()) return;
    tplClient.value = `${tplClient.value.trim() || 'None'} (Copy)`;
    editingId = null;
    editorTitle.textContent = 'New Template (copy)';
    showToast('Duplicated — edit and save as a new template.');
  }

  function onDelete() {
    if (!editingId) return;
    const t = templates.find((x) => x.id === editingId);
    if (!t) return;
    if (!confirm(`Delete the "${t.type} / ${t.client}" template? This can't be undone.`)) return;
    templates = templates.filter((x) => x.id !== editingId);
    saveTemplates(templates);
    refreshDatalists();
    renderTemplateList();
    resetEditor();
    editorForm.style.display = 'none';
    editorEmpty.style.display = '';
    showToast('Template deleted.');
  }

  function onPreview() {
    const draft = buildTemplateFromForm('draft');
    const sampleValues = {
      client: draft.client,
      shift: draft.shifts[0] || '',
      date: new Date().toISOString().slice(0, 10),
      recipientEmail: '',
      custom: {},
    };
    Object.keys(draft.fieldMeta).forEach((token) => {
      const meta = draft.fieldMeta[token];
      sampleValues.custom[token] = meta.type === 'select' && meta.options && meta.options.length
        ? meta.options[0]
        : `[${meta.label}]`;
    });
    const rendered = renderTemplate(draft, sampleValues, settings);
    document.getElementById('previewSubjectOut').textContent = rendered.subject;
    document.getElementById('previewBodyOut').innerHTML = rendered.body;
    previewCard.style.display = '';
    previewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---------- Export / Import ----------
  function onExport() {
    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'templates.json');
  }

  function onImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported)) throw new Error('Expected an array of templates.');
        let count = 0;
        imported.forEach((t) => {
          if (!t.type) return;
          const id = t.id || uid();
          const idx = templates.findIndex((x) => x.id === id);
          const clean = { ...t, id };
          if (idx >= 0) templates[idx] = clean; else templates.push(clean);
          count += 1;
        });
        saveTemplates(templates);
        refreshDatalists();
        renderTemplateList();
        showToast(`Imported ${count} template(s).`);
      } catch (err) {
        showToast('Import failed: ' + err.message, true);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  // ---------- Settings ----------
  function loadSettingsIntoForm() {
    document.getElementById('senderName').value = settings.senderName || '';
    document.getElementById('senderTitle').value = settings.senderTitle || '';
    document.getElementById('senderCompany').value = settings.senderCompany || '';
    document.getElementById('senderPhone').value = settings.senderPhone || '';
    document.getElementById('senderEmail').value = settings.senderEmail || '';
  }

  function onSaveSettings() {
    settings = {
      senderName: document.getElementById('senderName').value.trim(),
      senderTitle: document.getElementById('senderTitle').value.trim(),
      senderCompany: document.getElementById('senderCompany').value.trim(),
      senderPhone: document.getElementById('senderPhone').value.trim(),
      senderEmail: document.getElementById('senderEmail').value.trim(),
    };
    saveSettings(settings);
    showToast('Sender settings saved.');
  }

  // ---------- Bind events ----------
  function bindStaticEvents() {
    document.getElementById('newTemplateBtn').addEventListener('click', resetEditor);
    editorForm.addEventListener('submit', onSave);
    document.getElementById('duplicateBtn').addEventListener('click', onDuplicate);
    document.getElementById('deleteBtn').addEventListener('click', onDelete);
    document.getElementById('previewBtn').addEventListener('click', onPreview);

    addShiftBtn.addEventListener('click', addShift);
    shiftInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addShift(); }
    });

    tplSubject.addEventListener('input', scheduleDetectedFieldsScan);
    bodyEditor.addEventListener('input', scheduleDetectedFieldsScan);
    bodyEditor.addEventListener('mouseup', saveSelection);
    bodyEditor.addEventListener('keyup', saveSelection);

    document.querySelectorAll('.toolbar button[data-cmd]').forEach((btn) => {
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        bodyEditor.focus();
        document.execCommand(btn.dataset.cmd, false, null);
      });
    });

    const insertLinkBtn = document.getElementById('insertLinkBtn');
    insertLinkBtn.addEventListener('mousedown', (e) => e.preventDefault());
    insertLinkBtn.addEventListener('click', () => {
      restoreSelection();
      const url = prompt('Link URL (e.g. https://maps.google.com/...)');
      if (url) document.execCommand('createLink', false, url);
    });

    const insertImageBtn = document.getElementById('insertImageBtn');
    insertImageBtn.addEventListener('mousedown', (e) => e.preventDefault());
    insertImageBtn.addEventListener('click', () => {
      saveSelection();
      imageFileInput.click();
    });
    imageFileInput.addEventListener('change', async () => {
      const file = imageFileInput.files[0];
      if (!file) return;
      try {
        const dataUrl = await resizeImageFile(file);
        restoreSelection();
        document.execCommand('insertHTML', false, `<img src="${dataUrl}" alt="" style="max-width:100%;height:auto;display:block;margin:10px 0;">`);
        scheduleDetectedFieldsScan();
      } catch (err) {
        showToast('Could not add image.', true);
      }
      imageFileInput.value = '';
    });

    tokenInsertSelect.addEventListener('change', () => {
      const val = tokenInsertSelect.value;
      tokenInsertSelect.value = '';
      if (!val) return;
      if (val === '__new__') {
        let key = prompt('New field name (letters, numbers, underscore only) e.g. employeeName');
        if (!key) return;
        key = key.trim().replace(/[^a-zA-Z0-9_]/g, '');
        if (!key) { showToast('Invalid field name.', true); return; }
        if (RESERVED_TOKENS.includes(key)) { showToast('That name is reserved. Choose another.', true); return; }
        insertTokenAtCursor(key);
      } else {
        insertTokenAtCursor(val);
      }
    });

    document.getElementById('exportBtn').addEventListener('click', onExport);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', onImportFile);

    document.getElementById('saveSettingsBtn').addEventListener('click', onSaveSettings);
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
