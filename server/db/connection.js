import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/spacegame";

export async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    console.log("✓ MongoDB connected");
  } catch (error) {
    console.error("✗ MongoDB connection failed:", error.message);
    console.error("Make sure MongoDB is running or set MONGO_URI in .env file");
    process.exit(1);
  }
}

export default mongoose;
