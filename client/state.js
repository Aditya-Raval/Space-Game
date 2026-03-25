import { MAX_FUEL } from "./shared/constants.js";

export const state = {
  myId: null,
  players: [],
  planets: [],
  missiles: [],
  myName: null,
  myCredits: 0,
  landingPrompt: null,
  ownedPlanets: [],
  missilePreview: false,
  showControls: false,
  myFuel: MAX_FUEL,
  socket: null,
  gamepadConnected: false,
  lastGamepadState: {
    leftStickX: 0,
    leftTrigger: 0,
    rightTrigger: 0,
    xButton: false,
    yButton: false,
    bButton: false,
    aButton: false,
    startButton: false
  }
};

export const input = {
  thrust: false,
  rotate: 0,
  missile: false,
  brake: false,
};

export const planetImageNames = {
  p1: 'sphereplanet.png',      // Terra
  p2: 'dryvenuslikeplanet.png', // Mars
  p3: 'neptunlikeplanet.png',   // Jupiter
  p4: 'dryvenuslikeplanet.png', // Venus
  p5: 'dryhotplanet.png',       // Mercury
  p6: 'iceplanet.png',          // Saturn
  p7: 'iceplanet_2.png',        // Uranus
  p8: 'neptunlikeplanet.png',   // Neptune
  p9: 'iceplanet.png',          // Pluto
  p10: 'moon.png',              // Ceres
  p11: 'shattered_planet.png',  // Eris
  p12: 'iceplanet_2.png',       // Haumea
  p13: 'neptunlikeplanet.png',  // Makemake
  p14: 'moon.png',              // Titan
  p15: 'iceplanet.png',         // Europa
  p16: 'moon.png',              // Ganymede
  p17: 'lava_planet.png',       // Callisto
  p18: 'lava_planet.png',       // Io
  p19: 'iceplanet_2.png',       // Triton
  p20: 'moon.png',              // Charon
  p21: 'machine_world.png',     // Oberon
  p22: 'exoplanet.png',         // Rhea
  p23: 'shattered_planet.png',  // Iapetus
  p24: 'exoplanet.png',         // Dione
  p25: 'sun.png',               // Tethys
  p26: 'iceplanet.png',         // Enceladus
  p27: 'shattered_planet.png',  // Mimas
  p28: 'machine_world.png',     // Hyperion
};

export const planetImages = {};

export const stars = [];
export const numStars = 200;
export const parallaxLayers = [
  { factor: 0.1, count: Math.floor(numStars * 0.4), color: '#aaa', size: 1 },
  { factor: 0.5, count: Math.floor(numStars * 0.4), color: '#ddd', size: 1.5 },
  { factor: 1.0, count: numStars - Math.floor(numStars * 0.8), color: '#fff', size: 2 }
];

export const chatProfanity = [];
