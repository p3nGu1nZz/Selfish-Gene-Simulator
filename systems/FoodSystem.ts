import { Vector3 } from 'three';
import { world, food, burrows } from '../core/ecs';
import { SimulationParams } from '../core/types';
import { spawnFood } from '../entities/Food';
import { WORLD_SIZE, MIN_BURROW_SPACING } from '../core/constants';

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

export const FoodSystem = (dt: number, params: SimulationParams) => {
    if (Math.random() < params.foodSpawnRate * dt * 5) {
        // Safe spawn area calculation
        const margin = 15;
        const limit = (WORLD_SIZE / 2) - margin;

        const clusterX = rand(-limit, limit);
        const clusterZ = rand(-limit, limit);
        const count = rand(1, 3);
        
        const allBurrows = burrows.entities;
        const spacingSq = MIN_BURROW_SPACING * MIN_BURROW_SPACING;

        for(let k=0; k<count; k++) {
            // Ensure even the cluster spread doesn't hit the wall
            const fx = Math.max(-limit, Math.min(limit, clusterX + rand(-5,5)));
            const fz = Math.max(-limit, Math.min(limit, clusterZ + rand(-5,5)));
            const pos = new Vector3(fx, 0, fz);

            // Check distance to all burrows using the new MIN_BURROW_SPACING constant
            let tooClose = false;
            for(const b of allBurrows) {
                if(b.position.distanceToSquared(pos) < spacingSq) { 
                    tooClose = true;
                    break;
                }
            }

            if (!tooClose) {
                spawnFood(pos, params.foodValue);
            }
        }
    }
    
    // Limit food count
    const allFood = food.entities;
    if (allFood.length > 300) {
        // Remove oldest (roughly, based on index)
        for(let i=0; i< allFood.length - 300; i++) {
             world.remove(allFood[i]);
        }
    }
};