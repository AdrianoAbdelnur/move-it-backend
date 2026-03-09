const DEFAULT_AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "access_token";
const DEFAULT_CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || "csrf_token";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const normalizePath = (urlPath = "") => String(urlPath || "").split("?")[0];

const extractOriginFromReferer = (referer = "") => {
  try {
    return new URL(referer).origin;
  } catch (_) {
    return "";
  }
};

const createCsrfProtection = ({
  allowedOrigins = [],
  authCookieName = DEFAULT_AUTH_COOKIE_NAME,
  csrfCookieName = DEFAULT_CSRF_COOKIE_NAME,
  excludedPaths = [],
} = {}) => {
  const excludedPathSet = new Set(excludedPaths.map((p) => normalizePath(p)));

  return (req, res, next) => {
    if (!MUTATING_METHODS.has(String(req.method || "").toUpperCase())) return next();

    const requestPath = normalizePath(req.originalUrl || req.url);
    if (excludedPathSet.has(requestPath)) return next();

    const authCookie = req?.cookies?.[authCookieName];
    if (!authCookie) return next();

    const originHeader = String(req.get("origin") || "").trim();
    const refererOrigin = extractOriginFromReferer(req.get("referer"));
    const requestOrigin = originHeader || refererOrigin;
    if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
      return res.status(403).json({ message: "Invalid request origin." });
    }

    const csrfCookieToken = String(req?.cookies?.[csrfCookieName] || "").trim();
    const csrfHeaderToken = String(req.get("x-csrf-token") || "").trim();

    if (!csrfCookieToken || !csrfHeaderToken || csrfCookieToken !== csrfHeaderToken) {
      return res.status(403).json({ message: "CSRF validation failed." });
    }

    return next();
  };
};

module.exports = { createCsrfProtection };

