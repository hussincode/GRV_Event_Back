const express = require("express");
const {
  clearAdminCookie,
  getAdminFromCookie,
  requireAdmin,
  setAdminCookie,
  signAdminToken,
  verifyAdminCredentials,
} = require("../lib/auth");

const router = express.Router();

router.post("/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || !verifyAdminCredentials(username, password)) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = signAdminToken({ username });
  setAdminCookie(res, token);
  res.json({ username });
});

router.post("/admin/logout", (_req, res) => {
  clearAdminCookie(res);
  res.status(204).send();
});

router.get("/admin/me", requireAdmin, (req, res) => {
  const admin = getAdminFromCookie(req);
  if (!admin) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ username: admin.username });
});

module.exports = router;
