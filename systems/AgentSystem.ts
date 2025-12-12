import { Vector3 } from 'three';
import { world, agents, food } from '../ecs';
import { Entity, SimulationParams } from '../types';
import { WORLD_SIZE, MAX_POPULATION, AGENT_RADIUS_BASE, MAX_SPEED_BASE, SENSOR_RADIUS } from '../constants';
import { spawnParticle } from '../entities/Particle';
import { spawnAgent, mutateGenome } from '../entities/Agent';

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const tempVec = new Vector3();
const tempVec2 = new Vector3();

export const AgentSystem = (dt: number, params: SimulationParams, getAgentColor: (e: Entity) => {r:number, g:number, b:number}) => {
    const allAgents = agents.entities;
    const allFood = food.entities;
    
    for (const entity of allAgents) {
        const { agent, position, velocity } = entity;
        if (!agent || !velocity) continue;

        // 1. Lifecycle
        agent.age += dt;
        const energyCost = params.energyCostPerTick * dt * (0.5 * agent.genes.size + 0.5 * agent.genes.speed * agent.genes.speed);
        agent.energy -= energyCost;

        if (agent.energy <= 0 || agent.age > params.maxAge) {
            spawnParticle(position, 'death', getAgentColor(entity));
            world.remove(entity);
            continue;
        }

        // 2. Perception
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

        // 3. Interaction (Physics & Genes)
        if (nearestAgent && distToAgent < interactionRadius && nearestAgent.agent && nearestAgent.velocity) {
             const other = nearestAgent;
             const otherAgent = other.agent!;
             
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

             const bumpForce = 5.0 * dt;
             velocity.add(normal.clone().multiplyScalar(bumpForce / massA));
             nearestAgent.velocity!.sub(normal.clone().multiplyScalar(bumpForce / massB));

             const mySelfish = agent.genes.selfishness > 0.5;
             const otherSelfish = otherAgent.genes.selfishness > 0.5;

             if (mySelfish && otherSelfish) {
                 const damage = 20 * dt;
                 agent.energy -= damage;
                 otherAgent.energy -= damage;
                 velocity.add(normal.clone().multiplyScalar(10 * dt));
             } else if (mySelfish && !otherSelfish) {
                 const steal = 15 * dt;
                 if (otherAgent.energy > steal) {
                     agent.energy += steal;
                     otherAgent.energy -= steal;
                 }
             }
        }

        // 4. Movement Behavior
        const accel = tempVec.set(0, 0, 0);

        if (nearestFood && nearestFood.food) {
            agent.target = nearestFood.position.clone();
            agent.state = 'seeking_food';
            
            if (distToFood < (agent.genes.size * AGENT_RADIUS_BASE + 0.5)) {
                // Eat
                agent.energy += nearestFood.food.value;
                world.remove(nearestFood);
                agent.target = null;
            } else {
                tempVec2.subVectors(nearestFood.position, position).normalize().multiplyScalar(2.0);
                accel.add(tempVec2);
            }
        } else {
            agent.state = 'wandering';
            agent.target = null;
            const noise = new Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(0.5);
            accel.add(noise);
        }

        // World Bounds
        if (position.x > WORLD_SIZE/2 - 2) accel.x -= 5;
        if (position.x < -WORLD_SIZE/2 + 2) accel.x += 5;
        if (position.z > WORLD_SIZE/2 - 2) accel.z -= 5;
        if (position.z < -WORLD_SIZE/2 + 2) accel.z += 5;

        velocity.add(accel.multiplyScalar(dt));
        const maxSpeed = MAX_SPEED_BASE * agent.genes.speed;
        if (velocity.length() > maxSpeed) {
            velocity.normalize().multiplyScalar(maxSpeed);
        }

        position.add(velocity.clone().multiplyScalar(dt * 10));
        
        // Clamp
        position.x = Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, position.x));
        position.z = Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, position.z));

        // 5. Reproduction
        if (agent.energy > params.reproductionThreshold && allAgents.length < MAX_POPULATION) {
            agent.energy *= 0.5;
            const offspringGenes = mutateGenome(agent.genes, params.mutationMagnitude * 10 * agent.genes.mutationRate);
            spawnParticle(position, 'birth');
            
            spawnAgent(
                position.clone().add(new Vector3(rand(-1,1), 0, rand(-1,1))),
                offspringGenes,
                agent.energy
            ).velocity!.copy(velocity).multiplyScalar(-1);
        }
    }
};