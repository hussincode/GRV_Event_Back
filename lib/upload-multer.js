const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

function ensureDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    ensureDir();
    cb(null, UPLOAD_DIR);
  },
  filename: function (_req, file, cb) {
    // filename is set later by multer's fileFilter? We'll default to timestamp
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ext ? ext : '.pdf';
    cb(null, `${Date.now()}_${Math.random().toString(16).slice(2)}${safeExt}`);
  },
});

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

const fileFilter = (_req, file, cb) => {
  const mimetype = file.mimetype;
  const ext = path.extname(file.originalname || '').toLowerCase();

  const isAllowed =
    ALLOWED_MIME_TYPES.has(mimetype) || ALLOWED_EXTENSIONS.has(ext);

  if (!isAllowed) {
    cb(new Error('Only PDF, JPG, or PNG files are allowed'), false);
    return;
  }
  cb(null, true);
};

// Accept at most 2 files under the field names
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

module.exports = {
  upload,
};

