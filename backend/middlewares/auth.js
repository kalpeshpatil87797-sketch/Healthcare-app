const jwt = require("jsonwebtoken");
const User = require("../models/user");

const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_FIELDS = "_id email role accountStatus tokenVersion";

function normalizeAccountStatus(value) {
  return value === "suspended" ? "suspended" : "active";
}

function isSuspended(user) {
  return normalizeAccountStatus(user?.accountStatus) === "suspended";
}

function sessionUser(user) {
  return {
    _id: user._id,
    email: user.email,
    role: user.role,
    accountStatus: normalizeAccountStatus(user.accountStatus),
  };
}

async function loadSessionUser(userId) {
  return User.findById(userId).select(SESSION_FIELDS).lean();
}

async function restrictToLoggedinUserOnly(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (!decoded?._id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const user = await loadSessionUser(decoded._id);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (isSuspended(user)) {
      return res.status(403).json({
        error: "This account has been suspended. Please contact a Super Admin.",
        code: "ACCOUNT_SUSPENDED",
      });
    }

    // Tokens issued before a suspension carry an older version and are rejected
    // even if the account is reactivated later.
    if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({
        error: "Your session is no longer valid. Please sign in again.",
        code: "SESSION_REVOKED",
      });
    }

    req.user = {
      _id: user._id,
      email: user.email,
      role: user.role,
    };
    req.currentUser = sessionUser(user);
    return next();
  } catch (err) {
    if (err?.name === "CastError") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    console.error("Authentication failed:", err.message);
    return res.status(500).json({ error: "Authentication failed" });
  }
}

async function checkAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded?._id) {
        const user = await loadSessionUser(decoded._id);
        if (
          user &&
          !isSuspended(user) &&
          (decoded.tv ?? 0) === (user.tokenVersion ?? 0)
        ) {
          req.user = {
            _id: user._id,
            email: user.email,
            role: user.role,
          };
          req.currentUser = sessionUser(user);
        }
      }
    } catch (err) {
      req.user = undefined;
      req.currentUser = undefined;
    }
  }

  return next();
}

function requireRole(...roles) {
  const allowedRoles = roles.flat();

  return async function (req, res, next) {
    if (!req.user?._id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (allowedRoles.length === 0) {
      return res.status(500).json({ error: "Authorization misconfigured" });
    }

    try {
      const currentUser =
        req.currentUser && String(req.currentUser._id) === String(req.user._id)
          ? req.currentUser
          : await loadSessionUser(req.user._id);

      if (!currentUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (isSuspended(currentUser)) {
        return res.status(403).json({
          error: "This account has been suspended. Please contact a Super Admin.",
          code: "ACCOUNT_SUSPENDED",
        });
      }

      if (!allowedRoles.includes(currentUser.role)) {
        return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
      }

      req.currentUser = sessionUser(currentUser);
      return next();
    } catch (err) {
      if (err?.name === "CastError") {
        return res.status(401).json({ error: "Unauthorized" });
      }
      console.error("Authorization failed:", err.message);
      return res.status(500).json({ error: "Authorization failed" });
    }
  };
}

module.exports = { restrictToLoggedinUserOnly, checkAuth, requireRole };
