import { Vector3, MathUtils } from 'three';
import { world, agents, food, burrows } from '../core/ecs';
import { Entity, SimulationParams } from '../core/types';
import { 
    WORLD_SIZE, MAX_POPULATION, AGENT_RADIUS_BASE, MAX_SPEED_BASE, SENSOR_RADIUS, 
    MAX_TRAIL_POINTS, MIN_BURROW_SPACING,
    HOP_DURATION, ENERGY_REGEN_RATE, DIG_COST, DIG_THRESHOLD, FEAR_DECAY,
    MATURITY_DAYS, REAL_SECONDS_PER_GAME_DAY, MIN_LITTER_SIZE, MAX_LITTER_SIZE, BASE_MATING_COOLDOWN
} from '../core/constants';
import { spawnParticle } from '../entities/Particle';
import { spawnAgent, mixGenomes, generateName } from '../entities/Agent';
import { spawnBurrow } from '../entities/Burrow';

// Reuse vectors to avoid Garbage Collection
const tempVec = new Vector3();
const tempVec2 = new Vector3();
const tempVec3 = new Vector3();
const tempVec4 = new Vector3();

// -- Spatial Hash --
class SpatialHash {
    cellSize: number;
    buckets: Map<string, Entity[]>;

    constructor(cellSize: number) {
        this.cellSize = cellSize;
        this.buckets = new Map();
    }

    // Optimization: Reuse arrays instead of creating new ones
    clear() { 
        for (const bucket of this.buckets.values()) {
            bucket.length = 0;
        }
    }

    add(entity: Entity) {
        const cx = Math.floor(entity.position.x / this.cellSize);
        const cz = Math.floor(entity.position.z / this.cellSize);
        const key = `${cx},${cz}`;
        
        let bucket = this.buckets.get(key);
        if (!bucket) {
            bucket = [];
            this.buckets.set(key, bucket);
        }
        bucket.push(entity);
    }

