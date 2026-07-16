const express = require("express");
const path = require("path");
const { appendRegistration, listRegistrations } = require("../lib/sheets");
const { upload } = require("../lib/upload-multer");

const router = express.Router();

const REGISTRATION_LIMIT = Number(process.env.REGISTRATION_LIMIT) || 210;

const GOVERNORATES = [
  "Cairo", "Alexandria", "Giza", "Qalyubia", "Port Said", "Suez", "Dakahlia", "Sharqia",
  "Gharbia", "Monufia", "Beheira", "Ismailia", "Faiyum", "Beni Suef", "Minya", "Asyut",
  "Sohag", "Qena", "Aswan", "Luxor", "Red Sea", "New Valley", "Matrouh", "North Sinai",
  "South Sinai", "Kafr El Sheikh", "Damietta",
];

function validate(body) {
  const errors = [];

  if (!body.fullName || String(body.fullName).trim().length < 2) errors.push("Full name is required");
  if (!body.email || !/^\S+@\S+\.\S+$/.test(body.email)) errors.push("A valid email is required");
  if (!body.mobileNumber || String(body.mobileNumber).trim().length < 8) errors.push("A valid mobile number is required");
  if (!body.whatsappNumber || String(body.whatsappNumber).trim().length < 8) errors.push("A valid WhatsApp number is required");
  if (!["Male", "Female"].includes(body.gender)) errors.push("Please select a gender");
  const age = Number(body.age);
  if (!age || age < 5 || age > 120) errors.push("Please enter a valid age");
  if (!body.governorate || !GOVERNORATES.includes(body.governorate)) errors.push("Please select a governorate");
  if (!body.educationalStage || String(body.educationalStage).trim().length === 0) errors.push("Please select your educational stage");
  const consent = body.consentMediaUsage;
  if (consent !== true && String(consent).toLowerCase() !== 'true') errors.push("You must agree to the media consent to register");
  return errors;
}

// ── Public: registration status ──────────────────────────────────────────────
// Returns whether registration is still open and how many spots remain.
// No authentication required.
router.get("/registration-status", async (_req, res) => {
  try {
    const rows = await listRegistrations();
    const total = rows.length;
    const open = total < REGISTRATION_LIMIT;
    res.json({
      open,
      total,
      limit: REGISTRATION_LIMIT,
      remaining: Math.max(0, REGISTRATION_LIMIT - total),
    });
  } catch (err) {
    console.error("Failed to get registration status:", err);
    // If we can't reach the sheet, default to open so we don't block people unnecessarily
    res.json({ open: true, total: 0, limit: REGISTRATION_LIMIT, remaining: REGISTRATION_LIMIT });
  }
});

// ── POST /register ───────────────────────────────────────────────────────────
router.post(
  "/register",
  upload.fields([
    { name: "nationalIdFile", maxCount: 1 },
    { name: "birthPaperFile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      // ── Check registration limit FIRST ──
      try {
        const rows = await listRegistrations();
        if (rows.length >= REGISTRATION_LIMIT) {
          res.status(403).json({
            error: "Registration is now closed. The maximum number of participants has been reached.",
            registrationClosed: true,
          });
          return;
        }
      } catch (err) {
        // If we can't check, proceed — better to allow than to silently block everyone
        console.error("[register] Could not verify registration count:", err);
      }

      const errors = validate(req.body || {});

      const nationalIdFile = req.files?.nationalIdFile?.[0] ?? null;
      const birthPaperFile = req.files?.birthPaperFile?.[0] ?? null;

      if (!nationalIdFile && !birthPaperFile) {
        res.status(400).json({ error: "Please upload National ID or Birth Paper (PDF/JPG/PNG)." });
        return;
      }

      if (errors.length > 0) {
        res.status(400).json({ error: errors[0] });
        return;
      }

      const publicBaseUrl = `${req.protocol}://${req.get("host")}`;

      const created = await appendRegistration({
        fullName: String(req.body.fullName).trim(),
        email: String(req.body.email).trim(),
        mobileNumber: String(req.body.mobileNumber).trim(),
        whatsappNumber: String(req.body.whatsappNumber).trim(),
        gender: req.body.gender,
        age: Number(req.body.age),
        governorate: req.body.governorate,
        educationalStage: String(req.body.educationalStage).trim(),
        consentMediaUsage: true,
        nationalIdFileUrl: nationalIdFile
          ? nationalIdFile.filename 
            ? `${publicBaseUrl}/uploads/${encodeURIComponent(nationalIdFile.filename)}`
            : `[File received: ${nationalIdFile.originalname}]`
          : "",
        birthPaperFileUrl: birthPaperFile
          ? birthPaperFile.filename
            ? `${publicBaseUrl}/uploads/${encodeURIComponent(birthPaperFile.filename)}`
            : `[File received: ${birthPaperFile.originalname}]`
          : "",
      });

      res.status(201).json(created);
    } catch (err) {
      console.error("[register] Failed to save registration:", err);

      // Always return JSON so the frontend error banner can show a real message.
      const msg = (err && typeof err === 'object' && 'message' in err) ? err.message : null;
      res.status(500).json({
        error: msg || "Could not save your registration right now. Please try again shortly.",
      });
    }
  },
);


module.exports = router;
