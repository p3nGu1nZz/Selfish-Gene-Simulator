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

export const AgentSystem = (dt: number, params: SimulationParams, getAgentColor: (e: Entity) => {r:number, g:number, b:number}) => {
    const allAgents = agents.entities;
    const allFood = food.entities;
    const allBurrows = burrows.entities;
    
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
        // Selfish agents scare easier? Or maybe solitary ones.
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

            // Exit conditions: Full energy or Scared or Hunger
            // Lowered threshold to 85 so they don't hide forever
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
        // 3. Resting/Sleeping (Low energy, try to find burrow or sleep on ground)
        else if (agent.energy < 20) {
             agent.state = 'seeking_food'; // Hunger overrides sleep usually, but if NO food...
             // Check nearest food, if none nearby, sleep
             // Logic handled in movement
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

        // Scan Food
        for (const f of allFood) {
            const distSq = position.distanceToSquared(f.position);
            if (distSq < SENSOR_RADIUS * SENSOR_RADIUS && distSq < nearestFoodDist) {
                nearestFoodDist = distSq;
                nearestFood = f;
            }
        }

        // Scan Agents & Update Affinity
        for (const other of allAgents) {
            if (other === entity) continue;
            // Skip hidden agents
            if (other.agent?.currentBurrowId) continue;

            const distSq = position.distanceToSquared(other.position);
            
            if (distSq < SENSOR_RADIUS * SENSOR_RADIUS) {
                if(distSq < nearestAgentDist) {
                    nearestAgentDist = distSq;
                    nearestAgent = other;
                }

                // Emergent Affinity Update
                // Genes: Similar hue/genes = +Affinity
                const otherGenes = other.agent!.genes;
                const geneticDiff = Math.abs(agent.genes.selfishness - otherGenes.selfishness) + Math.abs(agent.genes.size - otherGenes.size);
                
                // If close, update affinity faster
                const currentAffinity = agent.affinity[other.id] || 0;
                let change = 0;
                if (geneticDiff < 0.5) change += 15 * dt; // Faster friend making
                else change -= 5 * dt; // Not like me
                
                agent.affinity[other.id] = Math.max(-100, Math.min(100, currentAffinity + change));
            }
        }

        // Scan Burrows
        for (const b of allBurrows) {
            const distSq = position.distanceToSquared(b.position);
            if (distSq < SENSOR_RADIUS * SENSOR_RADIUS && distSq < nearestBurrowDist) {
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
            
            // Particles
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
             const isFriend = affinity > 10; // Lower threshold to make friends easier

             if (isEnemy) {
                 // Fight or Flee based on size
                 if (agent.genes.size > otherAgent.genes.size) {
                     agent.state = 'chasing';
                     agent.target = other.position;
                     agent.energy -= 10 * dt;
                     otherAgent.fear += 50 * dt; // Scare them
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
                // Run random or away from center? Run randomly fast.
                const panicDir = new Vector3(rand(-1,1), 0, rand(-1,1)).normalize();
                steering.add(panicDir.multiplyScalar(3));
                // High energy cost
                agent.energy -= 20 * dt;
                
            } 
            // 2. CIRCLING (Play)
            else if (agent.state === 'circling' && agent.target) {
                // Move perpendicular to target vector
                const toTarget = tempVec2.subVectors(agent.target, position);
                const dist = toTarget.length();
                if (dist < 1 || dist > 10) {
                     agent.state = 'wandering'; // Break circle
                } else {
                    const perp = new Vector3(-toTarget.z, 0, toTarget.x).normalize();
                    steering.add(perp.multiplyScalar(2));
                    // Slight pull in to keep orbit
                    steering.add(toTarget.normalize().multiplyScalar(0.5));
                }
                
                // End circling randomly
                if (Math.random() < dt * 0.5) agent.state = 'seeking_food';
            }
            // 3. SEEKING FOOD
            else if (nearestFood && nearestFood.food) {
                
                // Logic: If not starving, maybe circle it first?
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
                    // Go to owned burrow
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
                        agent.ownedBurrowId = null; // Burrow destroyed?
                    }
                } else if (nearestBurrow && distToBurrow < 20) {
                     // Try to share? Check owner affinity?
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
            if (agent.state === 'fleeing') speedMult = 45.0; // Much faster flee
            else if (agent.state === 'circling') speedMult = 20.0;
            else if (agent.energy < 20) speedMult = 8.0;
            
            // Dynamic hop sizing logic
            if (targetDistForSpeed < 15.0 && agent.state !== 'fleeing') {
                // Scale speed down as we get closer to target for precision landing
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