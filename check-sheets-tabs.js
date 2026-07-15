require("dotenv").config();
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
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    console.log("Spreadsheet Title:", meta.data.properties.title);
    console.log("Sheets (tabs):");
    for (const sheet of meta.data.sheets) {
      console.log(`- Title: "${sheet.properties.title}", Index: ${sheet.properties.index}, GridProperties:`, sheet.properties.gridProperties);
      // Fetch some rows to see what is in them
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheet.properties.title}'!A1:Q10`,
      });
      console.log(`  Rows in ${sheet.properties.title} (A1:Q10):`, JSON.stringify(res.data.values, null, 2));
    }
  } catch (err) {
    console.error("Error fetching sheet meta:", err);
  }
}

run();
