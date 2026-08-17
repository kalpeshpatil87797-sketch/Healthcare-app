const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET ?? "your-secret-key-change-this";

async function restrictToLoggedinUserOnly(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

async function checkAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];

  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      req.user = undefined;
    }
  }
  next();
}

module.exports = { restrictToLoggedinUserOnly, checkAuth };