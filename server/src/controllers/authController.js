const User = require('../models/User');
const { asyncHandler, HttpError } = require('../utils/errors');
const { validateRegister, fail } = require('../utils/validate');
const { signToken } = require('../middleware/auth');

exports.register = asyncHandler(async (req, res) => {
  const data = validateRegister(req.body || {});
  if (await User.exists({ email: data.email })) {
    throw new HttpError(409, 'An account with this email already exists.', { email: 'This email is already registered.' });
  }
  const user = await User.create(data);
  res.status(201).json({ token: signToken(user._id), user });
});

exports.login = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const errors = {};
  if (!email) errors.email = 'Enter your email.';
  if (!password) errors.password = 'Enter your password.';
  fail(errors);

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchesPassword(password))) {
    throw new HttpError(401, 'Incorrect email or password.');
  }
  res.json({ token: signToken(user._id), user });
});

exports.me = (req, res) => res.json({ user: req.user });

exports.updateMe = asyncHandler(async (req, res) => {
  const errors = {};
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (name.length < 2 || name.length > 80) errors.name = 'Enter your name (2 to 80 characters).';
    else req.user.name = name;
  }
  if (req.body.department !== undefined) req.user.department = String(req.body.department).trim().slice(0, 80);
  fail(errors);
  await req.user.save();
  res.json({ user: req.user });
});
