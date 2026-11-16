// Vercel serverless entry point — wraps the Express app.
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
const connectDB = require('../server/src/config/db');
const app = require('../server/src/app');
const User = require('../server/src/models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/college_events';

let cold = true;

async function ensureAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  const email = ADMIN_EMAIL.toLowerCase();
  const existing = await User.findOne({ email });
  if (!existing) {
    await User.create({ name: 'Administrator', email, password: ADMIN_PASSWORD, role: 'admin' });
  } else if (existing.role !== 'admin') {
    existing.role = 'admin';
    await existing.save();
  }
}

module.exports = async (req, res) => {
  // Connect once per cold start
  if (cold) {
    cold = false;
    try {
      await connectDB(MONGODB_URI);
      if (process.env.SEED_DEMO_DATA === 'true' && (await User.countDocuments()) === 0) {
        await require('../server/src/seed').seed({ reset: false });
      }
      await ensureAdmin();
    } catch (err) {
      console.error('DB connection failed:', err.message);
      cold = true; // retry next request
      return res.status(500).json({ message: 'Database connection failed' });
    }
  }
  return app(req, res);
};
