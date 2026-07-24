const { google } = require('googleapis');
const { Readable } = require('stream');
const path = require('path');
const https = require('https');

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

function uploadFileToPublicCloud(buffer, mimetype, filename) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundaryUpload' + Date.now();
    const ext = path.extname(filename || '').toLowerCase() || '.file';
    const safeName = `document_${Date.now()}${ext}`;

    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeName}"\r\nContent-Type: ${mimetype || 'application/octet-stream'}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const req = https.request({
      hostname: 'tmpfiles.org',
      path: '/api/v1/upload',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.status === 'success' && parsed.data && parsed.data.url) {
            const directUrl = parsed.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
            return resolve(directUrl);
          }
          reject(new Error('Cloud upload response invalid: ' + data));
        } catch (err) {
          reject(new Error('Cloud upload parse error: ' + err.message));
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(payload);
    req.end();
  });
}

/**
 * Uploads a file buffer to Google Drive (if folder ID is provided & quota allows),
 * falling back to cloud storage if Drive encounters quota limits.
 * Returns a short HTTPS URL stored in Google Sheets.
 */
async function uploadFileToDrive(buffer, mimetype, filename) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (folderId) {
    try {
      const drive = getDriveClient();

      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      const ext = path.extname(filename || '').toLowerCase() || '.file';
      const safeName = `upload_${Date.now()}${ext}`;

      const fileRes = await drive.files.create({
        requestBody: {
          name: safeName,
          mimeType: mimetype,
          parents: [folderId],
        },
        media: {
          mimeType: mimetype,
          body: stream,
        },
        fields: 'id',
      });

      const fileId = fileRes.data.id;
      if (fileId) {
        await drive.permissions.create({
          fileId,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
        });
        return `https://drive.google.com/file/d/${fileId}/view`;
      }
    } catch (err) {
      console.warn('[drive-upload] Google Drive upload failed (falling back to cloud storage):', err.message);
    }
  }

  // Fallback to cloud file host so registration never fails and cell limits are respected
  return uploadFileToPublicCloud(buffer, mimetype, filename);
}

module.exports = { uploadFileToDrive };
