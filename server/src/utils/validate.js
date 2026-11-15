const { HttpError } = require('./errors');
const { CATEGORIES, STATUSES } = require('../models/Event');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v) => (typeof v === 'string' ? v.trim() : '');

function fail(errors) {
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', errors);
}

function validateRegister(body) {
  const errors = {};
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const role = body.role || 'student';
  if (name.length < 2 || name.length > 80) errors.name = 'Enter your name (2 to 80 characters).';
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  if (password.length < 6) errors.password = 'Use at least 6 characters.';
  if (!['student', 'organizer'].includes(role)) errors.role = 'Choose student or organizer.';
  fail(errors);
  return { name, email, password, role, department: str(body.department).slice(0, 80) };
}

function validateEvent(body, { partial = false, requireFutureStart = false } = {}) {
  const errors = {};
  const out = {};
  const has = (k) => body[k] !== undefined;

  if (!partial || has('title')) {
    const v = str(body.title);
    if (v.length < 3 || v.length > 120) errors.title = 'Title must be 3 to 120 characters.';
    out.title = v;
  }
  if (!partial || has('description')) {
    const v = str(body.description);
    if (!v || v.length > 3000) errors.description = 'Add a description (up to 3000 characters).';
    out.description = v;
  }
  if (!partial || has('category')) {
    if (!CATEGORIES.includes(body.category)) errors.category = 'Choose a category.';
    out.category = body.category;
  }
  if (!partial || has('venue')) {
    const v = str(body.venue);
    if (!v || v.length > 120) errors.venue = 'Enter the venue (up to 120 characters).';
    out.venue = v;
  }
  if (!partial || has('startsAt')) {
    const d = new Date(body.startsAt);
    if (!body.startsAt || Number.isNaN(d.getTime())) errors.startsAt = 'Choose a valid start date and time.';
    else if (requireFutureStart && d.getTime() < Date.now()) errors.startsAt = 'Start time must be in the future.';
    out.startsAt = d;
  }
  if (!partial || has('endsAt')) {
    const d = new Date(body.endsAt);
    if (!body.endsAt || Number.isNaN(d.getTime())) errors.endsAt = 'Choose a valid end date and time.';
    out.endsAt = d;
  }
  if (!partial || has('capacity')) {
    const n = Number(body.capacity);
    if (!Number.isInteger(n) || n < 1 || n > 100000) errors.capacity = 'Capacity must be a whole number from 1 to 100000.';
    out.capacity = n;
  }
  if (has('status')) {
    if (!STATUSES.includes(body.status)) errors.status = 'Status must be published or cancelled.';
    out.status = body.status;
  }
  return { data: out, errors };
}

module.exports = { validateRegister, validateEvent, fail };
