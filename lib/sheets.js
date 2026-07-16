const { google } = require("googleapis");

/**
 * Google Sheets as the system of record.
 * Column layout (row 1 = header, data starts at row 2):
 *
 * A Timestamp | B FullName | C Email | D MobileNumber | E WhatsappNumber |
 * F Gender | G Age | H Governorate | I EducationalStage | J ConsentMediaUsage |
 * K NationalIdFileUrl | L BirthPaperFileUrl |
 * M Status | N TicketId | O EmailSent | P CheckedIn | Q CheckedInAt
 */

const HEADER = [
  "Timestamp",
  "FullName",
  "Email",
  "MobileNumber",
  "WhatsappNumber",
  "Gender",
  "Age",
  "Governorate",
  "EducationalStage",
  "ConsentMediaUsage",
  "NationalIdFileUrl",
  "BirthPaperFileUrl",
  "Status",
  "TicketId",
  "EmailSent",
  "CheckedIn",
  "CheckedInAt",
];

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    // Keep message user/debug friendly and JSON serializable (only plain string)
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let cachedClient = null;
let cachedSheetTitle = null;

function getSheetsClient() {
  if (cachedClient) return cachedClient;

  const clientEmail = requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const rawPrivateKey = requiredEnv("GOOGLE_PRIVATE_KEY");
  const privateKey = rawPrivateKey.includes("\\n")
    ? rawPrivateKey.replace(/\\n/g, "\n")
    : rawPrivateKey;

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

function getSpreadsheetId() {
  return requiredEnv("GOOGLE_SHEET_ID");
}

async function getSheetTitle() {
  if (cachedSheetTitle) return cachedSheetTitle;
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const title = meta.data.sheets?.[0]?.properties?.title;
    if (!title) throw new Error("Could not determine the target Google Sheet's tab title");
    cachedSheetTitle = title;
    return title;
  } catch (err) {
    // Bubble a clear, stable message for the frontend banner
    throw new Error(`Google Sheets is unreachable or misconfigured: ${err?.message || String(err)}`);
  }
}

let ensureHeadersPromise = null;

async function ensureHeaders() {
  if (ensureHeadersPromise) return ensureHeadersPromise;

  ensureHeadersPromise = (async () => {
    const sheets = getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    const title = await getSheetTitle();

    // Ensure we cover through column Q (17 columns => A:Q)
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${title}'!A1:Q1`,
    });

    const firstRow = existing.data.values?.[0];
    if (firstRow && firstRow.length > 0 && firstRow[0] === "Timestamp") return;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${title}'!A1:Q1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
    console.log("Initialized Google Sheet header row");
  })();

  try {
    await ensureHeadersPromise;
  } catch (err) {
    ensureHeadersPromise = null;
    throw err;
  }
}

function boolToStr(value) {
  return value ? "TRUE" : "FALSE";
}
function strToBool(value) {
  return String(value).trim().toUpperCase() === "TRUE";
}

function rowToRegistration(row, rowNumber) {
  const get = (i) => (row[i] !== undefined && row[i] !== null ? String(row[i]) : "");

  return {
    id: rowNumber,
    timestamp: get(0),
    fullName: get(1),
    email: get(2),
    mobileNumber: get(3),
    whatsappNumber: get(4),
    gender: get(5) === "Female" ? "Female" : "Male",
    age: Number(get(6)) || 0,
    governorate: get(7),
    educationalStage: get(8),
    consentMediaUsage: strToBool(row[9]),

    nationalIdFileUrl: get(10) || "",
    birthPaperFileUrl: get(11) || "",

    status: get(12) || "Pending",
    ticketId: get(13) || null,
    emailSent: strToBool(row[14]),
    checkedIn: strToBool(row[15]),
    checkedInAt: get(16) || null,
  };
}

async function appendRegistration(input) {
  try {
    await ensureHeaders();
  } catch (err) {
    throw new Error(`Could not initialize Google Sheet headers: ${err?.message || String(err)}`);
  }

  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const title = await getSheetTitle();

  const timestamp = new Date().toISOString();
  const values = [
    timestamp,
    input.fullName,
    input.email,
    input.mobileNumber,
    input.whatsappNumber,
    input.gender,
    String(input.age),
    input.governorate,
    input.educationalStage,
    boolToStr(input.consentMediaUsage),
    input.nationalIdFileUrl || "",
    input.birthPaperFileUrl || "",
    "Pending",
    "",
    boolToStr(false),
    boolToStr(false),
    "",
  ];

  let result;
  try {
    result = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${title}'!A:Q`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });
  } catch (err) {
    throw new Error(`Failed to append registration row to Google Sheets: ${err?.message || String(err)}`);
  }

  const updatedRange = result.data.updates?.updatedRange ?? "";
  const match = updatedRange.match(/(\d+)(?::|$)/);
  const rowNumber = match ? Number(match[1]) : NaN;
  if (!rowNumber || Number.isNaN(rowNumber)) {
    throw new Error("Could not determine the new registration's row number");
  }

  return rowToRegistration(values, rowNumber);
}

async function listRegistrations() {
  await ensureHeaders();
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const title = await getSheetTitle();

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${title}'!A2:Q`,
  });

  const rows = result.data.values ?? [];
  return rows
    .map((row, i) => (row.length > 0 ? rowToRegistration(row, i + 2) : null))
    .filter((r) => r !== null);
}

async function getRegistration(id) {
  await ensureHeaders();
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const title = await getSheetTitle();

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${title}'!A${id}:Q${id}`,
  });

  const row = result.data.values?.[0];
  if (!row || row.length === 0) return null;
  return rowToRegistration(row, id);
}

async function findRegistrationByTicketId(ticketId) {
  const rows = await listRegistrations();
  return rows.find((r) => r.ticketId === ticketId) ?? null;
}

async function updateRegistrationStatusColumns(id, fields) {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const title = await getSheetTitle();

  // Columns for status update start at M (Status)
  // M Status | N TicketId | O EmailSent | P CheckedIn | Q CheckedInAt
  const values = [
    fields.status,
    fields.ticketId ?? "",
    boolToStr(fields.emailSent),
    boolToStr(fields.checkedIn),
    fields.checkedInAt ?? "",
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!M${id}:Q${id}`,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

// In-process lock per row id, so two simultaneous check-in scans of the
// same ticket (or an approve racing a checkin) can't both succeed.
const rowLocks = new Map();

async function withRowLock(id, fn) {
  const previous = rowLocks.get(id) ?? Promise.resolve();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const next = previous.then(() => gate);
  rowLocks.set(id, next);

  await previous.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (rowLocks.get(id) === next) rowLocks.delete(id);
  }
}

async function updateRegistrationData(id, data) {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const title = await getSheetTitle();

  // Update columns B:M — FullName through Status (skip A=Timestamp)
  const values = [
    data.fullName,
    data.email,
    data.mobileNumber,
    data.whatsappNumber,
    data.gender,
    String(data.age),
    data.governorate,
    data.educationalStage,
    boolToStr(data.consentMediaUsage !== false),
    data.nationalIdFileUrl || '',
    data.birthPaperFileUrl || '',
    data.status,
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!B${id}:M${id}`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });

  return getRegistration(id);
}

module.exports = {
  appendRegistration,
  listRegistrations,
  getRegistration,
  findRegistrationByTicketId,
  updateRegistrationStatusColumns,
  updateRegistrationData,
  withRowLock,
};


