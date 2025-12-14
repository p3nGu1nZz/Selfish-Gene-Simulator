import { Vector3, Color } from 'three';
import React from 'react';

export type ViewMode = 'selfishness' | 'speed' | 'size' | 'mutation' | 'affinity' | 'energy' | 'fertility';

export interface Genome {
  selfishness: number;
  speed: number;
  size: number;
  mutationRate: number;
  hue: number;
  energy: number;    // 0.0 - 1.0: Affects Metabolism (Hunger Decay)
  fertility: number; // 0.0 - 1.0: Affects Litter Size and Cooldown
}

export interface ThoughtBubbleData {
  type: 'heart' | 'angry' | 'zzz';
  timer: number;
  maxTime: number;
}

// Component Data Interfaces
export interface AgentData {
  name: { first: string; last: string };
  genes: Genome;
  energy: number; // Stamina (0-100)
  hunger: number; // Satiety (0-100), 0 = Starving
  age: number;
  state: 'wandering' | 'exploring' | 'seeking_food' | 'fleeing' | 'chasing' | 'mating' | 'resting' | 'digging' | 'circling' | 'sleeping' | 'snuggling';
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
  actionTimer: number; // Tracks duration of current state/action
  
  thoughtBubble: ThoughtBubbleData | null;
}

export interface FoodData {
  value: number;
}

export interface BurrowData {
  ownerId: number;
  occupants: number[];
  radius: number;
  digProgress: number; // 0.0 to 1.0, used for spawn animation
}

export interface ParticleData {
  type: 'particle' | 'dirt' | 'birth' | 'death';
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
  energyCostPerTick: number; // Metabolic cost
  reproductionThreshold: number;
  maxAge: number;
  simulationSpeed: number;
  timeOfDay: number; // 0.0 to 24.0
}

// Global Augmentation to ensure R3F elements are recognized
declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      group: any;
      instancedMesh: any;
      primitive: any;
      ambientLight: any;
      directionalLight: any;
      pointLight: any;
      spotLight: any;
      fog: any;
      color: any;
      
      // Geometries
      boxGeometry: any;
      sphereGeometry: any;
      planeGeometry: any;
      cylinderGeometry: any;
      capsuleGeometry: any;
      circleGeometry: any;
      ringGeometry: any;
      torusGeometry: any;
      shapeGeometry: any;
      bufferGeometry: any;
      
      // Materials
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      pointsMaterial: any;
      shaderMaterial: any;
      lineBasicMaterial: any;
      
      // Helpers
      gridHelper: any;
      axesHelper: any;
      
      // Others
      points: any;
      lineSegments: any;
      bufferAttribute: any;

      // Catch-all
      [elemName: string]: any;
    }
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      group: any;
      instancedMesh: any;
      primitive: any;
      ambientLight: any;
      directionalLight: any;
      pointLight: any;
      spotLight: any;
      fog: any;
      color: any;
      
      // Geometries
      boxGeometry: any;
      sphereGeometry: any;
      planeGeometry: any;
      cylinderGeometry: any;
      capsuleGeometry: any;
      circleGeometry: any;
      ringGeometry: any;
      torusGeometry: any;
      shapeGeometry: any;
      bufferGeometry: any;
      
      // Materials
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      pointsMaterial: any;
      shaderMaterial: any;
      lineBasicMaterial: any;
      
      // Helpers
      gridHelper: any;
      axesHelper: any;
      
      // Others
      points: any;
      lineSegments: any;
      bufferAttribute: any;

      // Catch-all
      [elemName: string]: any;
    }
  }
}