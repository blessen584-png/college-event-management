const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { CATEGORIES } = require('../models/Event');
const { asyncHandler, HttpError, escapeRegex } = require('../utils/errors');
const { validateEvent, fail } = require('../utils/validate');

const SORTS = {
  date_asc: { startsAt: 1 },
  date_desc: { startsAt: -1 },
  popular: { registeredCount: -1, startsAt: 1 },
  newest: { createdAt: -1 },
};

const canManage = (user, event) =>
  !!user && (user.role === 'admin' || String(event.organizer?._id || event.organizer) === String(user._id));

const loadEvent = async (id) => {
  const event = await Event.findById(id);
  if (!event) throw new HttpError(404, 'That event could not be found.');
  return event;
};

const assertManager = (user, event) => {
  if (!canManage(user, event)) throw new HttpError(403, 'Only the organizer or an admin can do that.');
};

function buildFilter(query) {
  const filter = {};
  const and = [];
  const q = String(query.q || '').trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ title: rx }, { description: rx }, { venue: rx }] });
  }
  if (CATEGORIES.includes(query.category)) filter.category = query.category;
  if (['published', 'cancelled'].includes(query.status)) filter.status = query.status;

  const when = query.when || 'upcoming';
  const now = new Date();
  if (when === 'upcoming') filter.endsAt = { $gte: now };
  else if (when === 'past') filter.endsAt = { $lt: now };

  const range = {};
  if (query.from && !Number.isNaN(Date.parse(query.from))) range.$gte = new Date(query.from);
  if (query.to && !Number.isNaN(Date.parse(query.to))) {
    const to = new Date(query.to);
    to.setUTCHours(23, 59, 59, 999);
    range.$lte = to;
  }
  if (Object.keys(range).length) filter.startsAt = range;

  if (query.available === 'true') and.push({ $expr: { $lt: ['$registeredCount', '$capacity'] } });
  if (and.length) filter.$and = and;
  return { filter, when };
}

exports.list = asyncHandler(async (req, res) => {
  const { filter, when } = buildFilter(req.query);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 9));
  const sort = SORTS[req.query.sort] || (when === 'past' ? SORTS.date_desc : SORTS.date_asc);

  const [total, events] = await Promise.all([
    Event.countDocuments(filter),
    Event.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate('organizer', 'name department'),
  ]);

  let registered = new Set();
  if (req.user && events.length) {
    const regs = await Registration.find({ user: req.user._id, event: { $in: events.map((e) => e._id) } }).select('event');
    registered = new Set(regs.map((r) => String(r.event)));
  }

  res.json({
    events: events.map((e) => ({ ...e.toJSON(), isRegistered: registered.has(String(e._id)) })),
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
});

exports.categories = (_req, res) => res.json({ categories: CATEGORIES });

exports.get = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id).populate('organizer', 'name email department');
  if (!event) throw new HttpError(404, 'That event could not be found.');
  const isRegistered = req.user ? !!(await Registration.exists({ event: event._id, user: req.user._id })) : false;
  res.json({ event: { ...event.toJSON(), isRegistered, canManage: canManage(req.user, event) } });
});

exports.create = asyncHandler(async (req, res) => {
  const { data, errors } = validateEvent(req.body || {}, { requireFutureStart: true });
  if (!errors.endsAt && !errors.startsAt && data.endsAt <= data.startsAt) errors.endsAt = 'End time must be after the start time.';
  fail(errors);
  const event = await Event.create({ ...data, organizer: req.user._id });
  res.status(201).json({ event });
});

exports.update = asyncHandler(async (req, res) => {
  const event = await loadEvent(req.params.id);
  assertManager(req.user, event);

  const { data, errors } = validateEvent(req.body || {}, { partial: true });
  const startsAt = data.startsAt || event.startsAt;
  const endsAt = data.endsAt || event.endsAt;
  if (!errors.startsAt && !errors.endsAt && endsAt <= startsAt) errors.endsAt = 'End time must be after the start time.';
  if (!errors.capacity && data.capacity !== undefined && data.capacity < event.registeredCount) {
    errors.capacity = `Capacity cannot be lower than the ${event.registeredCount} people already registered.`;
  }
  fail(errors);

  event.set(data);
  await event.save();
  res.json({ event });
});

exports.remove = asyncHandler(async (req, res) => {
  const event = await loadEvent(req.params.id);
  assertManager(req.user, event);
  await Registration.deleteMany({ event: event._id });
  await event.deleteOne();
  res.json({ message: 'Event deleted.' });
});

exports.mine = asyncHandler(async (req, res) => {
  const events = await Event.find({ organizer: req.user._id }).sort({ startsAt: -1 });
  res.json({ events });
});

exports.register = asyncHandler(async (req, res) => {
  const event = await loadEvent(req.params.id);
  if (event.status === 'cancelled') throw new HttpError(409, 'This event has been cancelled.');
  if (event.endsAt < new Date()) throw new HttpError(409, 'This event has already ended.');

  // The unique index blocks duplicates; the conditional update below blocks overbooking atomically.
  try {
    await Registration.create({ event: event._id, user: req.user._id });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, 'You are already registered for this event.');
    throw err;
  }
  const updated = await Event.findOneAndUpdate(
    { _id: event._id, $expr: { $lt: ['$registeredCount', '$capacity'] } },
    { $inc: { registeredCount: 1 } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    await Registration.deleteOne({ event: event._id, user: req.user._id });
    throw new HttpError(409, 'Sorry, this event is full.');
  }
  res.status(201).json({ message: 'You are registered.', event: updated });
});

exports.unregister = asyncHandler(async (req, res) => {
  const event = await loadEvent(req.params.id);
  const removed = await Registration.findOneAndDelete({ event: event._id, user: req.user._id });
  if (!removed) throw new HttpError(404, 'You are not registered for this event.');
  const updated = await Event.findOneAndUpdate(
    { _id: event._id, registeredCount: { $gt: 0 } },
    { $inc: { registeredCount: -1 } },
    { returnDocument: 'after' }
  );
  res.json({ message: 'Registration cancelled.', event: updated || event });
});

exports.attendees = asyncHandler(async (req, res) => {
  const event = await loadEvent(req.params.id);
  assertManager(req.user, event);
  const regs = await Registration.find({ event: event._id }).sort({ createdAt: 1 }).populate('user', 'name email department');
  res.json({
    event: { _id: event._id, title: event.title, capacity: event.capacity, registeredCount: event.registeredCount },
    attendees: regs.filter((r) => r.user).map((r) => ({ _id: r._id, registeredAt: r.createdAt, user: r.user })),
  });
});

const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // blocks spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};

exports.attendeesCsv = asyncHandler(async (req, res) => {
  const event = await loadEvent(req.params.id);
  assertManager(req.user, event);
  const regs = await Registration.find({ event: event._id }).sort({ createdAt: 1 }).populate('user', 'name email department');
  const rows = [['Name', 'Email', 'Department', 'Registered at'].map(csvCell).join(',')];
  regs.filter((r) => r.user).forEach((r) =>
    rows.push([r.user.name, r.user.email, r.user.department, r.createdAt.toISOString()].map(csvCell).join(','))
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="attendees-${event._id}.csv"`);
  res.send(rows.join('\n'));
});
