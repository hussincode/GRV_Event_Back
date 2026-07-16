const jwt = require("jsonwebtoken");

const COOKIE_NAME = "grv_admin_session";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function verifyAdminCredentials(username, password) {
  const expectedUsername = requiredEnv("ADMIN_USERNAME");
  const expectedPassword = requiredEnv("ADMIN_PASSWORD");
  return username === expectedUsername && password === expectedPassword;
}

function signAdminToken(payload) {
  const secret = requiredEnv("JWT_SECRET");
  return jwt.sign(payload, secret, { expiresIn: "12h" });
}

function setAdminCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd, // required when sameSite="none"
    maxAge: 12 * 60 * 60 * 1000,
    path: "/",
  });
}


function clearAdminCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

function requireAdmin(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const secret = requiredEnv("JWT_SECRET");
    const payload = jwt.verify(token, secret);
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: "Session expired, please log in again" });
  }
}

function getAdminFromCookie(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const secret = requiredEnv("JWT_SECRET");
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

module.exports = {
  verifyAdminCredentials,
  signAdminToken,
  setAdminCookie,
  clearAdminCookie,
  requireAdmin,
  getAdminFromCookie,
};
