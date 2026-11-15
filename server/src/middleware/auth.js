const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { HttpError, asyncHandler } = require('../utils/errors');

const secret = () => process.env.JWT_SECRET || 'dev-only-secret';

const signToken = (userId) => jwt.sign({ id: userId }, secret(), { expiresIn: '7d' });

async function userFromHeader(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const payload = jwt.verify(header.slice(7), secret());
  return User.findById(payload.id);
}

// Requires a valid token.
const protect = asyncHandler(async (req, _res, next) => {
  let user = null;
  try {
    user = await userFromHeader(req);
  } catch {
    throw new HttpError(401, 'Your session has expired. Please log in again.');
  }
  if (!user) throw new HttpError(401, 'Please log in to continue.');
  req.user = user;
  next();
});

// Attaches req.user when a valid token is present, otherwise continues as a guest.
const optionalAuth = asyncHandler(async (req, _res, next) => {
  try {
    req.user = (await userFromHeader(req)) || undefined;
  } catch {
    req.user = undefined;
  }
  next();
});

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new HttpError(403, 'You do not have permission to do that.'));
  }
  next();
};

module.exports = { protect, optionalAuth, requireRole, signToken };
