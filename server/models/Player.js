import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
  playerId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  fuel: {
    type: Number,
    default: 100
  },
  credits: {
    type: Number,
    default: 0
  },
  planetOwnership: [
    {
      planetId: String,
      owned: {
        type: Boolean,
        default: false
      }
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
