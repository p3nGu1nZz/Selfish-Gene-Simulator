import { Vector3 } from 'three';
import { world, agents, food, burrows } from '../core/ecs';
import { Entity, SimulationParams } from './types';
import { WORLD_SIZE, MAX_POPULATION, AGENT_RADIUS_BASE, MAX_SPEED_BASE, SENSOR_RADIUS, MAX_TRAIL_POINTS, MIN_BURROW_SPACING } from '../core/constants';
import { spawnParticle } from '../entities/Particle';
import { spawnAgent, mutateGenome, generateName } from '../entities/Agent';
import { spawnBurrow } from '../entities/Burrow';

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const tempVec = new Vector3();
const tempVec2 = new Vector3();

const HOP_DURATION = 0.3; 
const ENERGY_REGEN_RATE = 10; 
const DIG_COST = 0.5;
const DIG_THRESHOLD = 8.0; 
const FEAR_DECAY = 5; 

// -- Spatial Hash for Performance Optimization --
class SpatialHash {
    cellSize: number;
    buckets: Map<string, Entity[]>;

    constructor(cellSize: number) {
        this.cellSize = cellSize;
        this.buckets = new Map();
    }

    clear() {
        this.buckets.clear();
    }

    add(entity: Entity) {
        const key = this.getKey(entity.position);
        if (!this.buckets.has(key)) {
            this.buckets.set(key, []);
        }
        this.buckets.get(key)!.push(entity);
    }

    getKey(pos: Vector3): string {
        const x = Math.floor(pos.x / this.cellSize);
        const z = Math.floor(pos.z / this.cellSize);
        return `${x},${z}`;
    }

    query(pos: Vector3, radius?: number): Entity[] {
        const r = radius || this.cellSize;
        const cellsToCheck = Math.ceil(r / this.cellSize);
        
        const x = Math.floor(pos.x / this.cellSize);
        const z = Math.floor(pos.z / this.cellSize);
        const results: Entity[] = [];
        
        for (let i = -cellsToCheck; i <= cellsToCheck; i++) {
            for (let j = -cellsToCheck; j <= cellsToCheck; j++) {
                const key = `${x + i},${z + j}`;
                const bucket = this.buckets.get(key);
                if (bucket) {
                    for(let k=0; k<bucket.length; k++) {
                        results.push(bucket[k]);
                    }
                }
            }
        }
        return results;
    }
}

// Initialize hashes once
const agentHash = new SpatialHash(SENSOR_RADIUS);
const foodHash = new SpatialHash(SENSOR_RADIUS);
const burrowHash = new SpatialHash(MIN_BURROW_SPACING); // Increased cell size for burrow checks


