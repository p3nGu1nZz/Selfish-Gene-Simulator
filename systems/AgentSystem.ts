import { Vector3 } from 'three';
import { world, agents, food } from '../core/ecs';
import { Entity, SimulationParams } from '../types';
import { WORLD_SIZE, MAX_POPULATION, AGENT_RADIUS_BASE, MAX_SPEED_BASE, SENSOR_RADIUS, MAX_TRAIL_POINTS } from '../core/constants';
import { spawnParticle } from '../entities/Particle';
import { spawnAgent, mutateGenome, generateName } from '../entities/Agent';

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const tempVec = new Vector3();
const tempVec2 = new Vector3();

// Constants for physics/logic
const HOP_DURATION = 0.3; // Seconds spent in the air
const ENERGY_REGEN_RATE = 5; // Energy per second when resting

export const AgentSystem = (dt: number, params: SimulationParams, getAgentColor: (e: Entity) => {r:number, g:number, b:number}) => {
    const allAgents = agents.entities;
    const allFood = food.entities;
    
    for (const entity of allAgents) {
        const { agent, position, velocity } = entity;
        if (!agent || !velocity) continue;

        // 0. Update Trail
        if (velocity.lengthSq() > 0.01) {
            if (agent.trail.length === 0 || agent.trail[agent.trail.length-1].distanceToSquared(position) > 0.5) {
                agent.trail.push(position.clone());
                if (agent.trail.length > MAX_TRAIL_POINTS) {
                    agent.trail.shift();
                }
            }
        }

        // 1. Lifecycle & Energy
        agent.age += dt;
        
        // Base metabolic cost (existing just for being alive)
        const metabolicCost = params.energyCostPerTick * dt * agent.genes.size; 
        agent.energy -= metabolicCost;

        if (agent.energy <= 0 || agent.age > params.maxAge) {
            spawnParticle(position, 'death', getAgentColor(entity));
            world.remove(entity);
            continue;
        }

        // 2. State Management (Rest vs Active)
        
        // If energy is critical, force rest unless in danger (fleeing not impl here yet, but conceptually)
        // If energy is high, stop resting
        if (agent.state === 'resting') {
            // Regenerate
            agent.energy += ENERGY_REGEN_RATE * dt;
            velocity.set(0, 0, 0);
            
            // Wake up if full or disturbed (random chance to wake up early if somewhat recovered)
            if (agent.energy >= 90 || (agent.energy > 50 && Math.random() < dt)) {
                agent.state = 'wandering';
            }
        } else {
            // Check if we should sleep
            // Higher chance to sleep if energy is lower
            const fatigue = 1.0 - (agent.energy / 100);
            // Only sleep if we aren't chasing food or mating right this second? 
            // For now, simple logic: if tired and random tick, sleep.
            if (agent.energy < 30 && Math.random() < dt * 2) {
                agent.state = 'resting';
            }
        }

        // 3. Movement Cycle Logic
        if (agent.state !== 'resting') {
            // Cycle: Hop -> Land -> Rest/Wait -> Repeat
            // The wait duration depends on speed gene. Higher speed = less wait.
            const restDuration = 0.5 / (agent.genes.speed * 0.8 + 0.2); 
            const cycleTime = HOP_DURATION + restDuration;
            
            agent.hopTimer += dt;
            if (agent.hopTimer >= cycleTime) {
                agent.hopTimer = 0; // Reset cycle
            }
            
            const isHopping = agent.hopTimer < HOP_DURATION;
            
            // 4. Perception & Interaction
            // (We scan even if resting to detect threats, though threats aren't fully implemented, just food/mating)
            
            let nearestFood: Entity | null = null;
            let nearestFoodDist = Infinity;
            let nearestAgent: Entity | null = null;
            let nearestAgentDist = Infinity;

            // Scan Food
            for (const f of allFood) {
                const distSq = position.distanceToSquared(f.position);
                if (distSq < SENSOR_RADIUS * SENSOR_RADIUS && distSq < nearestFoodDist) {
                    nearestFoodDist = distSq;
                    nearestFood = f;
                }
            }

            // Scan Agents
            for (const other of allAgents) {
                if (other === entity) continue;
                const distSq = position.distanceToSquared(other.position);
                if (distSq < SENSOR_RADIUS * SENSOR_RADIUS && distSq < nearestAgentDist) {
                    nearestAgentDist = distSq;
                    nearestAgent = other;
                }
            }

            const distToFood = Math.sqrt(nearestFoodDist);
            const distToAgent = Math.sqrt(nearestAgentDist);
            const interactionRadius = (agent.genes.size + (nearestAgent?.agent?.genes.size || 1)) * AGENT_RADIUS_BASE;

            // --- Interactions (Happen regardless of hop cycle if close enough) ---
            if (nearestAgent && distToAgent < interactionRadius && nearestAgent.agent) {
                 const other = nearestAgent;
                 const otherAgent = other.agent!;
                 
                 // Push Physics
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
                 
                 // Selfishness/Mating Logic (Existing)
                 const mySelfish = agent.genes.selfishness > 0.5;
                 const otherSelfish = otherAgent.genes.selfishness > 0.5;

                 if (mySelfish && otherSelfish) {
                     const damage = 20 * dt;
                     agent.energy -= damage;
                     otherAgent.energy -= damage;
                 } else if (mySelfish && !otherSelfish) {
                     const steal = 15 * dt;
                     if (otherAgent.energy > steal) {
                         agent.energy += steal;
                         otherAgent.energy -= steal;
                     }
                 }

                 // Mating
                 if (entity.id < other.id) {
                     const matingCooldown = 50; 
                     const MATURITY_AGE = 200;
                     const canMate = (a: typeof agent) => 
                        a.energy > params.reproductionThreshold && 
                        a.age > MATURITY_AGE && 
                        (a.age - a.lastMated) > matingCooldown;

                     if (canMate(agent) && canMate(otherAgent) && allAgents.length < MAX_POPULATION) {
                         agent.lastMated = agent.age;
                         otherAgent.lastMated = otherAgent.age;
                         // Mating costs energy
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

            // --- Movement Physics ---
            if (isHopping) {
                const steering = tempVec.set(0, 0, 0);

                if (nearestFood && nearestFood.food) {
                    agent.target = nearestFood.position.clone();
                    agent.state = 'seeking_food';
                    
                    if (distToFood < (agent.genes.size * AGENT_RADIUS_BASE + 0.5)) {
                        // Eat
                        agent.energy += nearestFood.food.value;
                        world.remove(nearestFood);
                        agent.target = null;
                        // Don't stop hopping mid-air, but target is gone
                    } else {
                        tempVec2.subVectors(nearestFood.position, position).normalize().multiplyScalar(2.0);
                        steering.add(tempVec2);
                    }
                } else {
                    agent.state = 'wandering';
                    // Random wander with noise
                    const noise = new Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(1.0);
                    steering.add(noise);
                }

                // Bounds
                if (position.x > WORLD_SIZE/2 - 2) steering.x -= 10;
                if (position.x < -WORLD_SIZE/2 + 2) steering.x += 10;
                if (position.z > WORLD_SIZE/2 - 2) steering.z -= 10;
                if (position.z < -WORLD_SIZE/2 + 2) steering.z += 10;

                // Turn towards steering
                const targetDir = agent.heading.clone().multiplyScalar(0.5).add(steering).normalize();
                agent.heading.lerp(targetDir, 0.2).normalize();

                // Apply Hop Force
                // Force = Mass * Accel. Here we just set velocity.
                // High speed gene = Much longer hops
                const jumpForce = MAX_SPEED_BASE * (1 + agent.genes.speed * 2.0) * 15.0; // Significant multiplier for "Forward" hop
                
                velocity.copy(agent.heading).multiplyScalar(jumpForce);

                // Energy Expenditure for Movement
                // E = F * d (roughly). 
                // Cost increases with Size (Mass) and Speed^2
                const moveCost = 0.5 * agent.genes.size * (agent.genes.speed * agent.genes.speed) * params.energyCostPerTick * 5;
                agent.energy -= moveCost * dt;
                
                position.add(velocity.clone().multiplyScalar(dt));

            } else {
                // Landed / Waiting phase
                velocity.set(0, 0, 0);
            }
        }

        // Clamp Position
        position.x = Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, position.x));
        position.z = Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, position.z));
    }
};