const path = require('path');
const crypto = require('crypto');

function makeSafeFileName(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  const base = path.basename(originalName || '', ext).replace(/[^a-z0-9_-]/gi, '_');
  const hash = crypto.randomBytes(8).toString('hex');
  return `${base || 'file'}_${hash}${ext || ''}`;
}

function getPublicBaseUrl(req) {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
}

module.exports = {
  makeSafeFileName,
  getPublicBaseUrl,
};

