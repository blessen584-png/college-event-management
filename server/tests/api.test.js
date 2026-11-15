process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Event = require('../src/models/Event');
const Registration = require('../src/models/Registration');

const DAY = 24 * 3600 * 1000;
const iso = (days, hours = 0) => new Date(Date.now() + days * DAY + hours * 3600 * 1000).toISOString();
const eventBody = (over = {}) => ({
  title: 'Test Hackathon', description: 'Build things.', category: 'Technical', venue: 'Lab 1',
  startsAt: iso(5), endsAt: iso(5, 3), capacity: 2, ...over,
});

const api = () => request(app);
const auth = (t) => ({ Authorization: `Bearer ${t}` });
async function signup(name, email, role = 'student') {
  const res = await api().post('/api/auth/register').send({ name, email, password: 'secret12', role });
  return { token: res.body.token, user: res.body.user, res };
}

let admin, org, org2, s1, s2, s3;

beforeAll(async () => {
  await connectDB(process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/cems_test');
  await mongoose.connection.dropDatabase();
  await Promise.all([User.init(), Event.init(), Registration.init()]);
  org = await signup('Olive Organizer', 'org@t.edu', 'organizer');
  org2 = await signup('Other Org', 'org2@t.edu', 'organizer');
  s1 = await signup('Sam One', 's1@t.edu');
  s2 = await signup('Sam Two', 's2@t.edu');
  s3 = await signup('Sam Three', 's3@t.edu');
  await User.create({ name: 'Ada Admin', email: 'admin@t.edu', password: 'secret12', role: 'admin' });
  const login = await api().post('/api/auth/login').send({ email: 'admin@t.edu', password: 'secret12' });
  admin = { token: login.body.token, user: login.body.user };
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('Authentication', () => {
  test('register returns token and hides password', async () => {
    expect(org.res.status).toBe(201);
    expect(org.token).toBeTruthy();
    expect(org.user.password).toBeUndefined();
    expect(org.user.role).toBe('organizer');
  });

  test('rejects duplicate email', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'Dup', email: 'S1@t.edu', password: 'secret12' });
    expect(res.status).toBe(409);
    expect(res.body.errors.email).toBeTruthy();
  });

  test('validates registration fields', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'x', email: 'nope', password: '1' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  test('cannot self-register as admin', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'Evil', email: 'evil@t.edu', password: 'secret12', role: 'admin' });
    expect(res.status).toBe(400);
  });

  test('login succeeds and fails correctly', async () => {
    const ok = await api().post('/api/auth/login').send({ email: 's1@t.edu', password: 'secret12' });
    expect(ok.status).toBe(200);
    const bad = await api().post('/api/auth/login').send({ email: 's1@t.edu', password: 'wrong-pass' });
    expect(bad.status).toBe(401);
  });

  test('/me requires a valid token', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api().get('/api/auth/me').set(auth('garbage'))).status).toBe(401);
    const res = await api().get('/api/auth/me').set(auth(s1.token));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('s1@t.edu');
  });

  test('profile update', async () => {
    const res = await api().put('/api/auth/me').set(auth(s3.token)).send({ department: 'MCA' });
    expect(res.status).toBe(200);
    expect(res.body.user.department).toBe('MCA');
  });
});

