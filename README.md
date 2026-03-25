# Space Game

## Overview

A browser-based multiplayer space game. Each player controls a ship, manages fuel and credits, claims planets, pays rent on foreign planets, and uses missiles in combat.

The project includes:
- WebSocket server (Node.js + ws)
- REST authentication server (Express, MongoDB)
- Canvas-based client rendering
- Physics (thrust, rotation, gravity, collision, landing)
- Economy (claim planets, rent, refuel, missile costs)
- Chat with profanity filtering

## Folder structure

- `client/` - front-end code
  - `client.js` - entrypoint
  - `state.js`, `auth.js`, `network.js`, `chat.js`, `input.js`, `gamepad.js`, `landing.js`, `render.js`
  - `index.html`, assets
- `server/` - back-end code
  - `server.js` - entrypoint
  - `connection.js`, `worldLoop.js`, `physics.js`, `messageHandlers.js`, `gameState.js`, `dbInit.js`
  - `auth.js`, `db/`, `models/`
- `shared/` - constants and message types used by both sides

## Setup

1. Install dependencies in root and subfolders if needed (optionally monorepo style):

```bash
cd client
npm install
cd ../server
npm install
```

2. Set up MongoDB. Use `.env` (example in project) with `MONGO_URI`.

3. Start back end:

```bash
cd server
node server.js
```

4. Start client (serve static files):

```bash
cd client
npx http-server .  # or any static web server
```

5. Open browser at `http://localhost:8080` (or your server port) and log in.

## Development workflow

- Make code change
- Restart server (`node server.js`)
- Refresh browser client

## Notes

- Client and server now are modular and separated by concerns.
- Entry points are minimal; core logic resides in modules that are easy to reason about.
- No external build step is required if `type=module` is supported by your environment.

## Quick commands

Run server:
```bash
cd server
node server.js
```

Run client via static host:
```bash
cd client
npx http-server .
```

