import mongoose from 'mongoose';

const ArtistSchema = new mongoose.Schema({
  displayName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  bio: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
  tipJarMessage: { type: String, default: '' },
  stripeAccountId: { type: String, default: '' },
  socialLinks: { type: Array, default: [] },
  portfolio: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now },
});

const EventSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['live', 'fundraiser'], required: true },
  status: { type: String, enum: ['active', 'ended'], default: 'active' },
  targetAmount: { type: Number, default: 0 },
  currentAmount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const TipSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  amount: { type: Number, required: true },
  fanName: { type: String, required: true },
  message: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
});

export const ArtistModel = mongoose.model('Artist', ArtistSchema);
export const EventModel = mongoose.model('Event', EventSchema);
export const TipModel = mongoose.model('Tip', TipSchema);
