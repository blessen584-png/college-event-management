require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Event = require('./models/Event');
const Registration = require('./models/Registration');

const DAY = 24 * 3600 * 1000;
const at = (days, hour, minutes = 0) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, minutes, 0, 0);
  return d;
};

async function seed({ reset = true } = {}) {
  if (reset) await Promise.all([User.deleteMany({}), Event.deleteMany({}), Registration.deleteMany({})]);

  const mk = (name, email, password, role, department) => User.create({ name, email, password, role, department });
  const admin = await mk('Dr. Meera Nair', 'admin@college.edu', 'Admin@123', 'admin', 'Administration');
  const org1 = await mk('Arjun Rao', 'organizer@college.edu', 'Organizer@123', 'organizer', 'Computer Science');
  const org2 = await mk('Kavya Menon', 'kavya@college.edu', 'Organizer@123', 'organizer', 'Cultural Committee');
  const students = await Promise.all([
    mk('Riya Sharma', 'student@college.edu', 'Student@123', 'student', 'MCA'),
    mk('Sahil Khan', 'sahil@college.edu', 'Student@123', 'student', 'MBA'),
    mk('Anika Das', 'anika@college.edu', 'Student@123', 'student', 'MCA'),
    mk('Vikram Iyer', 'vikram@college.edu', 'Student@123', 'student', 'B.Tech CSE'),
    mk('Neha Pillai', 'neha@college.edu', 'Student@123', 'student', 'B.Tech ECE'),
  ]);

  const e = (organizer, title, category, venue, start, hours, capacity, description) => ({
    organizer: organizer._id, title, category, venue, capacity, description,
    startsAt: start, endsAt: new Date(start.getTime() + hours * 3600 * 1000),
  });

  const events = await Event.insertMany([
    e(org1, 'HackSprint 24-hour Hackathon', 'Technical', 'Innovation Lab, Block C', at(6, 9), 24, 60, 'Form teams of up to four and build a working prototype in 24 hours. Mentors from industry will review demos on Sunday morning. Bring your laptop, charger and an idea.'),
    e(org1, 'Intro to Docker and CI/CD', 'Workshop', 'Seminar Hall 2', at(3, 14), 3, 40, 'A hands-on session: containerise a small Node app, then wire up a GitHub Actions pipeline. No prior DevOps experience needed.'),
    e(org1, 'Placement Prep: Aptitude and Reasoning', 'Placement', 'Auditorium', at(9, 10), 4, 150, 'Timed practice sets, shortcut techniques and a mock test with instant scoring. Open to final-year students.'),
    e(org2, 'Annual Cultural Fest: Rangotsav', 'Cultural', 'Main Quadrangle', at(15, 16), 6, 500, 'Dance, music, drama and food stalls. Register your department team for the competition rounds or just come to watch.'),
    e(org2, 'Open Mic Night', 'Cultural', 'Amphitheatre', at(2, 18), 3, 80, 'Poetry, stand-up, original songs. Sign up for a five-minute slot or cheer from the stands.'),
    e(org1, 'Inter-department Cricket Cup', 'Sports', 'College Ground', at(11, 8), 8, 120, 'Knockout format, 12 overs a side. Teams of eleven plus two substitutes; captains register the full squad.'),
    e(org1, 'Guest Lecture: Responsible AI', 'Seminar', 'Seminar Hall 1', at(5, 11), 2, 30, 'A practitioner talks about bias testing, model documentation and what regulators expect from AI products.'),
    e(org2, 'Photography Club Photo Walk', 'Club', 'Campus and lake trail', at(4, 7, 30), 3, 25, 'Golden-hour walk around campus with short composition tips. Phones welcome, no camera needed.'),
    e(org1, 'Resume and LinkedIn Clinic', 'Placement', 'Placement Cell', at(1, 15), 2, 20, 'Bring a printed resume. Alumni volunteers give one-on-one feedback in 15-minute slots.'),
    e(org1, 'Git and GitHub Bootcamp', 'Workshop', 'Computer Lab 3', at(-8, 10), 4, 50, 'Branching, pull requests and resolving merge conflicts with a practice repo.'),
    e(org2, 'Freshers Welcome Night', 'Cultural', 'Auditorium', at(-20, 17), 4, 300, 'Music, games and a welcome address for the new batch.'),
    e(org1, 'Quiz League Finals', 'Club', 'Seminar Hall 2', at(-3, 15), 3, 60, 'The top six teams from the league rounds compete across tech, general knowledge and a rapid-fire round.'),
  ]);

  // Registrations (kept consistent with registeredCount); make the guest lecture almost full.
  const regs = [];
  const add = (ev, users) => users.forEach((u) => regs.push({ event: ev._id, user: u._id }));
  add(events[0], students);
  add(events[1], students.slice(0, 3));
  add(events[3], students.slice(1, 4));
  add(events[4], students.slice(0, 2));
  add(events[9], students.slice(0, 4));
  add(events[10], students);
  add(events[11], students.slice(2));
  const extra = Array.from({ length: 28 }, (_, i) => ({ name: `Guest ${i + 1}`, email: `guest${i + 1}@college.edu`, password: 'Student@123', role: 'student' }));
  const filler = await User.create(extra);
  add(events[6], filler);
  await Registration.insertMany(regs);
  const counts = {};
  regs.forEach((r) => { counts[r.event] = (counts[r.event] || 0) + 1; });
  await Event.bulkWrite(Object.entries(counts).map(([id, n]) => ({ updateOne: { filter: { _id: id }, update: { $set: { registeredCount: n } } } })));

  console.log('Seeded demo data.');
  console.log('  admin      admin@college.edu      / Admin@123');
  console.log('  organizer  organizer@college.edu  / Organizer@123');
  console.log('  student    student@college.edu    / Student@123');
  return { admin };
}

module.exports = { seed };

if (require.main === module) {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/college_events';
  connectDB(uri)
    .then(() => seed({ reset: true }))
    .then(() => mongoose.disconnect())
    .catch((err) => { console.error(err); process.exit(1); });
}
