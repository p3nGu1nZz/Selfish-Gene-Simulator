import { Vector3, Color } from 'three';

export type ViewMode = 'selfishness' | 'speed' | 'size' | 'mutation' | 'affinity';

export interface Genome {
  selfishness: number;
  speed: number;
  size: number;
  mutationRate: number;
  hue: number;
}

// Component Data Interfaces
export interface AgentData {
  name: { first: string; last: string };
  genes: Genome;
  energy: number;
  age: number;
  state: 'wandering' | 'seeking_food' | 'fleeing' | 'chasing' | 'mating' | 'resting' | 'digging' | 'circling' | 'sleeping';
  target: Vector3 | null;
  trail: Vector3[];
  lastMated: number; 
  heading: Vector3;
  hopTimer: number;
  
  // New Social & behavioral props
  fear: number; // 0 to 100
  affinity: Record<number, number>; // Map of AgentID -> affinity score (-100 to 100)
  ownedBurrowId: number | null;
  currentBurrowId: number | null; // If inside a burrow
  digTimer: number; // Progress for digging
}

export interface FoodData {
  value: number;
}

export interface BurrowData {
  ownerId: number;
  occupants: number[];
  radius: number;
}

export interface ParticleData {
  type: 'particle' | 'heart' | 'dirt' | 'zzz';
  life: number;
  maxLife: number;
  color: Color;
  scale: number;
  rotation?: number; 
}

// The Main ECS Entity Type
export type Entity = {
  id: number;
  position: Vector3; 
  velocity?: Vector3; 
  
  // Components 
  agent?: AgentData;
  food?: FoodData;
  particle?: ParticleData;
  burrow?: BurrowData;
  
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