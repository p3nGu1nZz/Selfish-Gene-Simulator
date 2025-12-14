import { Vector3 } from 'three';
import { world, agents, food, burrows } from '../core/ecs';
import { Entity, SimulationParams } from '../core/types';
import { 
    WORLD_SIZE, MAX_POPULATION, AGENT_RADIUS_BASE, MAX_SPEED_BASE, SENSOR_RADIUS, 
    MAX_TRAIL_POINTS, MIN_BURROW_SPACING,
    HOP_DURATION, ENERGY_REGEN_RATE, DIG_COST, DIG_THRESHOLD, FEAR_DECAY,
    MATURITY_DAYS, REAL_SECONDS_PER_GAME_DAY
} from '../core/constants';
import { spawnParticle } from '../entities/Particle';
import { spawnAgent, mixGenomes, generateName } from '../entities/Agent';
import { spawnBurrow } from '../entities/Burrow';

const tempVec = new Vector3();
const tempVec2 = new Vector3();

// -- Spatial Hash --
class SpatialHash {
    cellSize: number;
    buckets: Map<string, Entity[]>;

    constructor(cellSize: number) {
        this.cellSize = cellSize;
        this.buckets = new Map();
    }
    clear() { this.buckets.clear(); }
    add(entity: Entity) {
        const key = `${Math.floor(entity.position.x / this.cellSize)},${Math.floor(entity.position.z / this.cellSize)}`;
        if (!this.buckets.has(key)) this.buckets.set(key, []);
        this.buckets.get(key)!.push(entity);
    }
    query(pos: Vector3, radius?: number): Entity[] {
        const r = radius || this.cellSize;
        const cx = Math.floor(pos.x / this.cellSize);
        const cz = Math.floor(pos.z / this.cellSize);
        const cells = Math.ceil(r / this.cellSize);
        const results: Entity[] = [];
        for (let i = -cells; i <= cells; i++) {
            for (let j = -cells; j <= cells; j++) {
                const bucket = this.buckets.get(`${cx + i},${cz + j}`);
                if (bucket) results.push(...bucket);
            }
        }
        return results;
    }
}

const agentHash = new SpatialHash(SENSOR_RADIUS);
const foodHash = new SpatialHash(SENSOR_RADIUS);
const burrowHash = new SpatialHash(MIN_BURROW_SPACING); 

// -- Audio Utils --
const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;
let noiseBuffer: AudioBuffer | null = null;

const createNoiseBuffer = () => {
    if (!audioCtx) return null;
    const bufferSize = audioCtx.sampleRate * 2.0; // 2 seconds of noise buffer
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
};

const playDigSound = () => {
    if (!audioCtx || audioCtx.state === 'suspended') audioCtx?.resume().catch(() => {});
    if (!audioCtx) return;
    
    if (!noiseBuffer) noiseBuffer = createNoiseBuffer();
    if (!noiseBuffer) return;

    // Create source from noise buffer
    const source = audioCtx.createBufferSource();
    source.buffer = noiseBuffer;
    // Vary playback rate to change pitch/texture slightly
    source.playbackRate.value = 0.5 + Math.random() * 0.5;

    // Filter to make it sound like dirt/low frequency
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300 + Math.random() * 200;

    // Envelope for short crunch
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;
    const duration = 0.08 + Math.random() * 0.05;
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Graph: Source -> Filter -> Gain -> Destination
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    source.start(now);
    source.stop(now + duration + 0.1);
};

// -- Behavior Subsystems --

const handleDigging = (entity: Entity, dt: number, nearestBurrowDist: number, nearestBurrow: Entity | null) => {
    const { agent, position, velocity } = entity;
    if (!agent) return;

    if (nearestBurrowDist < MIN_BURROW_SPACING) {
        agent.state = 'wandering';
        agent.digTimer = 0;
        if (nearestBurrow) {
            position.add(tempVec.subVectors(position, nearestBurrow.position).normalize().multiplyScalar(5));
        }
    } else {
        agent.digTimer += dt;
        agent.energy -= DIG_COST * dt;
        velocity!.set(0,0,0);
        
        // Spawn dirt particles more frequently when actively digging
        // And play sound
        if (Math.random() < dt * 25) { 
            spawnParticle(position, 'dirt', undefined, agent.genes.size);
            // Chance to play sound synchronized with particle bursts
            if (Math.random() < 0.25) playDigSound();
        }

        if (agent.digTimer > DIG_THRESHOLD) {
            const b = spawnBurrow(position, entity.id, agent.genes.size);
            agent.ownedBurrowId = b.id;
            agent.currentBurrowId = b.id; 
            agent.state = 'sleeping';
            agent.digTimer = 0;
            // Burst on completion
            for(let k=0; k<5; k++) spawnParticle(position, 'dirt'); 
            playDigSound(); // Final big dig sound
        } else if (agent.energy < 5) {
            agent.state = 'sleeping';
        }
    }
};

