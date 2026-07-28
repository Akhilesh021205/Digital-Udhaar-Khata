/**
 * Middleware to restrict access based on user roles
 * @param {...string} allowedRoles - List of roles permitted to access the route
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - User profile not loaded',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access denied. Role '${req.user.role}' is not authorized.`,
      });
    }

    next();
  };
};

module.exports = {
  authorizeRoles,
};
