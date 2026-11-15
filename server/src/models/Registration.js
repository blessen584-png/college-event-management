const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// A person can register for an event only once.
registrationSchema.index({ event: 1, user: 1 }, { unique: true });
registrationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Registration', registrationSchema);
