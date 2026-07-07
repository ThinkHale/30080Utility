// Token extraction + template rendering shared by the generator and builder pages.

function extractTokens(str) {
  const re = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
  const set = new Set();
  let m;
  while ((m = re.exec(str || ''))) set.add(m[1]);
  return [...set];
}

function getCustomFieldTokens(template) {
  const all = new Set([
    ...extractTokens(template.subject || ''),
    ...extractTokens(template.body || ''),
  ]);
  RESERVED_TOKENS.forEach((t) => all.delete(t));
  return [...all];
}

function humanizeToken(token) {
  const spaced = token.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatDateLong(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const [y, mo, d] = parts;
  const dt = new Date(y, mo - 1, d);
  return dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function settingsToTokenMap(s) {
  return {
    senderName: s.senderName || '',
    senderTitle: s.senderTitle || '',
    senderPhone: s.senderPhone || '',
    senderEmail: s.senderEmail || '',
    senderCompany: s.senderCompany || '',
  };
}

// values: { client, shift, date, recipientEmail, custom: {token: value} }
function renderTemplate(template, values, settings) {
  const map = {
    emailType: template.type || '',
    client: (values.client && values.client !== 'None') ? values.client : '',
    shift: values.shift || '',
    date: values.date ? formatDateLong(values.date) : '',
    recipientEmail: values.recipientEmail || '',
    ...settingsToTokenMap(settings || loadSettings()),
    ...(values.custom || {}),
  };
  const replace = (str) => (str || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (m, k) => (
    Object.prototype.hasOwnProperty.call(map, k) ? map[k] : ''
  ));
  return {
    subject: replace(template.subject),
    body: replace(template.body),
  };
}

function htmlToPlainText(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  div.querySelectorAll('img').forEach((img) => {
    const alt = img.getAttribute('alt');
    img.replaceWith(document.createTextNode(alt ? `[Image: ${alt}]` : '[Image]'));
  });
  div.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  div.querySelectorAll('p, div, li, tr, h1, h2, h3, h4').forEach((el) => {
    el.appendChild(document.createTextNode('\n'));
  });
  const text = div.textContent || '';
  return text.replace(/\n{3,}/g, '\n\n').trim();
}
