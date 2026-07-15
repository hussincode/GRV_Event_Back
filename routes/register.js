const express = require("express");
const { appendRegistration } = require("../lib/sheets");

const router = express.Router();

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
  if (body.consentMediaUsage !== true) errors.push("You must agree to the media consent to register");
  return errors;
}

router.post("/register", async (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length > 0) {
    res.status(400).json({ error: errors[0] });
    return;
  }

  try {
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
    });
    res.status(201).json(created);
  } catch (err) {
    console.error("Failed to save registration:", err);
    res.status(500).json({ error: "Could not save your registration right now. Please try again shortly." });
  }
});

module.exports = router;
