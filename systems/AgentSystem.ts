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
    agent.energy -= DIG_COST * dt; // Stamina cost
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
        // Too tired to dig
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
         if (isFriend && 
            (['wandering', 'resting', 'snuggling'] as string[]).includes(agent.state) && 
            (['wandering', 'resting', 'snuggling'] as string[]).includes(otherAgent.state) &&
            agent.energy > 30 && otherAgent.energy > 30 && !isNight) 
         {
             agent.state = 'snuggling';
             if (overlap > 0.1) {
                 position.addScaledVector(normal, 0.01);
             }
             velocity!.set(0,0,0);
             if (Math.random() < dt * 0.5) agent.state = 'wandering';
             
             // Thought Bubble: Heart
             if (Math.random() < dt * 0.5 && !agent.thoughtBubble) {
                 agent.thoughtBubble = { type: 'heart', timer: 2.0, maxTime: 2.0 };
             }
             return; 
         } 
         else if ((agent.state as string) === 'snuggling') agent.state = 'wandering';

         // Collision Push
         if (overlap > 0 && agent.state !== 'snuggling') {
             const push = 0.4 * overlap;
             position.addScaledVector(normal, push);
             other.position.addScaledVector(normal, -push);
         }

         // Mating
         if (isFriend && id < other.id) {
             const maturityAgeSeconds = MATURITY_DAYS * REAL_SECONDS_PER_GAME_DAY;
             
             const avgFertility = (agent.genes.fertility + otherAgent.genes.fertility) / 2;
             const cooldownMod = 1.5 - avgFertility; 
             const cooldown = BASE_MATING_COOLDOWN * cooldownMod;

             const canMate = (a: typeof agent) => 
                a.hunger > 50 && // Must not be starving
                a.energy > 30 && // Must have stamina
                a.age > maturityAgeSeconds && 
                (a.age - a.lastMated) > cooldown;

             if (canMate(agent) && canMate(otherAgent) && agents.entities.length < MAX_POPULATION) {
                 agent.lastMated = agent.age;
                 otherAgent.lastMated = otherAgent.age;
                 agent.energy -= 30; // Stamina cost
                 otherAgent.energy -= 30;
                 
                 const offspringGenome = mixGenomes(agent.genes, otherAgent.genes);
                 tempVec2.copy(position).lerp(other.position, 0.5);
                 const midPoint = tempVec2;
                 
                 agent.thoughtBubble = { type: 'heart', timer: 3.0, maxTime: 3.0 };
                 otherAgent.thoughtBubble = { type: 'heart', timer: 3.0, maxTime: 3.0 };

                 const pairFertility = (agent.genes.fertility + otherAgent.genes.fertility) / 2;
                 const litterMin = MIN_LITTER_SIZE;
                 const litterMax = MAX_LITTER_SIZE;
                 
                 const expectedSize = MathUtils.lerp(litterMin, litterMax, pairFertility);
                 const variance = (Math.random() - 0.5) * 2; 
                 const litterSize = Math.max(1, Math.min(MAX_LITTER_SIZE, Math.round(expectedSize + variance)));

                 // Split initial energy from parents' energy? No, just base standard.
                 for(let k=0; k<litterSize; k++) {
                     if (agents.entities.length >= MAX_POPULATION) break;
                     tempVec3.copy(midPoint).add(tempVec4.set((Math.random()-0.5)*2, 0, (Math.random()-0.5)*2));
                     spawnAgent(tempVec3, offspringGenome, undefined, generateName(agent, otherAgent));
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
    
    // ANGER TRIGGER: Food Competition
    if (agent.state === 'seeking_food' && (!nearestFood || !nearestFood.food)) {
        if (Math.random() < 0.3) {
            agent.thoughtBubble = { type: 'angry', timer: 2.0, maxTime: 2.0 };
        }
        agent.state = 'wandering';
        agent.target = null;
    } else if (agent.state === 'fleeing' && Math.random() < dt * 0.2) {
        agent.thoughtBubble = { type: 'angry', timer: 2.0, maxTime: 2.0 };
    }

    if (agent.hopTimer < HOP_DURATION) {
        const steering = tempVec.set(0, 0, 0);
        let targetDistForSpeed = Infinity;

        // Fleeing
        if (agent.state === 'fleeing') {
            tempVec2.set((Math.random()-0.5), 0, (Math.random()-0.5)).normalize();
            steering.addScaledVector(tempVec2, 3);
            agent.energy -= 2 * dt; 
        } 
        // Eating - Driven by HUNGER now
        else if (nearestFood && nearestFood.food && agent.state !== 'sleeping') {
             agent.target = nearestFood.position.clone();
             agent.state = 'seeking_food';
             targetDistForSpeed = nearestFoodDist;
             
             if (nearestFoodDist < (agent.genes.size * AGENT_RADIUS_BASE + 0.5)) {
                 // Eat
                 agent.hunger = Math.min(100, agent.hunger + nearestFood.food.value);
                 // Eating also gives a small stamina boost
                 agent.energy = Math.min(100, agent.energy + 20); 
                 
                 world.remove(nearestFood);
                 agent.target = null;
                 agent.state = 'wandering';
             } else {
                 tempVec2.subVectors(nearestFood.position, position).normalize().multiplyScalar(2.0);
                 steering.add(tempVec2);
             }
        } 
        // Returning to Burrow (Tiredness or Night)
        else if ((isNight || agent.energy < 20) && agent.ownedBurrowId) {
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
        // Digging Decision (Only if healthy and not starving)
        else if (agent.energy < 80 && agent.hunger > 40 && !isNight) { 
            // If tired but not exhausted, maybe look for burrow
            if (nearestBurrow && nearestBurrowDist < 20 && !agent.ownedBurrowId) {
                 tempVec2.subVectors(nearestBurrow.position, position).normalize();
                 steering.add(tempVec2);
                 targetDistForSpeed = nearestBurrowDist;
            } else if (nearestBurrowDist > MIN_BURROW_SPACING && agent.energy > 50) {
                // Dig a new one
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

                 tempVec2.copy(agent.heading).multiplyScalar(1.5);
                 tempVec3.set((Math.random()-0.5), 0, (Math.random()-0.5)).multiplyScalar(2.5);
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

        // Boundary Avoidance
        const distFromCenter = Math.sqrt(position.x * position.x + position.z * position.z);
        const radiusLimit = (WORLD_SIZE / 2) - 5;
        if (distFromCenter > radiusLimit) {
            tempVec2.set(-position.x, 0, -position.z).normalize().multiplyScalar(10);
            steering.add(tempVec2);
        }

        // Apply Steering
        tempVec2.copy(agent.heading).multiplyScalar(0.5).add(steering).normalize();
        agent.heading.lerp(tempVec2, 0.1).normalize();

        let speedMult = 25.0; 
        if (agent.state === 'fleeing') speedMult = 45.0; 
        else if (agent.energy < 20) speedMult = 8.0; // Slow when tired
        if (targetDistForSpeed < 15.0 && agent.state !== 'fleeing') speedMult *= Math.max(0.15, Math.pow(targetDistForSpeed / 15.0, 0.7));

        const jumpForce = MAX_SPEED_BASE * (1 + agent.genes.speed * 2.0) * speedMult; 
        velocity.copy(agent.heading).multiplyScalar(jumpForce);
        
        // Stamina Cost
        // Bigger/Faster rabbits burn more stamina
        const moveCost = 2.0 * agent.genes.size * (agent.genes.speed * agent.genes.speed) * dt;
        agent.energy = Math.max(0, agent.energy - moveCost);
        
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
    const time = params.timeOfDay % 24;
    const isNight = time >= 20 || time < 5;
    
    const allAgents = agents.entities;

    if (allAgents.length < 3 && Math.random() < dt * 0.5) {
        spawnAgent(); 
    }

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

        // Thought Bubble Timer
        if (agent.thoughtBubble) {
            agent.thoughtBubble.timer -= dt;
            if (agent.thoughtBubble.timer <= 0) {
                agent.thoughtBubble = null;
            }
        }

        // Trail
        if (velocity.lengthSq() > 0.01 && !agent.currentBurrowId) {
            if (agent.trail.length === 0 || agent.trail[agent.trail.length-1].distanceToSquared(position) > 0.5) {
                agent.trail.push(position.clone());
                if (agent.trail.length > MAX_TRAIL_POINTS) agent.trail.shift();
            }
        }

        // --- STATS UPDATE ---
        agent.age += dt;
        agent.fear = Math.max(0, agent.fear - FEAR_DECAY * dt);
        
        // 1. Hunger / Metabolism
        // Genes.Energy is now Efficiency (0.0 = inefficient, 1.0 = efficient)
        // Base burn rate depends on size
        const metabolicRate = params.energyCostPerTick * 5.0; 
        const efficiency = 1.0 - (agent.genes.energy * 0.5); // 1.0 down to 0.5 mult
        const hungerDecay = metabolicRate * agent.genes.size * efficiency * dt;
        
        // While sleeping/resting, hunger decays slower
        const stateMult = (['sleeping', 'snuggling', 'resting'].includes(agent.state)) ? 0.5 : 1.0;
        
        agent.hunger -= hungerDecay * stateMult;

        // 2. Stamina (Energy) Regen
        if (['sleeping', 'snuggling', 'resting'].includes(agent.state)) {
            agent.energy = Math.min(100, agent.energy + ENERGY_REGEN_RATE * dt);
        } else {
            // Passive stamina recovery if just wandering slowly?
            if (agent.state === 'wandering') agent.energy = Math.min(100, agent.energy + (ENERGY_REGEN_RATE * 0.1 * dt));
        }

        // Death Conditions
        if (agent.hunger <= 0 || agent.age > params.maxAge) {
            spawnParticle(position, 'death', getAgentColor(entity));
            world.remove(entity);
            continue;
        }

        // --- BURROW LOGIC ---
        if (agent.currentBurrowId !== null) {
            agent.state = 'sleeping';
            velocity.set(0,0,0); 
            if (Math.random() < dt * 0.5 && !agent.thoughtBubble) {
                 agent.thoughtBubble = { type: 'zzz', timer: 2.0, maxTime: 2.0 };
            }
            
            // Wake up condition: Full energy (Stamina) AND Day
            // Or if really hungry, wake up to eat regardless of stamina
            if ((agent.energy >= 100 && !isNight) || (agent.hunger < 30)) {
                 agent.currentBurrowId = null;
                 agent.state = 'wandering';
                 position.y = 0; 
                 spawnParticle(position, 'dirt', undefined, 1.0);
            }
            continue; 
        }

        // Sleep Trigger
        // Go to sleep if: Night OR Exhausted
        const isExhausted = agent.energy < 10;
        if ((isNight || isExhausted) && !['sleeping', 'snuggling'].includes(agent.state)) {
            // Only sleep if not actively starving (unless it's night, then fear keeps them in)
            if (agent.hunger > 30 || isNight) {
                if (agent.ownedBurrowId) {
                    const burrow = burrows.entities.find(b => b.id === agent.ownedBurrowId);
                    if (burrow && position.distanceTo(burrow.position) < 2) {
                        agent.currentBurrowId = burrow.id;
                        agent.state = 'sleeping';
                        position.y = -5;
                    }
                } else {
                    // Nap on ground if no burrow
                    if (isExhausted) agent.state = 'resting'; 
                    else if (isNight) agent.state = 'resting';
                }
            }
        } 
        
        // Wake up from ground nap
        if (agent.state === 'resting') {
             if (agent.energy >= 100 && !isNight) agent.state = 'wandering';
             // Wake up if starving
             if (agent.hunger < 20) agent.state = 'wandering';
             velocity.set(0,0,0);
             continue;
        }

        // --- SENSORS ---
        let nearestFood: Entity | null = null;
        let nearestFoodDist = Infinity;
        let nearestAgent: Entity | null = null;
        let nearestAgentDist = Infinity;
        let nearestBurrow: Entity | null = null;
        let nearestBurrowDist = Infinity;
        const maxDistSq = SENSOR_RADIUS * SENSOR_RADIUS;

        // Determine if we are looking for food (Hungry)
        const isHungry = agent.hunger < 60; // Threshold to start caring about food

        if (isHungry) {
            const nearbyFood = foodHash.query(position);
            for(let j=0; j<nearbyFood.length; j++) {
                const f = nearbyFood[j];
                const distSq = position.distanceToSquared(f.position);
                if (distSq < maxDistSq && distSq < nearestFoodDist) { nearestFoodDist = distSq; nearestFood = f; }
            }
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
                
                if (geneticDiff < 0.2 && Math.random() < 0.005 && !agent.thoughtBubble) {
                     agent.thoughtBubble = { type: 'heart', timer: 1.5, maxTime: 1.5 };
                }
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