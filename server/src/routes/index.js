const router = require('express').Router();
const auth = require('../controllers/authController');
const events = require('../controllers/eventController');
const regs = require('../controllers/registrationController');
const dash = require('../controllers/dashboardController');
const admin = require('../controllers/adminController');
const { protect, optionalAuth, requireRole } = require('../middleware/auth');

router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Auth
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.get('/auth/me', protect, auth.me);
router.put('/auth/me', protect, auth.updateMe);

// Events
router.get('/events/categories', events.categories);
router.get('/events/mine', protect, requireRole('organizer', 'admin'), events.mine);
router.get('/events', optionalAuth, events.list);
router.post('/events', protect, requireRole('organizer', 'admin'), events.create);
router.get('/events/:id', optionalAuth, events.get);
router.put('/events/:id', protect, requireRole('organizer', 'admin'), events.update);
router.delete('/events/:id', protect, requireRole('organizer', 'admin'), events.remove);
router.post('/events/:id/register', protect, events.register);
router.delete('/events/:id/register', protect, events.unregister);
router.get('/events/:id/attendees', protect, requireRole('organizer', 'admin'), events.attendees);
router.get('/events/:id/attendees.csv', protect, requireRole('organizer', 'admin'), events.attendeesCsv);

// Registrations & dashboard
router.get('/registrations/mine', protect, regs.mine);
router.get('/dashboard', protect, dash.get);

// Admin
router.get('/admin/users', protect, requireRole('admin'), admin.listUsers);
router.patch('/admin/users/:id/role', protect, requireRole('admin'), admin.updateRole);
router.delete('/admin/users/:id', protect, requireRole('admin'), admin.deleteUser);

module.exports = router;
