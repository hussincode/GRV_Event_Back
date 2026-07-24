const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

function ensureDir() {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    // On Vercel (serverless), disk writes fail. That's OK — we'll skip file storage.
    console.warn('[upload-multer] Cannot create uploads directory (expected on Vercel):', err.message);
  }
}

// Use memory storage only on Vercel serverless environment where disk writes fail
const isServerless = process.env.VERCEL === '1';

const storage = isServerless
  ? multer.memoryStorage() // On Vercel: store in memory temporarily
  : multer.diskStorage({    // Locally: store on disk
      destination: function (_req, _file, cb) {
        ensureDir();
        cb(null, UPLOAD_DIR);
      },
      filename: function (_req, file, cb) {
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

// Accept files up to 10MB
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * Returns a publicly accessible URL for an uploaded file.
 * Uses BACKEND_PUBLIC_URL env var when set (so local uploads get a Vercel URL in the sheet),
 * falling back to the request's own host.
 */
function getFileUrl(req, file) {
  if (!file) return '';
  if (file.filename) {
    // Prefer the configured public base URL (e.g. https://grveventback.vercel.app)
    const baseUrl = process.env.BACKEND_PUBLIC_URL
      ? process.env.BACKEND_PUBLIC_URL.replace(/\/+$/, '')
      : `${req.protocol || 'http'}://${req.get('host')}`;
    return `${baseUrl}/uploads/${file.filename}`;
  }
  if (file.buffer) {
    // On Vercel (serverless/memory storage): store as base64 data URI
    const base64 = file.buffer.toString('base64');
    return `data:${file.mimetype};base64,${base64}`;
  }
  return '';
}

module.exports = {
  upload,
  getFileUrl,
};


