import { Vector3, MathUtils } from 'three';
import { world } from '../core/ecs';
import { Genome, Entity, AgentData } from '../core/types';
import { MAX_SPEED_BASE, WORLD_SIZE, FIRST_NAMES, LAST_NAMES } from '../core/constants';

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
  hue: Math.random(), // Random base hue [0, 1]
});

export const generateName = (p1?: AgentData, p2?: AgentData): { first: string, last: string } => {
    if (p1 && p2) {
        // Mating name generation
        const f1 = p1.name.first;
        const f2 = p2.name.first;
        const part1 = f1.substring(0, Math.ceil(f1.length / 2));
        const part2 = f2.substring(Math.ceil(f2.length / 2));
        let newFirst = part1 + part2;
        newFirst = newFirst.charAt(0).toUpperCase() + newFirst.slice(1).toLowerCase();
        const newLast = p1.energy > p2.energy ? p1.name.last : p2.name.last;
        return { first: newFirst, last: newLast };
    } else {
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
    hue: clamp(mutate(parent.hue), 0, 1),
  };
};

// New: Mixes two genomes with HSV color inheritance logic
export const mixGenomes = (g1: Genome, g2: Genome): Genome => {
    const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
    
    // Average numerical traits
    const baseSize = (g1.size + g2.size) / 2;
    const baseSpeed = (g1.speed + g2.speed) / 2;
    const baseSelfish = (g1.selfishness + g2.selfishness) / 2;
    const baseMut = (g1.mutationRate + g2.mutationRate) / 2;

    // HSV Color Inheritance
    // We average the hue. Note: Circular average (shortest path) is better but simple average is fine for this scope.
    // Add ±5% variance to Hue
    const hueVariance = (Math.random() - 0.5) * 0.10; 
    let newHue = ((g1.hue + g2.hue) / 2) + hueVariance;
    if (newHue < 0) newHue += 1;
    if (newHue > 1) newHue -= 1;

    return {
        size: clamp(baseSize + (Math.random() - 0.5) * 0.1, 0.5, 2.0),
        speed: clamp(baseSpeed + (Math.random() - 0.5) * 0.1, 0.5, 3.0),
        selfishness: clamp(baseSelfish + (Math.random() - 0.5) * 0.1, 0, 1),
        mutationRate: clamp(baseMut + (Math.random() - 0.5) * 0.01, 0.01, 0.2),
        hue: newHue
    };
};

export const spawnAgent = (pos?: Vector3, genes?: Genome, parentEnergy?: number, name?: {first: string, last: string}): Entity => {
    const limit = (WORLD_SIZE / 2) - 5;
    const position = pos ? pos.clone() : new Vector3(rand(-limit, limit), 0, rand(-limit, limit));
    
    const initialVel = new Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(MAX_SPEED_BASE);
    const genome = genes || createRandomGenome();
    const agentName = name || generateName();
    
    return world.add({
        id: nextAgentId++,
        position,
        velocity: new Vector3(0,0,0), 
        agent: {
            name: agentName,
            genes: genome,
            energy: parentEnergy || 100,
            age: 0,
            state: 'wandering',
            target: null,
            trail: [],
            lastMated: 0,
            heading: initialVel.clone().normalize(),
            hopTimer: Math.random(),
            
            // New Props
            fear: 0,
            affinity: {},
            ownedBurrowId: null,
            currentBurrowId: null,
            digTimer: 0
        }
    });
};