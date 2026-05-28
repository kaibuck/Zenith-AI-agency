/**
 * Protects admin routes with a simple session-based password gate.
 * Password is set via ADMIN_PASSWORD env var.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { requireAuth };
