import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
  playerId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  username: {
    type: String,
    unique: true,
    sparse: true
  },
  passwordHash: {
    type: String
  },
  fuel: {
    type: Number,
    default: 100
  },
  credits: {
    type: Number,
    default: 10000
  },
  x: {
    type: Number,
    default: 0
  },
  y: {
    type: Number,
    default: 0
  },
  rot: {
    type: Number,
    default: 0
  },
  ownedPlanets: [
    {
      type: String
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

export const Player = mongoose.model("Player", playerSchema);