export const AgentSystem = (dt: number, params: SimulationParams, getAgentColor: (e: Entity) => {r:number, g:number, b:number}) => {
    const allAgents = agents.entities;
    const allFood = food.entities;
    const allBurrows = burrows.entities;
    const time = params.timeOfDay;
    const isNight = time >= 20 || time < 5;
    
    // 0. Build Spatial Index (Optimization Step)
    agentHash.clear();
    foodHash.clear();
    burrowHash.clear();

    for (const a of allAgents) {
        if (a.agent && !a.agent.currentBurrowId) agentHash.add(a);
    }
    for (const f of allFood) {
        foodHash.add(f);
    }
    for (const b of allBurrows) {
        burrowHash.add(b);
    }

    for (const entity of allAgents) {
        const { agent, position, velocity } = entity;
        if (!agent || !velocity) continue;

        // 0. Update Trail
        if (velocity.lengthSq() > 0.01 && !agent.currentBurrowId) {
            if (agent.trail.length === 0 || agent.trail[agent.trail.length-1].distanceToSquared(position) > 0.5) {
                agent.trail.push(position.clone());
                if (agent.trail.length > MAX_TRAIL_POINTS) {
                    agent.trail.shift();
                }
            }
        }

        // 1. Lifecycle & Energy
        agent.age += dt;
        agent.fear = Math.max(0, agent.fear - FEAR_DECAY * dt);
        
        // Base metabolic cost
        let metabolicCost = params.energyCostPerTick * dt * agent.genes.size; 
        
        // Recovery when sleeping/snuggling
        if (agent.state === 'sleeping' || agent.state === 'snuggling' || agent.state === 'resting') {
            metabolicCost = -ENERGY_REGEN_RATE * 0.3 * dt; // Regen energy slowly
            if (agent.currentBurrowId) metabolicCost = -ENERGY_REGEN_RATE * dt; // Faster regen in burrow
        }

        agent.energy -= metabolicCost;
        if (agent.energy > 100) agent.energy = 100;

        if (agent.energy <= 0 || agent.age > params.maxAge) {
            spawnParticle(position, 'death', getAgentColor(entity));
            world.remove(entity);
            continue;
        }

        // -------------------------
        // STATE MACHINE ARBITRATION
        // -------------------------

        // High priority: Hidden in burrow
        if (agent.currentBurrowId !== null) {
            agent.state = 'sleeping';
            velocity.set(0,0,0); 

            if (Math.random() < dt * 2) {
                spawnParticle(position.clone().add(new Vector3(0,1,0)), 'zzz');
            }

            // Wake up if full energy AND it's day time
            if (agent.energy >= 95 && !isNight) {
                 agent.currentBurrowId = null;
                 agent.state = 'wandering';
                 position.y = 0;
            }
            continue; 
        }

        // 1. Fear / Fleeing
        if (agent.fear > 40) { 
            agent.state = 'fleeing';
        }
        else if (agent.state === 'digging') {
            // Logic handled below
        }
        else if (agent.energy < 30) {
             agent.state = 'seeking_food'; 
        }
        // 2. Sleep Schedule (Night time behavior)
        else if (isNight && agent.energy < 90) {
            if (agent.state !== 'sleeping' && agent.state !== 'snuggling') {
                 // If we have a burrow, go to it
                 if (agent.ownedBurrowId) {
                     // Check distance
                     const burrow = allBurrows.find(b => b.id === agent.ownedBurrowId);
                     if (burrow) {
                         if (position.distanceTo(burrow.position) < 2) {
                             agent.currentBurrowId = burrow.id;
                             agent.state = 'sleeping';
                         } else {
                             // Move towards burrow (handled in movement)
                         }
                     }
                 } else {
                     // No burrow, sleep on ground
                     agent.state = 'sleeping';
                 }
            }
            if (agent.state === 'sleeping') {
                 if (Math.random() < dt * 0.5) spawnParticle(position.clone().add(new Vector3(0,1,0)), 'zzz');
                 velocity.set(0,0,0);
                 continue;
            }
        } 
        else if (agent.state === 'sleeping' && !isNight) {
             agent.state = 'wandering'; // Wake up
        }

        // -----------------------
        // PERCEPTION
        // -----------------------
        let nearestFood: Entity | null = null;
        let nearestFoodDist = Infinity;
        let nearestAgent: Entity | null = null;
        let nearestAgentDist = Infinity;
        let nearestBurrow: Entity | null = null;
        let nearestBurrowDist = Infinity;

        const maxDistSq = SENSOR_RADIUS * SENSOR_RADIUS;

        const nearbyFood = foodHash.query(position);
        for (const f of nearbyFood) {
            const distSq = position.distanceToSquared(f.position);
            if (distSq < maxDistSq && distSq < nearestFoodDist) {
                nearestFoodDist = distSq;
                nearestFood = f;
            }
        }

        const nearbyAgents = agentHash.query(position);
        for (const other of nearbyAgents) {
            if (other === entity) continue;
            
            const distSq = position.distanceToSquared(other.position);
            
            if (distSq < maxDistSq) {
                if(distSq < nearestAgentDist) {
                    nearestAgentDist = distSq;
                    nearestAgent = other;
                }

                // Update affinity based on proximity
                const otherGenes = other.agent!.genes;
                const geneticDiff = Math.abs(agent.genes.selfishness - otherGenes.selfishness);
                const currentAffinity = agent.affinity[other.id] || 0;
                let change = 0;
                // Like similar genes
                if (geneticDiff < 0.3) change += 5 * dt; 
                else change -= 2 * dt; 
                
                // Snuggling boosts affinity
                if (agent.state === 'snuggling' && other.agent?.state === 'snuggling') {
                    change += 20 * dt;
                }

                agent.affinity[other.id] = Math.max(-100, Math.min(100, currentAffinity + change));
            }
        }

        const nearbyBurrows = burrowHash.query(position, 64); 
        for (const b of nearbyBurrows) {
            const distSq = position.distanceToSquared(b.position);
            if (distSq < nearestBurrowDist) {
                nearestBurrowDist = distSq;
                nearestBurrow = b;
            }
        }

        const distToFood = Math.sqrt(nearestFoodDist);
        const distToAgent = Math.sqrt(nearestAgentDist);
        const distToBurrow = Math.sqrt(nearestBurrowDist);
        const interactionRadius = (agent.genes.size + (nearestAgent?.agent?.genes.size || 1)) * AGENT_RADIUS_BASE;

        // -----------------------
        // BEHAVIOR EXECUTION
        // -----------------------

        // A. DIGGING
        if (agent.state === 'digging') {
            if (distToBurrow < MIN_BURROW_SPACING) {
                agent.state = 'wandering';
                agent.digTimer = 0;
                if (nearestBurrow) {
                    const away = tempVec.subVectors(position, nearestBurrow.position).normalize().multiplyScalar(5);
                    position.add(away);
                }
            } else {
                agent.digTimer += dt;
                agent.energy -= DIG_COST * dt;
                velocity.set(0,0,0);
                
                // VISUALS: Emit dirt particles while digging
                // Frequency increases slightly as they dig longer
                const progress = agent.digTimer / DIG_THRESHOLD;
                if (Math.random() < dt * (10 + 20 * progress)) {
                    spawnParticle(position, 'dirt');
                }

                if (agent.digTimer > DIG_THRESHOLD) {
                    const b = spawnBurrow(position, entity.id, agent.genes.size);
                    agent.ownedBurrowId = b.id;
                    agent.currentBurrowId = b.id; 
                    agent.state = 'sleeping';
                    agent.digTimer = 0;
                } else if (agent.energy < 5) {
                    agent.state = 'sleeping';
                }
            }
            continue; 
        }

        // B. INTERACTION (Snuggling & Mating)
        if (nearestAgent && distToAgent < interactionRadius * 1.5 && nearestAgent.agent) {
             const other = nearestAgent;
             const otherAgent = other.agent!;
             const affinity = agent.affinity[other.id] || 0;
             const isFriend = affinity > 20; 

             // Physics Push (Soft collision)
             const overlap = interactionRadius - distToAgent;
             const normal = tempVec.subVectors(position, other.position).normalize();
             
             // SNUGGLING LOGIC
             // Condition: High affinity, wandering or resting state, not hungry, not fleeing
             if (isFriend && 
                (agent.state === 'wandering' || agent.state === 'resting' || agent.state === 'snuggling') && 
                (otherAgent.state === 'wandering' || otherAgent.state === 'resting' || otherAgent.state === 'snuggling') &&
                agent.energy > 40 && otherAgent.energy > 40 &&
                !isNight) 
             {
                 agent.state = 'snuggling';
                 // Gentle push to keep them close but not overlapping too much
                 if (overlap > 0.1) {
                      position.add(normal.clone().multiplyScalar(0.01));
                 }
                 velocity.set(0,0,0);
                 
                 // Chance to break snuggle
                 if (Math.random() < dt * 0.5) {
                     agent.state = 'wandering';
                 }
                 
                 if (Math.random() < dt * 0.5) {
                     spawnParticle(position.clone().lerp(other.position, 0.5), 'heart');
                 }
                 continue; // Skip movement logic
             } 
             // Stop Snuggling if conditions fail
             else if (agent.state === 'snuggling') {
                 agent.state = 'wandering';
             }

             // Hard collision for non-snugglers
             if (overlap > 0 && agent.state !== 'snuggling') {
                 const pushDist = overlap * 0.8;
                 position.add(normal.clone().multiplyScalar(0.5 * pushDist));
                 other.position.sub(normal.clone().multiplyScalar(0.5 * pushDist));
             }

             // Mating Logic (unchanged)
             if (isFriend && entity.id < other.id) {
                 const matingCooldown = 20; 
                 const MATURITY_AGE = 100;
                 const canMate = (a: typeof agent) => 
                    a.energy > params.reproductionThreshold && 
                    a.age > MATURITY_AGE && 
                    (a.age - a.lastMated) > matingCooldown;

                 if (canMate(agent) && canMate(otherAgent)) {
                     if (allAgents.length < MAX_POPULATION) {
                         agent.lastMated = agent.age;
                         otherAgent.lastMated = otherAgent.age;
                         
                         agent.energy -= 30; 
                         otherAgent.energy -= 30;
                         
                         const mixedGenes = {
                             selfishness: (agent.genes.selfishness + otherAgent.genes.selfishness) / 2,
                             speed: (agent.genes.speed + otherAgent.genes.speed) / 2,
                             size: (agent.genes.size + otherAgent.genes.size) / 2,
                             mutationRate: (agent.genes.mutationRate + otherAgent.genes.mutationRate) / 2,
                             hue: 0
                         };

                         spawnParticle(position.clone().lerp(other.position, 0.5), 'heart');
                         const litterSize = Math.floor(rand(3, 7));
                         
                         for(let k=0; k<litterSize; k++) {
                             if (agents.entities.length >= MAX_POPULATION) break;
                             const babyPos = position.clone().lerp(other.position, 0.5);
                             babyPos.x += rand(-1, 1);
                             babyPos.z += rand(-1, 1);
                             spawnAgent(babyPos, mutateGenome(mixedGenes, params.mutationMagnitude * 10 * mixedGenes.mutationRate), 60, generateName(agent, otherAgent));
                         }
                     }
                 }
             }
        } else if (agent.state === 'snuggling') {
            // Friend moved away
            agent.state = 'wandering';
        }

        // C. MOVEMENT
        const restDuration = 0.5 / (agent.genes.speed * 0.8 + 0.2); 
        const cycleTime = HOP_DURATION + restDuration;
        agent.hopTimer += dt;
        if (agent.hopTimer >= cycleTime) agent.hopTimer = 0;
        const isHopping = agent.hopTimer < HOP_DURATION;

        if (isHopping) {
            const steering = tempVec.set(0, 0, 0);
            let targetDistForSpeed = Infinity;

            if (agent.state === 'fleeing') {
                const panicDir = new Vector3(rand(-1,1), 0, rand(-1,1)).normalize();
                steering.add(panicDir.multiplyScalar(3));
                agent.energy -= 2 * dt; 
            } 
            else if (agent.state === 'circling' && agent.target) {
                const toTarget = tempVec2.subVectors(agent.target, position);
                const dist = toTarget.length();
                if (dist < 1 || dist > 10) {
                     agent.state = 'wandering'; 
                } else {
                    const perp = new Vector3(-toTarget.z, 0, toTarget.x).normalize();
                    steering.add(perp.multiplyScalar(2));
                    steering.add(toTarget.normalize().multiplyScalar(0.5));
                }
                // Break circle
                if (Math.random() < dt * 0.8) agent.state = 'wandering';
            }
            else if (nearestFood && nearestFood.food && agent.state !== 'sleeping') {
                if (distToFood < 3 && agent.energy > 80 && Math.random() < dt * 0.2) {
                     // Only circle if very full and guarding food (rare)
                     agent.state = 'circling';
                     agent.target = nearestFood.position.clone();
                } else {
                    agent.target = nearestFood.position.clone();
                    agent.state = 'seeking_food';
                    targetDistForSpeed = distToFood;
                    
                    if (distToFood < (agent.genes.size * AGENT_RADIUS_BASE + 0.5)) {
                        agent.energy += nearestFood.food.value;
                        world.remove(nearestFood);
                        agent.target = null;
                        agent.state = 'wandering';
                    } else {
                        tempVec2.subVectors(nearestFood.position, position).normalize().multiplyScalar(2.0);
                        steering.add(tempVec2);
                    }
                }
            } 
            // Return to Burrow logic (for sleeping)
            else if ((isNight && agent.ownedBurrowId) || (agent.energy < 70 && agent.ownedBurrowId)) {
                const myBurrow = allBurrows.find(b => b.id === agent.ownedBurrowId);
                if (myBurrow) {
                    const dist = position.distanceTo(myBurrow.position);
                    targetDistForSpeed = dist;
                    if (dist < 1.5) {
                        agent.currentBurrowId = myBurrow.id;
                        agent.state = 'sleeping';
                        position.y = -1; 
                    } else {
                        tempVec2.subVectors(myBurrow.position, position).normalize().multiplyScalar(3.0);
                        steering.add(tempVec2);
                        agent.state = 'wandering'; // moving home
                    }
                } else {
                    agent.ownedBurrowId = null; 
                }
            }
            // Logic to create burrow
            else if (agent.energy < 60 && !isNight) { 
                if (nearestBurrow && distToBurrow < 20 && !agent.ownedBurrowId) {
                     const toBurrow = tempVec2.subVectors(nearestBurrow.position, position).normalize();
                     steering.add(toBurrow);
                     targetDistForSpeed = distToBurrow;
                } else if (distToBurrow > MIN_BURROW_SPACING) {
                    agent.state = 'digging';
                    agent.digTimer = 0;
                }
            }
            else {
                agent.state = 'wandering';
                const noise = new Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(1.0);
                steering.add(noise);
            }

            // World Bounds
            if (position.x > WORLD_SIZE/2 - 2) steering.x -= 10;
            if (position.x < -WORLD_SIZE/2 + 2) steering.x += 10;
            if (position.z > WORLD_SIZE/2 - 2) steering.z -= 10;
            if (position.z < -WORLD_SIZE/2 + 2) steering.z += 10;

            const targetDir = agent.heading.clone().multiplyScalar(0.5).add(steering).normalize();
            agent.heading.lerp(targetDir, 0.2).normalize();

            let speedMult = 25.0; 
            if (agent.state === 'fleeing') speedMult = 45.0; 
            else if (agent.state === 'circling') speedMult = 20.0;
            else if (agent.energy < 20) speedMult = 8.0;
            
            if (targetDistForSpeed < 15.0 && agent.state !== 'fleeing') {
                const approachFactor = Math.max(0.15, Math.pow(targetDistForSpeed / 15.0, 0.7));
                speedMult *= approachFactor;
            }

            const jumpForce = MAX_SPEED_BASE * (1 + agent.genes.speed * 2.0) * speedMult; 
            velocity.copy(agent.heading).multiplyScalar(jumpForce);

            const moveCost = 0.5 * agent.genes.size * (agent.genes.speed * agent.genes.speed) * params.energyCostPerTick * 5;
            agent.energy -= moveCost * dt;
            
            position.add(velocity.clone().multiplyScalar(dt));

        } else {
            velocity.set(0, 0, 0);
        }

        position.x = Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, position.x));
        position.z = Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, position.z));
    }
};