const handleInteraction = (entity: Entity, dt: number, nearestAgent: Entity | null, nearestAgentDist: number, params: SimulationParams, isNight: boolean) => {
    const { agent, position, velocity, id } = entity;
    if (!agent || !nearestAgent || !nearestAgent.agent) return;
    
    const other = nearestAgent;
    const otherAgent = other.agent!;
    const interactionRadius = (agent.genes.size + otherAgent.genes.size) * AGENT_RADIUS_BASE;
    
    if (nearestAgentDist < interactionRadius * 1.5) {
         const affinity = agent.affinity[other.id] || 0;
         const isFriend = affinity > 20; 
         const overlap = interactionRadius - nearestAgentDist;
         const normal = tempVec.subVectors(position, other.position).normalize();
         
         // Snuggling
         // Cast to string array for includes check
         if (isFriend && 
            (['wandering', 'resting', 'snuggling'] as string[]).includes(agent.state) && 
            (['wandering', 'resting', 'snuggling'] as string[]).includes(otherAgent.state) &&
            agent.energy > 40 && otherAgent.energy > 40 && !isNight) 
         {
             agent.state = 'snuggling';
             if (overlap > 0.1) position.add(normal.clone().multiplyScalar(0.01));
             velocity!.set(0,0,0);
             if (Math.random() < dt * 0.5) agent.state = 'wandering';
             if (Math.random() < dt * 0.5) spawnParticle(position.clone().lerp(other.position, 0.5), 'heart', undefined, agent.genes.size);
             return; 
         } 
         else if ((agent.state as string) === 'snuggling') agent.state = 'wandering';

         // Collision Push
         if (overlap > 0 && agent.state !== 'snuggling') {
             position.add(normal.clone().multiplyScalar(0.4 * overlap));
             other.position.sub(normal.clone().multiplyScalar(0.4 * overlap));
         }

         // Mating
         if (isFriend && id < other.id) {
             const matingCooldown = 20; 
             // Maturity check in seconds
             const maturityAgeSeconds = MATURITY_DAYS * REAL_SECONDS_PER_GAME_DAY;
             
             const canMate = (a: typeof agent) => 
                a.energy > params.reproductionThreshold && 
                a.age > maturityAgeSeconds && 
                (a.age - a.lastMated) > matingCooldown;

             if (canMate(agent) && canMate(otherAgent) && agents.entities.length < MAX_POPULATION) {
                 agent.lastMated = agent.age;
                 otherAgent.lastMated = otherAgent.age;
                 agent.energy -= 30; 
                 otherAgent.energy -= 30;
                 
                 const offspringGenome = mixGenomes(agent.genes, otherAgent.genes);
                 const midPoint = position.clone().lerp(other.position, 0.5);
                 
                 // Burst of hearts from mid-point
                 spawnParticle(midPoint, 'heart', undefined, agent.genes.size);

                 const litterSize = Math.floor((Math.random() * 4) + 3);
                 for(let k=0; k<litterSize; k++) {
                     if (agents.entities.length >= MAX_POPULATION) break;
                     const babyPos = midPoint.clone().add(new Vector3((Math.random()-0.5)*2, 0, (Math.random()-0.5)*2));
                     spawnAgent(babyPos, offspringGenome, 60, generateName(agent, otherAgent));
                 }
             }
         }
    } else if (agent.state === 'snuggling') {
        agent.state = 'wandering';
    }
};

