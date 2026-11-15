const Registration = require('../models/Registration');
const { asyncHandler } = require('../utils/errors');

exports.mine = asyncHandler(async (req, res) => {
  const regs = await Registration.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate({ path: 'event', populate: { path: 'organizer', select: 'name' } });
  const now = new Date();
  const items = regs.filter((r) => r.event).map((r) => ({
    _id: r._id,
    registeredAt: r.createdAt,
    event: r.event,
    isPast: r.event.endsAt < now,
  }));
  res.json({ registrations: items });
});
