import { Vector3 } from 'three';
import { world, agents, food, burrows } from '../core/ecs';
import { Entity, SimulationParams } from './types';
import { WORLD_SIZE, MAX_POPULATION, AGENT_RADIUS_BASE, MAX_SPEED_BASE, SENSOR_RADIUS, MAX_TRAIL_POINTS } from '../core/constants';
import { spawnParticle } from '../entities/Particle';
import { spawnAgent, mutateGenome, generateName } from '../entities/Agent';
import { spawnBurrow } from '../entities/Burrow';

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const tempVec = new Vector3();
const tempVec2 = new Vector3();

const HOP_DURATION = 0.3; 
const ENERGY_REGEN_RATE = 10; 
const DIG_COST = 0.5;
const DIG_THRESHOLD = 8.0; // Seconds to dig a hole (Increased)
const FEAR_DECAY = 10;
const AFFINITY_RANGE = 20;

// -- Spatial Hash for Performance Optimization --
// Replaces O(N^2) distance checks with O(N) grid lookups
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

    query(pos: Vector3): Entity[] {
        const x = Math.floor(pos.x / this.cellSize);
        const z = Math.floor(pos.z / this.cellSize);
        const results: Entity[] = [];
        
        // Check 3x3 Grid
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
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
const burrowHash = new SpatialHash(SENSOR_RADIUS);


export const AgentSystem = (dt: number, params: SimulationParams, getAgentColor: (e: Entity) => {r:number, g:number, b:number}) => {
    const allAgents = agents.entities;
    const allFood = food.entities;
    const allBurrows = burrows.entities;
    
    // 0. Build Spatial Index (Optimization Step)
    agentHash.clear();
    foodHash.clear();
    burrowHash.clear();

    for (const a of allAgents) {
        // Only index active agents
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
        
        // Random scare event (Emergent panic)
        if (Math.random() < 0.001) { 
            agent.fear = 100;
        }

        const metabolicCost = params.energyCostPerTick * dt * agent.genes.size; 
        agent.energy -= metabolicCost;

        if (agent.energy <= 0 || agent.age > params.maxAge) {
            spawnParticle(position, 'death', getAgentColor(entity));
            world.remove(entity);
            continue;
        }

        // -------------------------
        // STATE MACHINE ARBITRATION
        // -------------------------

        // High priority: Hidden in burrow (Sleeping/Hiding)
        if (agent.currentBurrowId !== null) {
            agent.state = 'sleeping';
            agent.energy += ENERGY_REGEN_RATE * dt;
            velocity.set(0,0,0); // Pin position

            // Visual: Zzz particles
            if (Math.random() < dt * 2) {
                spawnParticle(position.clone().add(new Vector3(0,1,0)), 'zzz');
            }

            // Exit conditions
            if (agent.energy >= 85) {
                 agent.currentBurrowId = null;
                 agent.state = 'wandering';
                 // Pop out
                 position.y = 0;
            }
            continue; // Skip physics/movement
        }

        // 1. Fear / Fleeing
        if (agent.fear > 50) {
            agent.state = 'fleeing';
        }
        // 2. Digging (If tired, no burrow, and staying put)
        else if (agent.state === 'digging') {
            // Continued digging logic handled below
        }
        // 3. Resting/Sleeping (Low energy)
        else if (agent.energy < 20) {
             agent.state = 'seeking_food'; 
        }

        // -----------------------
        // PERCEPTION (OPTIMIZED)
        // -----------------------
        let nearestFood: Entity | null = null;
        let nearestFoodDist = Infinity;
        let nearestAgent: Entity | null = null;
        let nearestAgentDist = Infinity;
        let nearestBurrow: Entity | null = null;
        let nearestBurrowDist = Infinity;

        const maxDistSq = SENSOR_RADIUS * SENSOR_RADIUS;

        // Optimized: Scan only neighbors from Spatial Hash
        const nearbyFood = foodHash.query(position);
        for (const f of nearbyFood) {
            const distSq = position.distanceToSquared(f.position);
            if (distSq < maxDistSq && distSq < nearestFoodDist) {
                nearestFoodDist = distSq;
                nearestFood = f;
            }
        }

        // Optimized: Scan only neighbors from Spatial Hash
        const nearbyAgents = agentHash.query(position);
        for (const other of nearbyAgents) {
            if (other === entity) continue;
            
            const distSq = position.distanceToSquared(other.position);
            
            if (distSq < maxDistSq) {
                if(distSq < nearestAgentDist) {
                    nearestAgentDist = distSq;
                    nearestAgent = other;
                }

                // Emergent Affinity Update
                const otherGenes = other.agent!.genes;
                const geneticDiff = Math.abs(agent.genes.selfishness - otherGenes.selfishness) + Math.abs(agent.genes.size - otherGenes.size);
                
                const currentAffinity = agent.affinity[other.id] || 0;
                let change = 0;
                if (geneticDiff < 0.5) change += 15 * dt; 
                else change -= 5 * dt; 
                
                agent.affinity[other.id] = Math.max(-100, Math.min(100, currentAffinity + change));
            }
        }

        // Optimized: Scan only neighbors from Spatial Hash
        const nearbyBurrows = burrowHash.query(position);
        for (const b of nearbyBurrows) {
            const distSq = position.distanceToSquared(b.position);
            if (distSq < maxDistSq && distSq < nearestBurrowDist) {
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
            agent.digTimer += dt;
            agent.energy -= DIG_COST * dt;
            velocity.set(0,0,0);
            
            if (Math.random() < dt * 10) spawnParticle(position, 'dirt');

            if (agent.digTimer > DIG_THRESHOLD) {
                const b = spawnBurrow(position, entity.id, agent.genes.size);
                agent.ownedBurrowId = b.id;
                agent.currentBurrowId = b.id; // Enter immediately
                agent.state = 'sleeping';
                agent.digTimer = 0;
            } else if (agent.energy < 5) {
                agent.state = 'sleeping'; // Pass out
            }
            continue; 
        }

        // B. INTERACTION (Mating / Fighting)
        if (nearestAgent && distToAgent < interactionRadius && nearestAgent.agent) {
             const other = nearestAgent;
             const otherAgent = other.agent!;
             
             // Physics Push
             const overlap = interactionRadius - distToAgent;
             const normal = tempVec.subVectors(position, other.position).normalize();
             const massA = agent.genes.size;
             const massB = otherAgent.genes.size;
             const totalMass = massA + massB;
             if (overlap > 0) {
                 const pushDist = overlap * 0.8;
                 position.add(normal.clone().multiplyScalar((massB / totalMass) * pushDist));
                 other.position.sub(normal.clone().multiplyScalar((massA / totalMass) * pushDist));
             }

             // Affinity Check
             const affinity = agent.affinity[other.id] || 0;
             const isEnemy = affinity < -20;
             const isFriend = affinity > 10; 

             if (isEnemy) {
                 if (agent.genes.size > otherAgent.genes.size) {
                     agent.state = 'chasing';
                     agent.target = other.position;
                     agent.energy -= 10 * dt;
                     otherAgent.fear += 50 * dt; 
                 } else {
                     agent.fear += 20 * dt;
                 }
             } 
             
             // Mating
             if (isFriend && entity.id < other.id) {
                 const matingCooldown = 50; 
                 const MATURITY_AGE = 200;
                 const canMate = (a: typeof agent) => 
                    a.energy > params.reproductionThreshold && 
                    a.age > MATURITY_AGE && 
                    (a.age - a.lastMated) > matingCooldown;

                 if (canMate(agent) && canMate(otherAgent) && allAgents.length < MAX_POPULATION) {
                     agent.lastMated = agent.age;
                     otherAgent.lastMated = otherAgent.age;
                     agent.energy -= 40; 
                     otherAgent.energy -= 40;
                     
                     const mixedGenes = {
                         selfishness: (agent.genes.selfishness + otherAgent.genes.selfishness) / 2,
                         speed: (agent.genes.speed + otherAgent.genes.speed) / 2,
                         size: (agent.genes.size + otherAgent.genes.size) / 2,
                         mutationRate: (agent.genes.mutationRate + otherAgent.genes.mutationRate) / 2,
                         hue: 0
                     };
                     spawnParticle(position.clone().lerp(other.position, 0.5), 'heart');
                     spawnAgent(
                        position.clone().lerp(other.position, 0.5),
                        mutateGenome(mixedGenes, params.mutationMagnitude * 10 * mixedGenes.mutationRate),
                        80,
                        generateName(agent, otherAgent)
                     );
                 }
             }
        }

        // C. MOVEMENT & STATE TRANSITIONS
        
        // Hop Cycle
        const restDuration = 0.5 / (agent.genes.speed * 0.8 + 0.2); 
        const cycleTime = HOP_DURATION + restDuration;
        agent.hopTimer += dt;
        if (agent.hopTimer >= cycleTime) agent.hopTimer = 0;
        const isHopping = agent.hopTimer < HOP_DURATION;

        if (isHopping) {
            const steering = tempVec.set(0, 0, 0);
            let targetDistForSpeed = Infinity;

            // 1. FLEEING
            if (agent.state === 'fleeing') {
                const panicDir = new Vector3(rand(-1,1), 0, rand(-1,1)).normalize();
                steering.add(panicDir.multiplyScalar(3));
                agent.energy -= 20 * dt;
            } 
            // 2. CIRCLING (Play)
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
                
                if (Math.random() < dt * 0.5) agent.state = 'seeking_food';
            }
            // 3. SEEKING FOOD
            else if (nearestFood && nearestFood.food) {
                if (distToFood < 5 && agent.energy > 50 && agent.state !== 'circling' && Math.random() < 0.1) {
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
            // 4. SEEKING BURROW / DIGGING
            else if (agent.energy < 40) {
                if (agent.ownedBurrowId !== null) {
                    const myBurrow = allBurrows.find(b => b.id === agent.ownedBurrowId);
                    if (myBurrow) {
                        const dist = position.distanceTo(myBurrow.position);
                        targetDistForSpeed = dist;
                        if (dist < 1) {
                            agent.currentBurrowId = myBurrow.id;
                            position.y = -1; // Hide
                        } else {
                            tempVec2.subVectors(myBurrow.position, position).normalize().multiplyScalar(2.0);
                            steering.add(tempVec2);
                        }
                    } else {
                        agent.ownedBurrowId = null; 
                    }
                } else if (nearestBurrow && distToBurrow < 20) {
                     const toBurrow = tempVec2.subVectors(nearestBurrow.position, position).normalize();
                     steering.add(toBurrow);
                     targetDistForSpeed = distToBurrow;
                } else if (agent.energy < 30) {
                    // Check density before digging
                    if (distToBurrow > 8) {
                        agent.state = 'digging';
                        agent.digTimer = 0;
                    }
                }
            }
            // 5. WANDERING
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

            // Modulate speed by state
            let speedMult = 25.0; // Base faster for open world
            if (agent.state === 'fleeing') speedMult = 45.0; 
            else if (agent.state === 'circling') speedMult = 20.0;
            else if (agent.energy < 20) speedMult = 8.0;
            
            // Dynamic hop sizing logic
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
            // Landed
            velocity.set(0, 0, 0);
        }

        position.x = Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, position.x));
        position.z = Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, position.z));
    }
};