const handleMovement = (entity: Entity, dt: number, nearestFood: Entity | null, nearestFoodDist: number, nearestBurrow: Entity | null, nearestBurrowDist: number, isNight: boolean, params: SimulationParams) => {
    const { agent, position, velocity } = entity;
    if (!agent || !velocity) return;

    const restDuration = 0.5 / (agent.genes.speed * 0.8 + 0.2); 
    const cycleTime = HOP_DURATION + restDuration;
    agent.hopTimer += dt;
    if (agent.hopTimer >= cycleTime) agent.hopTimer = 0;
    
    if (agent.hopTimer < HOP_DURATION) {
        const steering = tempVec.set(0, 0, 0);
        let targetDistForSpeed = Infinity;

        // Fleeing
        if (agent.state === 'fleeing') {
            const panicDir = new Vector3((Math.random()-0.5), 0, (Math.random()-0.5)).normalize();
            steering.add(panicDir.multiplyScalar(3));
            agent.energy -= 2 * dt; 
        } 
        // Eating
        else if (nearestFood && nearestFood.food && agent.state !== 'sleeping') {
             agent.target = nearestFood.position.clone();
             agent.state = 'seeking_food';
             targetDistForSpeed = nearestFoodDist;
             
             if (nearestFoodDist < (agent.genes.size * AGENT_RADIUS_BASE + 0.5)) {
                 agent.energy += nearestFood.food.value;
                 world.remove(nearestFood);
                 agent.target = null;
                 agent.state = 'wandering';
             } else {
                 steering.add(tempVec2.subVectors(nearestFood.position, position).normalize().multiplyScalar(2.0));
             }
        } 
        // Returning to Burrow
        else if ((isNight || agent.energy < 70) && agent.ownedBurrowId) {
            const myBurrow = burrows.entities.find(b => b.id === agent.ownedBurrowId);
            if (myBurrow) {
                const dist = position.distanceTo(myBurrow.position);
                targetDistForSpeed = dist;
                if (dist < 1.5) {
                    agent.currentBurrowId = myBurrow.id;
                    agent.state = 'sleeping';
                    position.y = -5; // Move visual underground
                } else {
                    steering.add(tempVec2.subVectors(myBurrow.position, position).normalize().multiplyScalar(3.0));
                    agent.state = 'wandering';
                }
            } else {
                agent.ownedBurrowId = null; 
            }
        }
        // Digging Decision
        else if (agent.energy < 60 && !isNight) { 
            if (nearestBurrow && nearestBurrowDist < 20 && !agent.ownedBurrowId) {
                 steering.add(tempVec2.subVectors(nearestBurrow.position, position).normalize());
                 targetDistForSpeed = nearestBurrowDist;
            } else if (nearestBurrowDist > MIN_BURROW_SPACING) {
                agent.state = 'digging';
                agent.digTimer = 0;
            }
        }
        // Wandering
        else {
            agent.state = 'wandering';
            // Strong forward bias to create distinct hopping directions rather than jittery in-place rotation
            const forwardBias = agent.heading.clone().multiplyScalar(4.0);
            const noise = new Vector3((Math.random()-0.5), 0, (Math.random()-0.5)).multiplyScalar(1.5);
            steering.add(forwardBias.add(noise));
        }

        // Boundary Avoidance
        if (position.x > WORLD_SIZE/2 - 2) steering.x -= 10;
        if (position.x < -WORLD_SIZE/2 + 2) steering.x += 10;
        if (position.z > WORLD_SIZE/2 - 2) steering.z -= 10;
        if (position.z < -WORLD_SIZE/2 + 2) steering.z += 10;

        const targetDir = agent.heading.clone().multiplyScalar(0.5).add(steering).normalize();
        // Slower turn rate for smoother arcs
        agent.heading.lerp(targetDir, 0.1).normalize();

        let speedMult = 25.0; 
        if (agent.state === 'fleeing') speedMult = 45.0; 
        else if (agent.energy < 20) speedMult = 8.0;
        if (targetDistForSpeed < 15.0 && agent.state !== 'fleeing') speedMult *= Math.max(0.15, Math.pow(targetDistForSpeed / 15.0, 0.7));

        const jumpForce = MAX_SPEED_BASE * (1 + agent.genes.speed * 2.0) * speedMult; 
        velocity.copy(agent.heading).multiplyScalar(jumpForce);
        agent.energy -= 0.5 * agent.genes.size * (agent.genes.speed * agent.genes.speed) * params.energyCostPerTick * 5 * dt;
        position.add(velocity.clone().multiplyScalar(dt));
    } else {
        velocity.set(0, 0, 0);
    }
    position.x = Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, position.x));
    position.z = Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, position.z));
};

// -- Main System --

