import { Vector3 } from 'three';
import { world } from '../ecs';
import { Genome, Entity, AgentData } from '../types';
import { MAX_SPEED_BASE, WORLD_SIZE, FIRST_NAMES, LAST_NAMES } from '../constants';

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

export const generateName = (p1?: AgentData, p2?: AgentData): { first: string, last: string } => {
    if (p1 && p2) {
        // Mating name generation
        // Combine first names
        const f1 = p1.name.first;
        const f2 = p2.name.first;
        
        // Take first half of one and second half of other
        const part1 = f1.substring(0, Math.ceil(f1.length / 2));
        const part2 = f2.substring(Math.ceil(f2.length / 2));
        let newFirst = part1 + part2;
        // Capitalize
        newFirst = newFirst.charAt(0).toUpperCase() + newFirst.slice(1).toLowerCase();

        // Last name from dominant (higher energy)
        const newLast = p1.energy > p2.energy ? p1.name.last : p2.name.last;
        
        return { first: newFirst, last: newLast };
    } else {
        // Random name
        const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
        const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        return { first, last };
    }
};

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

export const spawnAgent = (pos?: Vector3, genes?: Genome, parentEnergy?: number, name?: {first: string, last: string}): Entity => {
    // Spawn agents slightly away from edges initially
    const limit = (WORLD_SIZE / 2) - 5;
    const position = pos ? pos.clone() : new Vector3(rand(-limit, limit), 0, rand(-limit, limit));
    
    const velocity = new Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(MAX_SPEED_BASE);
    const genome = genes || createRandomGenome();
    const agentName = name || generateName();
    
    return world.add({
        id: nextAgentId++,
        position,
        velocity,
        agent: {
            name: agentName,
            genes: genome,
            energy: parentEnergy || 100,
            age: 0,
            state: 'wandering',
            target: null,
            trail: [],
            lastMated: 0
        }
    });
};