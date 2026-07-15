const express = require("express");
const {
  findRegistrationByTicketId,
  getRegistration,
  updateRegistrationStatusColumns,
  withRowLock,
} = require("../lib/sheets");
const { requireAdmin } = require("../lib/auth");

const router = express.Router();

router.get("/checkin/lookup/:ticketId", requireAdmin, async (req, res) => {
  const ticketId = req.params.ticketId;
  if (!ticketId) {
    res.json({ found: false, fullName: null, ticketId: null, status: null, checkedIn: false, checkedInAt: null });
    return;
  }

  try {
    const found = await findRegistrationByTicketId(ticketId);
    if (!found) {
      res.json({ found: false, fullName: null, ticketId: null, status: null, checkedIn: false, checkedInAt: null });
      return;
    }
    res.json({
      found: true,
      fullName: found.fullName,
      ticketId: found.ticketId,
      status: found.status,
      checkedIn: found.checkedIn,
      checkedInAt: found.checkedInAt,
    });
  } catch (err) {
    console.error("Failed to look up ticket:", err);
    res.status(500).json({ error: "Could not look up this ticket right now. Please try again." });
  }
});

router.post("/checkin/:ticketId", requireAdmin, async (req, res) => {
  const ticketId = req.params.ticketId;
  if (!ticketId) {
    res.json({ result: "invalid", fullName: null, checkedInAt: null });
    return;
  }

  try {
    const found = await findRegistrationByTicketId(ticketId);
    if (!found) {
      res.json({ result: "invalid", fullName: null, checkedInAt: null });
      return;
    }

    const result = await withRowLock(found.id, async () => {
      // Re-read inside the lock so concurrent scans of the same ticket never
      // both observe "not checked in".
      const row = await getRegistration(found.id);
      if (!row || row.ticketId !== ticketId) {
        return { result: "invalid", fullName: null, checkedInAt: null };
      }
      if (row.status !== "Approved") {
        return { result: "not_approved", fullName: row.fullName, checkedInAt: null };
      }
      if (row.checkedIn) {
        return { result: "already_checked_in", fullName: row.fullName, checkedInAt: row.checkedInAt };
      }

      const checkedInAt = new Date().toISOString();
      await updateRegistrationStatusColumns(row.id, {
        status: row.status,
        ticketId: row.ticketId,
        emailSent: row.emailSent,
        checkedIn: true,
        checkedInAt,
      });
      return { result: "success", fullName: row.fullName, checkedInAt };
    });

    res.json(result);
  } catch (err) {
    console.error("Failed to process check-in:", err);
    res.status(500).json({ error: "Could not process check-in right now. Please try again." });
  }
});

module.exports = router;
