import mongoose from "mongoose";

const planetSchema = new mongoose.Schema({
  planetId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  x: {
    type: Number,
    required: true
  },
  y: {
    type: Number,
    required: true
  },
  r: {
    type: Number,
    required: true
  },
  owner: {
    type: String,
    default: null
  },
  controlFactors: {
    militaryStrength: {
      type: Number,
      default: 0
    },
    population: {
      type: Number,
      default: 0
    },
    resources: {
      type: Number,
      default: 0
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const Planet = mongoose.model("Planet", planetSchema);
