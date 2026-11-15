const mongoose = require('mongoose');

const CATEGORIES = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar', 'Club', 'Placement', 'Other'];
const STATUSES = ['published', 'cancelled'];

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    category: { type: String, enum: CATEGORIES, required: true },
    venue: { type: String, required: true, trim: true, maxlength: 120 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    capacity: { type: Number, required: true, min: 1, max: 100000 },
    registeredCount: { type: Number, default: 0, min: 0 },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: STATUSES, default: 'published' },
  },
  { timestamps: true }
);

eventSchema.index({ startsAt: 1 });
eventSchema.index({ category: 1, startsAt: 1 });
eventSchema.index({ organizer: 1 });

eventSchema.virtual('seatsLeft').get(function () {
  return Math.max(0, this.capacity - this.registeredCount);
});
eventSchema.set('toJSON', { virtuals: true, versionKey: false, transform: (_d, r) => { delete r.id; return r; } });

module.exports = mongoose.model('Event', eventSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.STATUSES = STATUSES;
