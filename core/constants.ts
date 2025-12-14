import { SimulationParams } from './types';

export const WORLD_SIZE = 1024;
export const MAX_POPULATION = 600; 
export const MAX_TRAIL_POINTS = 10;
export const MIN_BURROW_SPACING = 32; // Rabbits ensure this distance between holes

// Assets & Configuration
// using static assets from GitHub
export const RABBIT_MODEL_PATH = 'https://raw.githubusercontent.com/p3nGu1nZz/Selfish-Gene-Simulator/main/assets/rabbit/rabbit_model.gltf';
export const CARROT_MODEL_PATH = 'https://raw.githubusercontent.com/p3nGu1nZz/Selfish-Gene-Simulator/main/assets/carrot/scene.gltf'; 
export const ENABLE_EXTERNAL_MODELS = true; 

// Physics & Animation
export const REAL_SECONDS_PER_GAME_DAY = 120;
export const HOP_DURATION = 0.3; 
export const ENERGY_REGEN_RATE = 10; 
export const DIG_COST = 0.5;
export const DIG_THRESHOLD = 8.0; 
export const FEAR_DECAY = 5; 

export const MATURITY_DAYS = 0.8; // Minimum age in game-days to breed

// Reproduction Stats (Based on Rabbit Biology scaled for game)
export const MIN_LITTER_SIZE = 1;
export const MAX_LITTER_SIZE = 10;
export const BASE_MATING_COOLDOWN = 20; // Seconds

// Particle Tuning
export const HEART_SIZE_MULT = 1.8;
export const HEART_LIFETIME = 0.9;
export const HEART_BURST_COUNT = 10;

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

// Physics Base Values
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