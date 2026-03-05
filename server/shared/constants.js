// ===== Simulation timing =====
export const TICK_RATE = 60;          // server ticks per second
export const DT = 1 / TICK_RATE;      // fixed timestep

// ===== Ship physics =====
export const ROT_SPEED = 8.0;         // rad/sec (fast turning)
export const THRUST = 6.0;             // units/sec² (slow accel)
export const BRAKE = 14.0;             // braking force
export const MAX_SPEED = 25.0;         // velocity cap
export const SHIP_RADIUS = 10;

// ===== Fuel system =====
export const MAX_FUEL = 100;
export const FUEL_THRUST_COST = 0.2;   // per second
export const FUEL_ROTATE_COST = 0.1;   // per second

// ===== World =====
export const CELL_SIZE = 500;

// ===== Economy constants =====
export const PLANET_CLAIM_COST = 500;
export const BASE_RENT_COST = 50;
export const RENT_PERCENTAGE = 0.05; // 5% of landing player's credits
export const REFUEL_COST_PER_TANK = 25;
export const FREE_REFUEL_AMOUNT = 20;
export const PAID_REFUEL_AMOUNT = 20;
