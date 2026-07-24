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
 *
 * Setup required:
 * 1. Create a folder in your personal Google Drive.
 * 2. Share it with the service account email (Editor access):
 *    grv-sheets-bot@grv-event.iam.gserviceaccount.com
 * 3. Copy the folder ID from the URL:
 *    https://drive.google.com/drive/folders/<FOLDER_ID>
 * 4. Set GOOGLE_DRIVE_FOLDER_ID=<FOLDER_ID> in your .env and Vercel env vars.
 */
async function uploadFileToDrive(buffer, mimetype, filename) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error(
      'GOOGLE_DRIVE_FOLDER_ID is not set. ' +
      'Create a Google Drive folder, share it with grv-sheets-bot@grv-event.iam.gserviceaccount.com (Editor), ' +
      'then set GOOGLE_DRIVE_FOLDER_ID to the folder ID from the URL.'
    );
  }

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
      parents: [folderId], // Upload into the shared folder (user-owned, has quota)
    },
    media: {
      mimeType: mimetype,
      body: stream,
    },
    fields: 'id',
  });

  const fileId = fileRes.data.id;
  if (!fileId) throw new Error('Google Drive upload returned no file ID');

  // Make the file publicly readable (anyone with the link)
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return `https://drive.google.com/file/d/${fileId}/view`;
}

module.exports = { uploadFileToDrive };
