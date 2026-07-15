const QRCode = require("qrcode");

/** Generates a PNG QR code (as a data URL) encoding the given check-in URL. */
async function generateTicketQrCodeDataUrl(checkinUrl) {
  return QRCode.toDataURL(checkinUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 480,
  });
}

/** Generates a ticket ID in the form GRV-2026-XXXXX (5 random alphanumeric chars). */
function generateTicketId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid ambiguous chars
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `GRV-2026-${suffix}`;
}

module.exports = { generateTicketQrCodeDataUrl, generateTicketId };
