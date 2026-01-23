// ===== Simulation timing =====
export const TICK_RATE = 60;          // server ticks per second
export const DT = 1 / TICK_RATE;      // fixed timestep

// ===== Ship physics =====
export const ROT_SPEED = 12.0;         // rad/sec (fast turning)
export const THRUST = 6.0;             // units/sec² (slow accel)
export const BRAKE = 14.0;             // braking force
export const MAX_SPEED = 12.0;         // velocity cap
export const SHIP_RADIUS = 10;

// ===== Fuel system =====
export const MAX_FUEL = 100;
export const FUEL_THRUST_COST = 0.2;   // per second
export const FUEL_ROTATE_COST = 0.1;   // per second

// ===== World =====
export const CELL_SIZE = 500;
