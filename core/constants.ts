import { SimulationParams } from '../systems/types';

export const WORLD_SIZE = 200;
export const MAX_POPULATION = 1200; 
export const MAX_TRAIL_POINTS = 20;
export const MIN_BURROW_SPACING = 32; // Rabbits ensure this distance between holes

export const DEFAULT_PARAMS: SimulationParams = {
  initialPop: 40,
  foodSpawnRate: 4, 
  foodValue: 40,
  mutationMagnitude: 0.1,
  energyCostPerTick: 0.03, 
  reproductionThreshold: 50, 
  maxAge: 3000, 
  simulationSpeed: 1.0,
  timeOfDay: 8.0, // Start at 8 AM
};

// Colors
export const COLOR_ALTRUISTIC = '#4ade80'; // Green-ish
export const COLOR_SELFISH = '#f87171'; // Red-ish
export const COLOR_NEUTRAL = '#60a5fa'; // Blue-ish

// Physics
export const AGENT_RADIUS_BASE = 0.5;
export const MAX_SPEED_BASE = 0.2;
export const SENSOR_RADIUS = 15;

export const FIRST_NAMES = [
  "Aeon", "Brea", "Cion", "Dax", "Eos", "Fay", "Gia", "Hux", "Io", "Jax",
  "Koa", "Lux", "Mio", "Nyx", "Oxa", "Pax", "Qiu", "Rex", "Sky", "Tao",
  "Una", "Vex", "Wren", "Xen", "Yue", "Zed", "Aura", "Bliss", "Cosmo", "Dust"
];

export const LAST_NAMES = [
  "Prime", "Flux", "Nova", "Stark", "Vane", "Bloom", "Cross", "Drift", "Echo", "Frost",
  "Glow", "Haze", "Iris", "Jolt", "Kite", "Lume", "Mist", "Neon", "Orbit", "Pulse",
  "Quark", "Rift", "Spark", "Tide", "Unit", "Void", "Warp", "Xylon", "Yarn", "Zero"
];