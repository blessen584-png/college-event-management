require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const app = require('./app');
const connectDB = require('./config/db');
const User = require('./models/User');

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/college_events';

async function ensureAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  const email = ADMIN_EMAIL.toLowerCase();
  const existing = await User.findOne({ email });
  if (!existing) {
    await User.create({ name: 'Administrator', email, password: ADMIN_PASSWORD, role: 'admin' });
    console.log(`Created admin account ${email}`);
  } else if (existing.role !== 'admin') {
    existing.role = 'admin';
    await existing.save();
  }
}

(async () => {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('JWT_SECRET must be set in production.');
    process.exit(1);
  }
  try {
    await connectDB(MONGODB_URI);
    console.log('MongoDB connected');
    if (process.env.SEED_DEMO_DATA === 'true' && (await User.countDocuments()) === 0) {
      await require('./seed').seed({ reset: false });
    }
    await ensureAdmin();
    app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
})();
