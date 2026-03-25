export const planets = [
  { id: "p1", x: 100, y: 300, r: 120, name: "Terra" },
  { id: "p2", x: 800, y: -400, r: 80, name: "Mars" },
  { id: "p3", x: -1000, y: 600, r: 150, name: "Jupiter" },
  { id: "p4", x: 1200, y: 800, r: 90, name: "Venus" },
  { id: "p5", x: -600, y: -500, r: 70, name: "Mercury" },
  { id: "p6", x: 500, y: -1200, r: 110, name: "Saturn" },
  { id: "p7", x: -200, y: 1000, r: 65, name: "Uranus" },
  { id: "p8", x: 1500, y: 200, r: 95, name: "Neptune" },
  { id: "p9", x: -800, y: -800, r: 85, name: "Pluto" },
  { id: "p10", x: 2000, y: -300, r: 75, name: "Ceres" },
  { id: "p11", x: -1500, y: 400, r: 60, name: "Eris" },
  { id: "p12", x: 300, y: -1500, r: 95, name: "Haumea" },
  { id: "p13", x: -1200, y: -200, r: 110, name: "Makemake" },
  { id: "p14", x: 1800, y: 1000, r: 80, name: "Titan" },
  { id: "p15", x: -400, y: 1400, r: 70, name: "Europa" },
  { id: "p16", x: 900, y: 1400, r: 65, name: "Ganymede" },
  { id: "p17", x: -1800, y: -600, r: 90, name: "Callisto" },
  { id: "p18", x: 2200, y: 600, r: 85, name: "Io" },
  { id: "p19", x: -600, y: -1400, r: 75, name: "Triton" },
  { id: "p20", x: 1400, y: -800, r: 100, name: "Charon" },
  { id: "p21", x: -2200, y: 200, r: 55, name: "Oberon" },
  { id: "p22", x: 600, y: 1800, r: 80, name: "Rhea" },
  { id: "p23", x: -1000, y: -1200, r: 70, name: "Iapetus" },
  { id: "p24", x: 2500, y: -100, r: 95, name: "Dione" },
  { id: "p25", x: -1600, y: 1200, r: 60, name: "Tethys" },
  { id: "p26", x: 1200, y: 1600, r: 85, name: "Enceladus" },
  { id: "p27", x: -800, y: 1600, r: 75, name: "Mimas" },
  { id: "p28", x: 2800, y: 400, r: 90, name: "Hyperion" }
];

export const players = new Map();

export const missiles = [];

export function findPlanetById(id) {
  return planets.find(p => p.id === id);
}
