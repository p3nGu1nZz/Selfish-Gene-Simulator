import { Vector3 } from 'three';
import { world } from '../ecs';
import { Genome, Entity } from '../types';
import { MAX_SPEED_BASE, WORLD_SIZE } from '../constants';

let nextAgentId = 0;

export const resetAgentId = () => {
    nextAgentId = 0;
};

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

export const createRandomGenome = (): Genome => ({
  selfishness: Math.random(),
  speed: rand(0.8, 1.5),
  size: rand(0.8, 1.2),
  mutationRate: rand(0.01, 0.1),
  hue: 0,
});

export const mutateGenome = (parent: Genome, magnitude: number): Genome => {
  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
  const mutate = (val: number) => val + (Math.random() - 0.5) * magnitude;
  return {
    selfishness: clamp(mutate(parent.selfishness), 0, 1),
    speed: clamp(mutate(parent.speed), 0.5, 3.0),
    size: clamp(mutate(parent.size), 0.5, 2.0),
    mutationRate: clamp(mutate(parent.mutationRate), 0.01, 0.2),
    hue: 0,
  };
};

export const spawnAgent = (pos?: Vector3, genes?: Genome, parentEnergy?: number): Entity => {
    // Spawn agents slightly away from edges initially
    const limit = (WORLD_SIZE / 2) - 5;
    const position = pos ? pos.clone() : new Vector3(rand(-limit, limit), 0, rand(-limit, limit));
    
    const velocity = new Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(MAX_SPEED_BASE);
    const genome = genes || createRandomGenome();
    
    return world.add({
        id: nextAgentId++,
        position,
        velocity,
        agent: {
            genes: genome,
            energy: parentEnergy || 100,
            age: 0,
            state: 'wandering',
            target: null,
            trail: []
        }
    });
};