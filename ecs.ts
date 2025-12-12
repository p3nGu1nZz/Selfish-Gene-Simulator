import { World } from 'miniplex';
import { Entity } from './types';

// Create the global world
export const world = new World<Entity>();

// Create buckets (archetypes) for fast querying
export const agents = world.with('position', 'velocity', 'agent');
export const food = world.with('position', 'food');
export const particles = world.with('position', 'velocity', 'particle');

// Helper to clear world
export const clearWorld = () => {
  for (const entity of world.entities) {
    world.remove(entity);
  }
};
