import { SimulationParams } from './types';

export const WORLD_SIZE = 200;
export const MAX_POPULATION = 600;

export const DEFAULT_PARAMS: SimulationParams = {
  initialPop: 40,
  foodSpawnRate: 2, // New food per tick (roughly)
  foodValue: 40,
  mutationMagnitude: 0.1,
  energyCostPerTick: 0.1,
  reproductionThreshold: 120, // Energy needed to reproduce
  maxAge: 2000,
  simulationSpeed: 1.0,
};

// Colors
export const COLOR_ALTRUISTIC = '#4ade80'; // Green-ish
export const COLOR_SELFISH = '#f87171'; // Red-ish
export const COLOR_NEUTRAL = '#60a5fa'; // Blue-ish

// Physics
export const AGENT_RADIUS_BASE = 0.5;
export const MAX_SPEED_BASE = 0.2;
export const SENSOR_RADIUS = 15;