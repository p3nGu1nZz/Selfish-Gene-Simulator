import { Vector3, Color } from 'three';

export type ViewMode = 'selfishness' | 'speed' | 'size' | 'mutation';

export interface Genome {
  selfishness: number;
  speed: number;
  size: number;
  mutationRate: number;
  hue: number;
}

// Component Data Interfaces
export interface AgentData {
  genes: Genome;
  energy: number;
  age: number;
  state: 'wandering' | 'seeking_food' | 'fleeing' | 'chasing';
  target: Vector3 | null;
  trail: Vector3[];
}

export interface FoodData {
  value: number;
}

export interface ParticleData {
  life: number;
  maxLife: number;
  color: Color;
  scale: number;
}

// The Main ECS Entity Type
export type Entity = {
  id: number;
  position: Vector3; // All physical entities have a position
  velocity?: Vector3; // Agents and Particles have velocity
  
  // Components (Optional based on entity type)
  agent?: AgentData;
  food?: FoodData;
  particle?: ParticleData;
  
  // Transient/System flags
  deleted?: boolean;
};

export interface SimulationParams {
  initialPop: number;
  foodSpawnRate: number;
  foodValue: number;
  mutationMagnitude: number;
  energyCostPerTick: number;
  reproductionThreshold: number;
  maxAge: number;
  simulationSpeed: number;
}