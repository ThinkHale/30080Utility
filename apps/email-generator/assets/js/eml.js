// Builds a downloadable .eml (RFC 822 / MIME) file with inline images so
// embedded facility photos and map screenshots survive without any server.

function toBase64Unicode(str) {
  return btoa(unescape(encodeURIComponent(str || '')));
}

function base64WrapLines(b64) {
  return (b64.match(/.{1,76}/g) || []).join('\r\n');
}

function encodeHeader(str) {
  if (!str) return '';
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(str)) return str;
  return `=?UTF-8?B?${toBase64Unicode(str)}?=`;
}

function buildEmlBlob({ to, subject, html, text }) {
  const boundaryRel = 'nse_rel_' + Math.random().toString(36).slice(2);
  const boundaryAlt = 'nse_alt_' + Math.random().toString(36).slice(2);
  const images = [];
  let idx = 0;

  const processedHtml = (html || '').replace(
    /(<img[^>]*?src=")data:([^;]+);base64,([^"]+)("[^>]*>)/g,
    (match, pre, mime, b64, post) => {
      idx += 1;
      const cid = `nse_img${idx}@newstartemail.local`;
      images.push({ cid, mime, b64 });
      return `${pre}cid:${cid}${post}`;
    }
  );

  let msg = '';
  msg += 'MIME-Version: 1.0\r\n';
  if (to) msg += `To: ${to}\r\n`;
  msg += `Subject: ${encodeHeader(subject)}\r\n`;
  msg += `X-Unsent: 1\r\n`;
  msg += `Content-Type: multipart/related; boundary="${boundaryRel}"\r\n\r\n`;

  msg += `--${boundaryRel}\r\n`;
  msg += `Content-Type: multipart/alternative; boundary="${boundaryAlt}"\r\n\r\n`;

  msg += `--${boundaryAlt}\r\n`;
  msg += 'Content-Type: text/plain; charset="UTF-8"\r\n';
  msg += 'Content-Transfer-Encoding: base64\r\n\r\n';
  msg += base64WrapLines(toBase64Unicode(text || '')) + '\r\n\r\n';

  msg += `--${boundaryAlt}\r\n`;
  msg += 'Content-Type: text/html; charset="UTF-8"\r\n';
  msg += 'Content-Transfer-Encoding: base64\r\n\r\n';
  msg += base64WrapLines(toBase64Unicode(processedHtml)) + '\r\n\r\n';

  msg += `--${boundaryAlt}--\r\n\r\n`;

  images.forEach((img, i) => {
    const ext = (img.mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
    msg += `--${boundaryRel}\r\n`;
    msg += `Content-Type: ${img.mime}; name="image${i + 1}.${ext}"\r\n`;
    msg += 'Content-Transfer-Encoding: base64\r\n';
    msg += `Content-ID: <${img.cid}>\r\n`;
    msg += `Content-Disposition: inline; filename="image${i + 1}.${ext}"\r\n\r\n`;
    msg += base64WrapLines(img.b64) + '\r\n\r\n';
  });

  msg += `--${boundaryRel}--\r\n`;

  return new Blob([msg], { type: 'message/rfc822' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function safeFilename(str) {
  return (str || 'email').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'email';
}