export const AgentSystem = (dt: number, params: SimulationParams, getAgentColor: (e: Entity) => {r:number, g:number, b:number}) => {
    const time = params.timeOfDay;
    const isNight = time >= 20 || time < 5;
    
    // Reset Spatial Hashes
    agentHash.clear(); foodHash.clear(); burrowHash.clear();
    for (const a of agents.entities) { if (a.agent && !a.agent.currentBurrowId) agentHash.add(a); }
    for (const f of food.entities) foodHash.add(f);
    for (const b of burrows.entities) burrowHash.add(b);

    for (const entity of agents.entities) {
        const { agent, position, velocity } = entity;
        if (!agent || !velocity) continue;

        // Trail Update
        if (velocity.lengthSq() > 0.01 && !agent.currentBurrowId) {
            if (agent.trail.length === 0 || agent.trail[agent.trail.length-1].distanceToSquared(position) > 0.5) {
                agent.trail.push(position.clone());
                if (agent.trail.length > MAX_TRAIL_POINTS) agent.trail.shift();
            }
        }

        // Life & Energy
        agent.age += dt;
        agent.fear = Math.max(0, agent.fear - FEAR_DECAY * dt);
        let metabolicCost = params.energyCostPerTick * dt * agent.genes.size; 
        if (['sleeping', 'snuggling', 'resting'].includes(agent.state)) {
            metabolicCost = -ENERGY_REGEN_RATE * (agent.currentBurrowId ? 1.0 : 0.3) * dt; 
        }
        agent.energy = Math.min(100, agent.energy - metabolicCost);

        if (agent.energy <= 0 || agent.age > params.maxAge) {
            spawnParticle(position, 'death', getAgentColor(entity));
            world.remove(entity);
            continue;
        }

        // Burrow Logic (High Priority)
        if (agent.currentBurrowId !== null) {
            agent.state = 'sleeping';
            velocity.set(0,0,0); 
            // Zzz particles
            if (Math.random() < dt * 0.8) spawnParticle(position.clone(), 'zzz', undefined, agent.genes.size);
            
            if (agent.energy >= 95 && !isNight) {
                 agent.currentBurrowId = null;
                 agent.state = 'wandering';
                 position.y = 0; // Restore to surface
                 spawnParticle(position, 'dirt', undefined, 1.0);
            }
            continue; 
        }

        // Sleep Trigger
        if (isNight && agent.energy < 90 && !['sleeping', 'snuggling'].includes(agent.state)) {
            if (agent.ownedBurrowId) {
                 const burrow = burrows.entities.find(b => b.id === agent.ownedBurrowId);
                 if (burrow && position.distanceTo(burrow.position) < 2) {
                     agent.currentBurrowId = burrow.id;
                     agent.state = 'sleeping';
                     position.y = -5; // Move underground immediately
                 }
            } else agent.state = 'sleeping';
        } 
        if (agent.state === 'sleeping' && isNight) {
             if (Math.random() < dt * 0.8) spawnParticle(position.clone(), 'zzz', undefined, agent.genes.size);
             velocity.set(0,0,0);
             continue;
        } else if (agent.state === 'sleeping' && !isNight) agent.state = 'wandering';

        // Query Neighbors
        let nearestFood: Entity | null = null;
        let nearestFoodDist = Infinity;
        let nearestAgent: Entity | null = null;
        let nearestAgentDist = Infinity;
        let nearestBurrow: Entity | null = null;
        let nearestBurrowDist = Infinity;
        const maxDistSq = SENSOR_RADIUS * SENSOR_RADIUS;

        for (const f of foodHash.query(position)) {
            const distSq = position.distanceToSquared(f.position);
            if (distSq < maxDistSq && distSq < nearestFoodDist) { nearestFoodDist = distSq; nearestFood = f; }
        }
        for (const other of agentHash.query(position)) {
            if (other === entity) continue;
            const distSq = position.distanceToSquared(other.position);
            if (distSq < maxDistSq) {
                if(distSq < nearestAgentDist) { nearestAgentDist = distSq; nearestAgent = other; }
                const geneticDiff = Math.abs(agent.genes.selfishness - other.agent!.genes.selfishness);
                agent.affinity[other.id] = Math.max(-100, Math.min(100, (agent.affinity[other.id]||0) + (geneticDiff < 0.3 ? 5 : -2) * dt));
            }
        }
        for (const b of burrowHash.query(position, 64)) {
            const distSq = position.distanceToSquared(b.position);
            if (distSq < nearestBurrowDist) { nearestBurrowDist = distSq; nearestBurrow = b; }
        }

        nearestFoodDist = Math.sqrt(nearestFoodDist);
        nearestAgentDist = Math.sqrt(nearestAgentDist);
        nearestBurrowDist = Math.sqrt(nearestBurrowDist);

        // Execute Behaviors
        if (agent.state === 'digging') {
            handleDigging(entity, dt, nearestBurrowDist, nearestBurrow);
        } else {
            handleInteraction(entity, dt, nearestAgent, nearestAgentDist, params, isNight);
            if (agent.state !== 'snuggling') {
                handleMovement(entity, dt, nearestFood, nearestFoodDist, nearestBurrow, nearestBurrowDist, isNight, params);
            }
        }
    }
};