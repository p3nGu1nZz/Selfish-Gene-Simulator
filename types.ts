import { Vector3 } from 'three';

export type ViewMode = 'selfishness' | 'speed' | 'size' | 'mutation';

export interface Genome {
  // 0 to 1. 1 = Highly aggressive/selfish, 0 = Altruistic/Cooperative
  selfishness: number;
  // 0.5 to 3.0. Speed multiplier. Higher costs more energy.
  speed: number;
  // 0.5 to 2.0. Physical size. Larger wins fights but costs more energy.
  size: number;
  // 0 to 1. Mutation rate for offspring.
  mutationRate: number;
  // Visual hue (0-360) often linked to selfishness for visualization
  hue: number;
}

export interface Agent {
  id: number;
  position: Vector3;
  velocity: Vector3;
  target: Vector3 | null;
  genes: Genome;
  energy: number;
  age: number;
  state: 'wandering' | 'seeking_food' | 'fleeing' | 'chasing';
  trail: Vector3[];
}

export interface Food {
  id: number;
  position: Vector3;
  value: number;
}

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