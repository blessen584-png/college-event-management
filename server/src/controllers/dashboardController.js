const Event = require('../models/Event');
const User = require('../models/User');
const Registration = require('../models/Registration');
const { asyncHandler } = require('../utils/errors');

async function studentDashboard(user) {
  const regs = await Registration.find({ user: user._id }).populate('event', 'title category venue startsAt endsAt status');
  const now = new Date();
  const valid = regs.filter((r) => r.event);
  const upcoming = valid.filter((r) => r.event.endsAt >= now).sort((a, b) => a.event.startsAt - b.event.startsAt);
  const past = valid.filter((r) => r.event.endsAt < now).sort((a, b) => b.event.startsAt - a.event.startsAt);
  const shape = (r) => ({ _id: r._id, registeredAt: r.createdAt, event: r.event });
  return {
    stats: { upcoming: upcoming.length, attended: past.length, total: valid.length },
    upcoming: upcoming.map(shape),
    past: past.slice(0, 10).map(shape),
  };
}

async function organizerDashboard(user) {
  const events = await Event.find({ organizer: user._id }).sort({ startsAt: -1 });
  const now = new Date();
  const registrations = events.reduce((s, e) => s + e.registeredCount, 0);
  const capacity = events.reduce((s, e) => s + e.capacity, 0);
  return {
    stats: {
      events: events.length,
      upcoming: events.filter((e) => e.endsAt >= now && e.status === 'published').length,
      registrations,
      fillRate: capacity ? Math.round((registrations / capacity) * 100) : 0,
    },
    events,
  };
}

async function adminDashboard() {
  const now = new Date();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [users, usersByRole, events, upcoming, registrations, recentRegistrations, byCategory, topEvents] = await Promise.all([
    User.countDocuments(),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Event.countDocuments(),
    Event.countDocuments({ endsAt: { $gte: now }, status: 'published' }),
    Registration.countDocuments(),
    Registration.countDocuments({ createdAt: { $gte: weekAgo } }),
    Event.aggregate([
      { $group: { _id: '$category', events: { $sum: 1 }, registrations: { $sum: '$registeredCount' } } },
      { $sort: { events: -1 } },
    ]),
    Event.find().sort({ registeredCount: -1 }).limit(5).select('title category registeredCount capacity startsAt'),
  ]);
  return {
    stats: { users, events, upcoming, registrations, recentRegistrations },
    usersByRole: Object.fromEntries(usersByRole.map((r) => [r._id, r.count])),
    byCategory: byCategory.map((c) => ({ category: c._id, events: c.events, registrations: c.registrations })),
    topEvents,
  };
}

exports.get = asyncHandler(async (req, res) => {
  const role = req.user.role;
  const data =
    role === 'admin' ? await adminDashboard() : role === 'organizer' ? await organizerDashboard(req.user) : await studentDashboard(req.user);
  res.json({ role, ...data });
});