describe('Events: CRUD and permissions', () => {
  let eventId;

  test('students cannot create events', async () => {
    const res = await api().post('/api/events').set(auth(s1.token)).send(eventBody());
    expect(res.status).toBe(403);
  });

  test('guests cannot create events', async () => {
    expect((await api().post('/api/events').send(eventBody())).status).toBe(401);
  });

  test('organizer creates an event', async () => {
    const res = await api().post('/api/events').set(auth(org.token)).send(eventBody());
    expect(res.status).toBe(201);
    expect(res.body.event.seatsLeft).toBe(2);
    eventId = res.body.event._id;
  });

  test('validation: end before start, past start, bad category, capacity', async () => {
    const r1 = await api().post('/api/events').set(auth(org.token)).send(eventBody({ endsAt: iso(4) }));
    expect(r1.status).toBe(400);
    expect(r1.body.errors.endsAt).toBeTruthy();
    const r2 = await api().post('/api/events').set(auth(org.token)).send(eventBody({ startsAt: iso(-2), endsAt: iso(-1) }));
    expect(r2.body.errors.startsAt).toBeTruthy();
    const r3 = await api().post('/api/events').set(auth(org.token)).send(eventBody({ category: 'Nope', capacity: 0 }));
    expect(Object.keys(r3.body.errors)).toEqual(expect.arrayContaining(['category', 'capacity']));
  });

  test('anyone can read an event; manage flag depends on user', async () => {
    const guest = await api().get(`/api/events/${eventId}`);
    expect(guest.status).toBe(200);
    expect(guest.body.event.canManage).toBe(false);
    const owner = await api().get(`/api/events/${eventId}`).set(auth(org.token));
    expect(owner.body.event.canManage).toBe(true);
    const other = await api().get(`/api/events/${eventId}`).set(auth(org2.token));
    expect(other.body.event.canManage).toBe(false);
  });

  test('invalid or unknown id returns 404', async () => {
    expect((await api().get('/api/events/not-an-id')).status).toBe(404);
    expect((await api().get(`/api/events/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
  });

  test('only the owner or an admin can edit', async () => {
    const forbidden = await api().put(`/api/events/${eventId}`).set(auth(org2.token)).send({ title: 'Hijacked' });
    expect(forbidden.status).toBe(403);
    const ok = await api().put(`/api/events/${eventId}`).set(auth(org.token)).send({ title: 'Test Hackathon v2', venue: 'Lab 2' });
    expect(ok.status).toBe(200);
    expect(ok.body.event.title).toBe('Test Hackathon v2');
    const byAdmin = await api().put(`/api/events/${eventId}`).set(auth(admin.token)).send({ venue: 'Lab 3' });
    expect(byAdmin.body.event.venue).toBe('Lab 3');
  });

  test('delete removes the event and its registrations', async () => {
    const created = await api().post('/api/events').set(auth(org.token)).send(eventBody({ title: 'Disposable event' }));
    const id = created.body.event._id;
    await api().post(`/api/events/${id}/register`).set(auth(s1.token));
    expect((await api().delete(`/api/events/${id}`).set(auth(org2.token))).status).toBe(403);
    expect((await api().delete(`/api/events/${id}`).set(auth(org.token))).status).toBe(200);
    expect((await api().get(`/api/events/${id}`)).status).toBe(404);
    expect(await Registration.countDocuments({ event: id })).toBe(0);
  });

  test('organizer lists only their own events', async () => {
    const res = await api().get('/api/events/mine').set(auth(org.token));
    expect(res.status).toBe(200);
    expect(res.body.events.every((e) => String(e.organizer) === String(org.user._id))).toBe(true);
    expect((await api().get('/api/events/mine').set(auth(s1.token))).status).toBe(403);
  });
});

describe('Events: search, filter, sort, pagination', () => {
  beforeAll(async () => {
    await Event.deleteMany({});
    const mk = (title, category, venue, start, hours, capacity, extra = {}) => ({
      title, category, venue, capacity, description: `About ${title}`, organizer: org.user._id,
      startsAt: new Date(start), endsAt: new Date(new Date(start).getTime() + hours * 3600000), ...extra,
    });
    await Event.insertMany([
      mk('Alpha Coding Contest', 'Technical', 'Lab A', iso(2), 2, 10),
      mk('Beta Dance Night', 'Cultural', 'Auditorium', iso(4), 2, 10, { registeredCount: 10 }),
      mk('Gamma Cricket Cup', 'Sports', 'Ground', iso(6), 2, 10, { registeredCount: 4 }),
      mk('Delta Workshop (C++)', 'Workshop', 'Lab B', iso(8), 2, 10),
      mk('Old Quiz', 'Club', 'Hall', iso(-10), 2, 10),
      mk('Cancelled Seminar', 'Seminar', 'Hall', iso(3), 2, 10, { status: 'cancelled' }),
    ]);
  });

  test('defaults to upcoming events, earliest first', async () => {
    const res = await api().get('/api/events');
    expect(res.body.total).toBe(5);
    const dates = res.body.events.map((e) => new Date(e.startsAt).getTime());
    expect([...dates].sort((a, b) => a - b)).toEqual(dates);
  });

  test('search by text (case-insensitive) and escapes regex characters', async () => {
    expect((await api().get('/api/events?q=dance')).body.total).toBe(1);
    expect((await api().get('/api/events?q=lab')).body.total).toBe(2);
    const special = await api().get('/api/events?q=' + encodeURIComponent('C++'));
    expect(special.status).toBe(200);
    expect(special.body.total).toBe(1);
    expect((await api().get('/api/events?q=' + encodeURIComponent('(unclosed'))).status).toBe(200);
  });

  test('filter by category, when, status, availability, date range', async () => {
    expect((await api().get('/api/events?category=Sports')).body.total).toBe(1);
    expect((await api().get('/api/events?when=past')).body.total).toBe(1);
    expect((await api().get('/api/events?when=all')).body.total).toBe(6);
    expect((await api().get('/api/events?status=cancelled')).body.total).toBe(1);
    expect((await api().get('/api/events?available=true')).body.events.find((e) => e.title.startsWith('Beta'))).toBeUndefined();
    const day = (d) => iso(d).slice(0, 10);
    expect((await api().get(`/api/events?from=${day(3)}&to=${day(5)}`)).body.total).toBe(2);
  });

  test('sorting and pagination', async () => {
    const pop = await api().get('/api/events?sort=popular');
    expect(pop.body.events[0].title).toMatch(/Beta/);
    const p1 = await api().get('/api/events?limit=2&page=1');
    const p3 = await api().get('/api/events?limit=2&page=3');
    expect(p1.body.events).toHaveLength(2);
    expect(p1.body.pages).toBe(3);
    expect(p3.body.events).toHaveLength(1);
  });

  test('combined filters', async () => {
    const res = await api().get('/api/events?q=a&category=Technical&available=true');
    expect(res.body.total).toBe(1);
    expect(res.body.events[0].title).toMatch(/Alpha/);
  });
});

describe('Registrations', () => {
  let id;
  beforeAll(async () => {
    const res = await api().post('/api/events').set(auth(org.token)).send(eventBody({ title: 'Capacity Test', capacity: 2 }));
    id = res.body.event._id;
  });

  test('guests cannot register', async () => {
    expect((await api().post(`/api/events/${id}/register`)).status).toBe(401);
  });

  test('register, block duplicates, enforce capacity', async () => {
    const a = await api().post(`/api/events/${id}/register`).set(auth(s1.token));
    expect(a.status).toBe(201);
    expect(a.body.event.registeredCount).toBe(1);
    const dup = await api().post(`/api/events/${id}/register`).set(auth(s1.token));
    expect(dup.status).toBe(409);
    expect((await api().post(`/api/events/${id}/register`).set(auth(s2.token))).status).toBe(201);
    const full = await api().post(`/api/events/${id}/register`).set(auth(s3.token));
    expect(full.status).toBe(409);
    expect(full.body.message).toMatch(/full/i);
    expect((await Event.findById(id)).registeredCount).toBe(2);
    expect(await Registration.countDocuments({ event: id })).toBe(2);
  });

  test('concurrent registrations never overbook', async () => {
    const created = await api().post('/api/events').set(auth(org.token)).send(eventBody({ title: 'Race Test', capacity: 1 }));
    const raceId = created.body.event._id;
    const results = await Promise.all([s1, s2, s3].map((s) => api().post(`/api/events/${raceId}/register`).set(auth(s.token))));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect((await Event.findById(raceId)).registeredCount).toBe(1);
  });

  test('cancelling frees a seat and shows isRegistered correctly', async () => {
    const mine = await api().get(`/api/events/${id}`).set(auth(s1.token));
    expect(mine.body.event.isRegistered).toBe(true);
    const cancel = await api().delete(`/api/events/${id}/register`).set(auth(s1.token));
    expect(cancel.status).toBe(200);
    expect(cancel.body.event.registeredCount).toBe(1);
    expect((await api().delete(`/api/events/${id}/register`).set(auth(s1.token))).status).toBe(404);
    const list = await api().get('/api/events?q=Capacity').set(auth(s1.token));
    expect(list.body.events[0].isRegistered).toBe(false);
    expect((await api().post(`/api/events/${id}/register`).set(auth(s3.token))).status).toBe(201);
  });

  test('cannot register for cancelled or ended events', async () => {
    const cancelled = await Event.create({ ...eventBody({ title: 'Cancelled one' }), startsAt: new Date(Date.now() + DAY), endsAt: new Date(Date.now() + 2 * DAY), organizer: org.user._id, status: 'cancelled' });
    expect((await api().post(`/api/events/${cancelled._id}/register`).set(auth(s1.token))).status).toBe(409);
    const ended = await Event.create({ ...eventBody({ title: 'Ended one' }), startsAt: new Date(Date.now() - 2 * DAY), endsAt: new Date(Date.now() - DAY), organizer: org.user._id });
    expect((await api().post(`/api/events/${ended._id}/register`).set(auth(s1.token))).status).toBe(409);
  });

  test('capacity cannot drop below registered count', async () => {
    const res = await api().put(`/api/events/${id}`).set(auth(org.token)).send({ capacity: 1 });
    expect(res.status).toBe(400);
    expect(res.body.errors.capacity).toBeTruthy();
  });

  test('my registrations', async () => {
    const res = await api().get('/api/registrations/mine').set(auth(s2.token));
    expect(res.status).toBe(200);
    expect(res.body.registrations.length).toBeGreaterThan(0);
    expect(res.body.registrations[0].event.title).toBeTruthy();
  });

  test('attendee list and CSV are limited to the owner/admin', async () => {
    expect((await api().get(`/api/events/${id}/attendees`).set(auth(s1.token))).status).toBe(403);
    expect((await api().get(`/api/events/${id}/attendees`).set(auth(org2.token))).status).toBe(403);
    const list = await api().get(`/api/events/${id}/attendees`).set(auth(org.token));
    expect(list.status).toBe(200);
    expect(list.body.attendees).toHaveLength(2);
    const csv = await api().get(`/api/events/${id}/attendees.csv`).set(auth(admin.token));
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text.split('\n')[0]).toBe('"Name","Email","Department","Registered at"');
    expect(csv.text.split('\n')).toHaveLength(3);
  });
});

describe('Dashboards', () => {
  test('student dashboard', async () => {
    const res = await api().get('/api/dashboard').set(auth(s2.token));
    expect(res.body.role).toBe('student');
    expect(res.body.stats.upcoming).toBeGreaterThan(0);
  });
  test('organizer dashboard', async () => {
    const res = await api().get('/api/dashboard').set(auth(org.token));
    expect(res.body.role).toBe('organizer');
    expect(res.body.stats.events).toBeGreaterThan(0);
    expect(res.body.stats.registrations).toBeGreaterThan(0);
  });
  test('admin dashboard', async () => {
    const res = await api().get('/api/dashboard').set(auth(admin.token));
    expect(res.body.role).toBe('admin');
    expect(res.body.stats.users).toBeGreaterThanOrEqual(6);
    expect(res.body.byCategory.length).toBeGreaterThan(0);
    expect(res.body.usersByRole.admin).toBe(1);
  });
  test('requires login', async () => {
    expect((await api().get('/api/dashboard')).status).toBe(401);
  });
});

describe('Admin user management', () => {
  test('non-admins are blocked', async () => {
    expect((await api().get('/api/admin/users').set(auth(org.token))).status).toBe(403);
  });

  test('list with search, role filter and pagination', async () => {
    const all = await api().get('/api/admin/users?limit=3').set(auth(admin.token));
    expect(all.body.users).toHaveLength(3);
    expect(all.body.pages).toBeGreaterThan(1);
    expect((await api().get('/api/admin/users?role=organizer').set(auth(admin.token))).body.total).toBe(2);
    expect((await api().get('/api/admin/users?q=sam%20three').set(auth(admin.token))).body.total).toBe(1);
  });

  test('change role; cannot change own role or use invalid role', async () => {
    const ok = await api().patch(`/api/admin/users/${s3.user._id}/role`).set(auth(admin.token)).send({ role: 'organizer' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.role).toBe('organizer');
    expect((await api().patch(`/api/admin/users/${admin.user._id}/role`).set(auth(admin.token)).send({ role: 'student' })).status).toBe(400);
    expect((await api().patch(`/api/admin/users/${s3.user._id}/role`).set(auth(admin.token)).send({ role: 'god' })).status).toBe(400);
  });

  test('deleting a user releases seats and removes their events', async () => {
    const victim = await signup('Temp User', 'temp@t.edu');
    const ev = await api().post('/api/events').set(auth(org.token)).send(eventBody({ title: 'Seat release', capacity: 5 }));
    await api().post(`/api/events/${ev.body.event._id}/register`).set(auth(victim.token));
    expect((await Event.findById(ev.body.event._id)).registeredCount).toBe(1);
    expect((await api().delete(`/api/admin/users/${victim.user._id}`).set(auth(admin.token))).status).toBe(200);
    expect((await Event.findById(ev.body.event._id)).registeredCount).toBe(0);
    expect((await api().delete(`/api/admin/users/${admin.user._id}`).set(auth(admin.token))).status).toBe(400);
  });
});

describe('Misc', () => {
  test('health check and unknown API route', async () => {
    expect((await api().get('/api/health')).body.status).toBe('ok');
    expect((await api().get('/api/nope')).status).toBe(404);
  });
  test('malformed JSON returns 400', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
  });
});
