const { google } = require('googleapis');
const { Readable } = require('stream');
const path = require('path');

/**
 * Uploads a multer memory-storage file buffer to Google Drive using the
 * existing service account credentials, makes it publicly readable, and
 * returns a shareable view URL.
 */

function getDriveClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!clientEmail || !rawPrivateKey) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY env vars');
  }

  const privateKey = rawPrivateKey.includes('\\n')
    ? rawPrivateKey.replace(/\\n/g, '\n')
    : rawPrivateKey;

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
    ],
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * @param {Buffer} buffer    - file content
 * @param {string} mimetype  - e.g. 'image/jpeg'
 * @param {string} filename  - original filename
 * @returns {Promise<string>} publicly accessible Google Drive view URL
 */
async function uploadFileToDrive(buffer, mimetype, filename) {
  const drive = getDriveClient();

  // Convert buffer to a readable stream
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const ext = path.extname(filename || '').toLowerCase() || '.file';
  const safeName = `upload_${Date.now()}${ext}`;

  const fileRes = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: mimetype,
    },
    media: {
      mimeType: mimetype,
      body: stream,
    },
    fields: 'id',
  });

  const fileId = fileRes.data.id;
  if (!fileId) throw new Error('Google Drive upload returned no file ID');

  // Make the file publicly readable by anyone with the link
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  // Return a direct view URL
  return `https://drive.google.com/file/d/${fileId}/view`;
}

module.exports = { uploadFileToDrive };
