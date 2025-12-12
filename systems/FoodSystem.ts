import { Vector3 } from 'three';
import { world, food } from '../ecs';
import { SimulationParams } from '../types';
import { spawnFood } from '../entities/Food';
import { WORLD_SIZE } from '../constants';

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

export const FoodSystem = (dt: number, params: SimulationParams) => {
    if (Math.random() < params.foodSpawnRate * dt * 5) {
        // Safe spawn area calculation
        const margin = 15;
        const limit = (WORLD_SIZE / 2) - margin;

        const clusterX = rand(-limit, limit);
        const clusterZ = rand(-limit, limit);
        const count = rand(1, 3);
        
        for(let k=0; k<count; k++) {
            // Ensure even the cluster spread doesn't hit the wall
            const fx = Math.max(-limit, Math.min(limit, clusterX + rand(-5,5)));
            const fz = Math.max(-limit, Math.min(limit, clusterZ + rand(-5,5)));
            
            spawnFood(new Vector3(fx, 0, fz), params.foodValue);
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