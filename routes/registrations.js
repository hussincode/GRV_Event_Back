const express = require("express");
const { requireAdmin } = require("../lib/auth");
const {
  getRegistration,
  listRegistrations,
  updateRegistrationStatusColumns,
  withRowLock,
} = require("../lib/sheets");
const { generateTicketId, generateTicketQrCodeDataUrl } = require("../lib/qrcode");
const { sendApprovalEmail, sendRejectionEmail } = require("../lib/mailer");

const router = express.Router();

router.get("/admin/registrations", requireAdmin, async (_req, res) => {
  try {
    const rows = await listRegistrations();
    res.json(rows);
  } catch (err) {
    console.error("Failed to list registrations:", err);
    res.status(500).json({ error: "Could not load registrations right now." });
  }
});

router.get("/admin/registrations/stats", requireAdmin, async (_req, res) => {
  try {
    const rows = await listRegistrations();
    res.json({
      total: rows.length,
      pending: rows.filter((r) => r.status === "Pending").length,
      approved: rows.filter((r) => r.status === "Approved").length,
      rejected: rows.filter((r) => r.status === "Rejected").length,
      checkedIn: rows.filter((r) => r.checkedIn).length,
    });
  } catch (err) {
    console.error("Failed to compute stats:", err);
    res.status(500).json({ error: "Could not load stats right now." });
  }
});

router.post("/admin/registrations/:rowId/approve", requireAdmin, async (req, res) => {
  const rowId = Number(req.params.rowId);
  if (!rowId || Number.isNaN(rowId)) {
    res.status(404).json({ error: "Registration not found" });
    return;
  }

  try {
    const updated = await withRowLock(rowId, async () => {
      const row = await getRegistration(rowId);
      if (!row || !row.fullName) return null;

      // Idempotent: if already approved and emailed, just return current state.
      if (row.status === "Approved" && row.emailSent && row.ticketId) return row;

      const ticketId = row.ticketId || generateTicketId();

      // Get the frontend origin from request headers (Referer or Origin) to point the QR code link to the frontend page.
      let origin = `${req.protocol}://${req.get("host")}`;
      const referer = req.headers.referer;
      if (referer) {
        try {
          origin = new URL(referer).origin;
        } catch (e) {
          // ignore parsing error
        }
      } else if (req.headers.origin) {
        origin = req.headers.origin;
      }
      const checkinUrl = `${origin}/checkin-admin?ticket=${encodeURIComponent(ticketId)}`;
      const qrCodeDataUrl = await generateTicketQrCodeDataUrl(checkinUrl);

      let emailSent = row.emailSent;
      if (!emailSent) {
        await sendApprovalEmail({ to: row.email, fullName: row.fullName, ticketId, qrCodeDataUrl });
        emailSent = true;
      }

      const next = { ...row, status: "Approved", ticketId, emailSent };
      await updateRegistrationStatusColumns(rowId, {
        status: next.status,
        ticketId: next.ticketId,
        emailSent: next.emailSent,
        checkedIn: next.checkedIn,
        checkedInAt: next.checkedInAt,
      });
      return next;
    });

    if (!updated) {
      res.status(404).json({ error: "Registration not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("Failed to approve registration:", err);
    res.status(500).json({ error: "Could not approve this registration right now. Please try again." });
  }
});

router.post("/admin/registrations/:rowId/reject", requireAdmin, async (req, res) => {
  const rowId = Number(req.params.rowId);
  if (!rowId || Number.isNaN(rowId)) {
    res.status(404).json({ error: "Registration not found" });
    return;
  }

  try {
    const updated = await withRowLock(rowId, async () => {
      const row = await getRegistration(rowId);
      if (!row || !row.fullName) return null;

      if (row.status === "Rejected" && row.emailSent) return row;

      let emailSent = row.emailSent;
      if (!emailSent) {
        await sendRejectionEmail({ to: row.email, fullName: row.fullName });
        emailSent = true;
      }

      const next = { ...row, status: "Rejected", emailSent };
      await updateRegistrationStatusColumns(rowId, {
        status: next.status,
        ticketId: next.ticketId,
        emailSent: next.emailSent,
        checkedIn: next.checkedIn,
        checkedInAt: next.checkedInAt,
      });
      return next;
    });

    if (!updated) {
      res.status(404).json({ error: "Registration not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("Failed to reject registration:", err);
    res.status(500).json({ error: "Could not reject this registration right now. Please try again." });
  }
});

module.exports = router;