    query(pos: Vector3, radius?: number): Entity[] {
        const r = radius || this.cellSize;
        const cx = Math.floor(pos.x / this.cellSize);
        const cz = Math.floor(pos.z / this.cellSize);
        const cells = Math.ceil(r / this.cellSize);
        const results: Entity[] = [];
        
        for (let i = -cells; i <= cells; i++) {
            for (let j = -cells; j <= cells; j++) {
                const key = `${cx + i},${cz + j}`;
                const bucket = this.buckets.get(key);
                if (bucket && bucket.length > 0) {
                    // Manual loop is slightly faster than spread operator for large arrays, 
                    // but spread is fine here given bucket sizes are usually small.
                    // However, we simply push to results to avoid allocating new intermediate arrays
                    for(let k=0; k<bucket.length; k++) {
                        results.push(bucket[k]);
                    }
                }
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

    // Check if we are colliding with a burrow that is NOT our own
    const collisionDist = MIN_BURROW_SPACING * 0.8;
    const conflict = nearestBurrow && nearestBurrowDist < collisionDist && nearestBurrow.id !== agent.ownedBurrowId;

    if (conflict) {
        // Abort digging if we are too close to another burrow
        agent.state = 'wandering';
        agent.digTimer = 0;
        
        // Remove our partial burrow if it exists
        if (agent.ownedBurrowId !== null) {
            const myBurrow = burrows.entities.find(b => b.id === agent.ownedBurrowId);
            if (myBurrow) world.remove(myBurrow);
            agent.ownedBurrowId = null;
        }

        if (nearestBurrow) {
            // tempVec reuse
            tempVec.subVectors(position, nearestBurrow.position).normalize().multiplyScalar(5);
            position.add(tempVec);
        }
        return;
    }

    // Start Digging: Spawn burrow if not exists
    if (agent.ownedBurrowId === null) {
        const b = spawnBurrow(position, entity.id, agent.genes.size);
        if (b.burrow) b.burrow.digProgress = 0;
        agent.ownedBurrowId = b.id;
    }

    agent.digTimer += dt;
    agent.energy -= DIG_COST * dt;
    velocity!.set(0,0,0);
    
    // Update Burrow Progress
    const myBurrow = burrows.entities.find(b => b.id === agent.ownedBurrowId);
    if (myBurrow && myBurrow.burrow) {
        // Map timer to 0-1 progress
        myBurrow.burrow.digProgress = Math.min(1.0, agent.digTimer / DIG_THRESHOLD);
    }
    
    // Spawn dirt particles more frequently when actively digging
    // And play sound
    if (Math.random() < dt * 25) { 
        spawnParticle(position, 'dirt', undefined, agent.genes.size);
        // Chance to play sound synchronized with particle bursts
        if (Math.random() < 0.25) playDigSound();
    }

    if (agent.digTimer > DIG_THRESHOLD) {
        // Complete!
        if (myBurrow && myBurrow.burrow) myBurrow.burrow.digProgress = 1.0;
        
        agent.ownedBurrowId = agent.ownedBurrowId!; // Type assertion safe due to logic above
        agent.currentBurrowId = agent.ownedBurrowId; 
        agent.state = 'sleeping';
        agent.digTimer = 0;
        
        // Burst on completion
        for(let k=0; k<5; k++) spawnParticle(position, 'dirt'); 
        playDigSound(); // Final big dig sound
    } else if (agent.energy < 5) {
        agent.state = 'sleeping';
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
         
         // tempVec reuse for normal
         tempVec.subVectors(position, other.position).normalize();
         const normal = tempVec;
         
         // Snuggling
         // Cast to string array for includes check
         if (isFriend && 
            (['wandering', 'resting', 'snuggling'] as string[]).includes(agent.state) && 
            (['wandering', 'resting', 'snuggling'] as string[]).includes(otherAgent.state) &&
            agent.energy > 40 && otherAgent.energy > 40 && !isNight) 
         {
             agent.state = 'snuggling';
             if (overlap > 0.1) {
                 // position.add(normal.clone().multiplyScalar(0.01));
                 position.addScaledVector(normal, 0.01);
             }
             velocity!.set(0,0,0);
             if (Math.random() < dt * 0.5) agent.state = 'wandering';
             
             // Particle spawn lerp
             tempVec2.copy(position).lerp(other.position, 0.5);
             if (Math.random() < dt * 0.5) spawnParticle(tempVec2, 'heart', undefined, agent.genes.size);
             return; 
         } 
         else if ((agent.state as string) === 'snuggling') agent.state = 'wandering';

         // Collision Push
         if (overlap > 0 && agent.state !== 'snuggling') {
             // position.add(normal.clone().multiplyScalar(0.4 * overlap));
             // other.position.sub(normal.clone().multiplyScalar(0.4 * overlap));
             const push = 0.4 * overlap;
             position.addScaledVector(normal, push);
             other.position.addScaledVector(normal, -push);
         }

         // Mating
         if (isFriend && id < other.id) {
             const maturityAgeSeconds = MATURITY_DAYS * REAL_SECONDS_PER_GAME_DAY;
             
             // Dynamic Cooldown based on Fertility
             const avgFertility = (agent.genes.fertility + otherAgent.genes.fertility) / 2;
             const cooldownMod = 1.5 - avgFertility; // Range 0.5 to 1.5
             const cooldown = BASE_MATING_COOLDOWN * cooldownMod;

             const canMate = (a: typeof agent) => 
                a.energy > params.reproductionThreshold && 
                a.age > maturityAgeSeconds && 
                (a.age - a.lastMated) > cooldown;

             if (canMate(agent) && canMate(otherAgent) && agents.entities.length < MAX_POPULATION) {
                 agent.lastMated = agent.age;
                 otherAgent.lastMated = otherAgent.age;
                 agent.energy -= 30; 
                 otherAgent.energy -= 30;
                 
                 const offspringGenome = mixGenomes(agent.genes, otherAgent.genes);
                 // tempVec2 reuse for midpoint
                 tempVec2.copy(position).lerp(other.position, 0.5);
                 const midPoint = tempVec2;
                 
                 // Burst of hearts from mid-point
                 spawnParticle(midPoint, 'heart', undefined, agent.genes.size);

                 const pairFertility = (agent.genes.fertility + otherAgent.genes.fertility) / 2;
                 const litterMin = MIN_LITTER_SIZE;
                 const litterMax = MAX_LITTER_SIZE;
                 
                 const expectedSize = MathUtils.lerp(litterMin, litterMax, pairFertility);
                 const variance = (Math.random() - 0.5) * 2; // +/- 1
                 const litterSize = Math.max(1, Math.min(MAX_LITTER_SIZE, Math.round(expectedSize + variance)));

                 for(let k=0; k<litterSize; k++) {
                     if (agents.entities.length >= MAX_POPULATION) break;
                     // tempVec3 reuse for baby pos
                     tempVec3.copy(midPoint).add(tempVec4.set((Math.random()-0.5)*2, 0, (Math.random()-0.5)*2));
                     spawnAgent(tempVec3, offspringGenome, undefined, generateName(agent, otherAgent));
                 }
             }
         }
    } else if (agent.state === 'snuggling') {
        agent.state = 'wandering';
    }
};

const handleMovement = (entity: Entity, dt: number, nearestFood: Entity | null, nearestFoodDist: number, nearestBurrow: Entity | null, nearestBurrowDist: number, isNight: boolean, params: SimulationParams, maxEnergy: number) => {
    const { agent, position, velocity } = entity;
    if (!agent || !velocity) return;

    const restDuration = 0.5 / (agent.genes.speed * 0.8 + 0.2); 
    const cycleTime = HOP_DURATION + restDuration;
    agent.hopTimer += dt;
    if (agent.hopTimer >= cycleTime) agent.hopTimer = 0;
    
    if (agent.hopTimer < HOP_DURATION) {
        // tempVec used for steering
        const steering = tempVec.set(0, 0, 0);
        let targetDistForSpeed = Infinity;

        // Fleeing
        if (agent.state === 'fleeing') {
            // tempVec2 used for panicDir
            tempVec2.set((Math.random()-0.5), 0, (Math.random()-0.5)).normalize();
            steering.addScaledVector(tempVec2, 3);
            agent.energy -= 2 * dt; 
        } 
        // Eating
        else if (nearestFood && nearestFood.food && agent.state !== 'sleeping') {
             agent.target = nearestFood.position.clone(); // Keep clone here as target is long-lived
             agent.state = 'seeking_food';
             targetDistForSpeed = nearestFoodDist;
             
             if (nearestFoodDist < (agent.genes.size * AGENT_RADIUS_BASE + 0.5)) {
                 agent.energy += nearestFood.food.value;
                 world.remove(nearestFood);
                 agent.target = null;
                 agent.state = 'wandering';
             } else {
                 // tempVec2 reuse
                 tempVec2.subVectors(nearestFood.position, position).normalize().multiplyScalar(2.0);
                 steering.add(tempVec2);
             }
        } 
        // Returning to Burrow
        const tirednessThreshold = maxEnergy * 0.4;
        
        if ((isNight || agent.energy < tirednessThreshold) && agent.ownedBurrowId) {
            const myBurrow = burrows.entities.find(b => b.id === agent.ownedBurrowId);
            if (myBurrow) {
                const dist = position.distanceTo(myBurrow.position);
                targetDistForSpeed = dist;
                if (dist < 1.5) {
                    agent.currentBurrowId = myBurrow.id;
                    agent.state = 'sleeping';
                    position.y = -5; // Move visual underground
                } else {
                    tempVec2.subVectors(myBurrow.position, position).normalize().multiplyScalar(3.0);
                    steering.add(tempVec2);
                    agent.state = 'wandering';
                }
            } else {
                agent.ownedBurrowId = null; 
            }
        }
        // Digging Decision
        else if (agent.energy < (maxEnergy * 0.6) && !isNight) { 
            if (nearestBurrow && nearestBurrowDist < 20 && !agent.ownedBurrowId) {
                 tempVec2.subVectors(nearestBurrow.position, position).normalize();
                 steering.add(tempVec2);
                 targetDistForSpeed = nearestBurrowDist;
            } else if (nearestBurrowDist > MIN_BURROW_SPACING && agent.energy > (maxEnergy * 0.3)) {
                agent.state = 'digging';
                agent.digTimer = 0;
            }
        }
        // Wandering / Exploring
        else {
             // Reset state
             if (agent.state !== 'wandering' && agent.state !== 'exploring') {
                 agent.state = 'wandering';
                 agent.target = null;
                 agent.actionTimer = 0;
             }

             agent.actionTimer += dt;

             if (agent.state === 'wandering') {
                 // Randomly switch to exploring
                 const threshold = 10 + (agent.genes.selfishness * 5) + (entity.id % 5);
                 
                 if (agent.actionTimer > threshold) {
                    agent.state = 'exploring';
                    agent.actionTimer = 0;
                    const range = (WORLD_SIZE / 2) * 0.8;
                    agent.target = new Vector3(
                        (Math.random() - 0.5) * 2 * range,
                        0,
                        (Math.random() - 0.5) * 2 * range
                    );
                 }

                 // Improved Wandering Steering (Avoids circles)
                 // Optimized vector math
                 tempVec2.copy(agent.heading).multiplyScalar(1.5); // forwardBias
                 tempVec3.set((Math.random()-0.5), 0, (Math.random()-0.5)).multiplyScalar(2.5); // noise
                 steering.add(tempVec2).add(tempVec3);
             } 
             else if (agent.state === 'exploring') {
                 const dist = agent.target ? position.distanceTo(agent.target) : 0;
                 
                 if (!agent.target || dist < 8 || agent.actionTimer > 25) {
                     agent.state = 'wandering';
                     agent.target = null;
                     agent.actionTimer = 0;
                 } else {
                     tempVec2.subVectors(agent.target, position).normalize().multiplyScalar(3.0);
                     steering.add(tempVec2);
                 }
             }
        }

        // Boundary Avoidance (Circular Island check for cleaner movement)
        const distFromCenter = Math.sqrt(position.x * position.x + position.z * position.z);
        const radiusLimit = (WORLD_SIZE / 2) - 5;
        
        if (distFromCenter > radiusLimit) {
            // Steer towards center
            tempVec2.set(-position.x, 0, -position.z).normalize().multiplyScalar(10);
            steering.add(tempVec2);
        }

        // Apply Steering
        // tempVec2 = targetDir
        tempVec2.copy(agent.heading).multiplyScalar(0.5).add(steering).normalize();
        
        // Slower turn rate for smoother arcs
        agent.heading.lerp(tempVec2, 0.1).normalize();

        let speedMult = 25.0; 
        if (agent.state === 'fleeing') speedMult = 45.0; 
        else if (agent.energy < (maxEnergy * 0.2)) speedMult = 8.0;
        if (targetDistForSpeed < 15.0 && agent.state !== 'fleeing') speedMult *= Math.max(0.15, Math.pow(targetDistForSpeed / 15.0, 0.7));

        const jumpForce = MAX_SPEED_BASE * (1 + agent.genes.speed * 2.0) * speedMult; 
        velocity.copy(agent.heading).multiplyScalar(jumpForce);
        
        const efficiency = 1.5 - agent.genes.energy; 
        const moveCost = 0.5 * agent.genes.size * (agent.genes.speed * agent.genes.speed) * params.energyCostPerTick * 5 * efficiency * dt;
        agent.energy -= moveCost;
        
        // position.add(velocity.clone().multiplyScalar(dt));
        position.addScaledVector(velocity, dt);

    } else {
        velocity.set(0, 0, 0);
    }
    
    // Circular Clamp
    const limit = (WORLD_SIZE / 2) - 2;
    if (position.length() > limit) {
        position.setLength(limit);
    }
};

// -- Main System --

export const AgentSystem = (dt: number, params: SimulationParams, getAgentColor: (e: Entity) => {r:number, g:number, b:number}) => {
    // Modulo time so day/night cycles still work even though timeOfDay accumulates
    const time = params.timeOfDay % 24;
    const isNight = time >= 20 || time < 5;
    
    const allAgents = agents.entities;

    // Extinction Prevention: If population drops too low, spawn new random agents
    // We check for very low population and a small chance per frame to avoid instant flooding
    if (allAgents.length < 3 && Math.random() < dt * 0.5) {
        // Calling spawnAgent without position ensures random world placement
        spawnAgent(); 
    }

    // Clear and fill hashes (Reuses memory internally)
    agentHash.clear(); 
    foodHash.clear(); 
    burrowHash.clear();

    const allFood = food.entities;
    const allBurrows = burrows.entities;

    for (let i = 0; i < allAgents.length; i++) {
        const a = allAgents[i];
        if (a.agent && !a.agent.currentBurrowId) agentHash.add(a); 
    }
    for (let i = 0; i < allFood.length; i++) {
        foodHash.add(allFood[i]);
    }
    for (let i = 0; i < allBurrows.length; i++) {
        burrowHash.add(allBurrows[i]);
    }

    for (let i = 0; i < allAgents.length; i++) {
        const entity = allAgents[i];
        const { agent, position, velocity } = entity;
        if (!agent || !velocity) continue;

        // Dynamic Max Energy based on Energy Gene
        const maxEnergy = 50 + (agent.genes.energy * 100);

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
        
        const efficiency = 1.5 - agent.genes.energy; 
        let metabolicCost = params.energyCostPerTick * dt * agent.genes.size * efficiency; 
        
        if (['sleeping', 'snuggling', 'resting'].includes(agent.state)) {
            // Regen
            metabolicCost = -ENERGY_REGEN_RATE * (agent.currentBurrowId ? 1.0 : 0.3) * dt; 
        }
        agent.energy = Math.min(maxEnergy, agent.energy - metabolicCost);

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
            // tempVec reuse for spawn
            if (Math.random() < dt * 0.8) spawnParticle(tempVec.copy(position), 'zzz', undefined, agent.genes.size);
            
            // Wake up threshold
            if (agent.energy >= (maxEnergy * 0.95) && !isNight) {
                 agent.currentBurrowId = null;
                 agent.state = 'wandering';
                 position.y = 0; // Restore to surface
                 spawnParticle(position, 'dirt', undefined, 1.0);
            }
            continue; 
        }

        // Sleep Trigger
        if (isNight && agent.energy < (maxEnergy * 0.9) && !['sleeping', 'snuggling'].includes(agent.state)) {
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
             if (Math.random() < dt * 0.8) spawnParticle(tempVec.copy(position), 'zzz', undefined, agent.genes.size);
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

        // Optimization: Query returns reused array but containing entities, 
        // we iterate results immediately
        const nearbyFood = foodHash.query(position);
        for(let j=0; j<nearbyFood.length; j++) {
            const f = nearbyFood[j];
            const distSq = position.distanceToSquared(f.position);
            if (distSq < maxDistSq && distSq < nearestFoodDist) { nearestFoodDist = distSq; nearestFood = f; }
        }

        const nearbyAgents = agentHash.query(position);
        for(let j=0; j<nearbyAgents.length; j++) {
            const other = nearbyAgents[j];
            if (other === entity) continue;
            const distSq = position.distanceToSquared(other.position);
            if (distSq < maxDistSq) {
                if(distSq < nearestAgentDist) { nearestAgentDist = distSq; nearestAgent = other; }
                const geneticDiff = Math.abs(agent.genes.selfishness - other.agent!.genes.selfishness);
                agent.affinity[other.id] = Math.max(-100, Math.min(100, (agent.affinity[other.id]||0) + (geneticDiff < 0.3 ? 5 : -2) * dt));
            }
        }

        const nearbyBurrows = burrowHash.query(position, 64);
        for(let j=0; j<nearbyBurrows.length; j++) {
            const b = nearbyBurrows[j];
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
                handleMovement(entity, dt, nearestFood, nearestFoodDist, nearestBurrow, nearestBurrowDist, isNight, params, maxEnergy);
            }
        }
    }
};