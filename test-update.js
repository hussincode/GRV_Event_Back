require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { google } = require("googleapis");

const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
const privateKey = rawPrivateKey.includes("\\n")
  ? rawPrivateKey.replace(/\\n/g, "\n")
  : rawPrivateKey;

const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = process.env.GOOGLE_SHEET_ID;

async function run() {
  try {
    console.log("Updating cell A2...");
    const res = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "'Form Responses 1'!A2:A2",
      valueInputOption: "RAW",
      requestBody: { values: [["Test Timestamp"]] },
    });
    console.log("Update success:", res.data);
  } catch (err) {
    console.error("Update error:", err.message || err);
  }
}

run();
