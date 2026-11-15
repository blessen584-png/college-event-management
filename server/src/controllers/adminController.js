const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { ROLES } = require('../models/User');
const { asyncHandler, HttpError, escapeRegex } = require('../utils/errors');

exports.listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  const q = String(req.query.q || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { department: rx }];
  }
  if (ROLES.includes(req.query.role)) filter.role = req.query.role;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
  ]);
  res.json({ users, page, pages: Math.max(1, Math.ceil(total / limit)), total });
});

exports.updateRole = asyncHandler(async (req, res) => {
  const { role } = req.body || {};
  if (!ROLES.includes(role)) throw new HttpError(400, 'Choose a valid role.', { role: 'Choose student, organizer or admin.' });
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'That user could not be found.');
  if (String(user._id) === String(req.user._id)) throw new HttpError(400, 'You cannot change your own role.');
  user.role = role;
  await user.save();
  res.json({ user });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'That user could not be found.');
  if (String(user._id) === String(req.user._id)) throw new HttpError(400, 'You cannot delete your own account.');

  // Release the seats this user held, then remove events they organised together with those events' registrations.
  const held = await Registration.find({ user: user._id }).select('event');
  if (held.length) {
    await Event.bulkWrite(
      held.map((r) => ({ updateOne: { filter: { _id: r.event, registeredCount: { $gt: 0 } }, update: { $inc: { registeredCount: -1 } } } }))
    );
  }
  await Registration.deleteMany({ user: user._id });
  const owned = await Event.find({ organizer: user._id }).select('_id');
  await Registration.deleteMany({ event: { $in: owned.map((e) => e._id) } });
  await Event.deleteMany({ organizer: user._id });
  await user.deleteOne();
  res.json({ message: 'User deleted.' });
});
