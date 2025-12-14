import { Vector3 } from 'three';
import { world } from '../core/ecs';
import { WORLD_SIZE } from '../core/constants';

let nextFoodId = 0;

export const resetFoodId = () => {
    nextFoodId = 0;
};

export const getNextFoodId = () => nextFoodId;
export const setNextFoodId = (n: number) => { nextFoodId = n; };

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

export const spawnFood = (pos?: Vector3, value?: number, id?: number) => {
    // Keep food away from the absolute edges to prevent agents getting stuck on walls
    const margin = 10;
    const limit = (WORLD_SIZE / 2) - margin;
    
    const position = pos ? pos.clone() : new Vector3(rand(-limit, limit), 0, rand(-limit, limit));
    
    world.add({
        id: id !== undefined ? id : nextFoodId++,
        position,
        food: {
            value: value || 40
        }
    });
};