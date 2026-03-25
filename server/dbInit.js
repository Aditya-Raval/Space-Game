import { connectDB } from './db/connection.js';
import { Planet } from './models/Planet.js';
import { planets } from './gameState.js';

export async function initializeGame() {
  await connectDB();

  for (const planet of planets) {
    const existingPlanet = await Planet.findOne({ planetId: planet.id });
    if (!existingPlanet) {
      await Planet.create({
        planetId: planet.id,
        name: planet.name,
        x: planet.x,
        y: planet.y,
        r: planet.r
      });
    } else {
      planet.owner = existingPlanet.owner || null;
      planet.ownerUsername = existingPlanet.ownerUsername || null;
    }
  }

  console.log('Game initialized');
}
