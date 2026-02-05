import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcryptjs";
import { Player } from "./models/Player.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

// Simple CORS for development
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

function makeId() {
  return Math.random().toString(36).slice(2);
}

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing username or password" });

  const existing = await Player.findOne({ username });
  if (existing) return res.status(409).json({ error: "Username taken" });

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);
  const playerId = makeId();

  const user = await Player.create({ playerId, username, passwordHash: hash });
  return res.json({ playerId: user.playerId, username: user.username });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing username or password" });

  const user = await Player.findOne({ username });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = bcrypt.compareSync(password, user.passwordHash || "");
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  return res.json({ playerId: user.playerId, username: user.username });
});

export function startAuthServer(port = process.env.AUTH_PORT || 3000) {
  app.listen(port, () => console.log(`Auth server listening on http://localhost:${port}`));
}

export default app;
