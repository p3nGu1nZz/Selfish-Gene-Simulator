import { Vector3 } from 'three';
import { world } from '../core/ecs';
import { Entity } from '../core/types';

let nextBurrowId = 0;

export const resetBurrowId = () => {
    nextBurrowId = 0;
};

export const getNextBurrowId = () => nextBurrowId;
export const setNextBurrowId = (n: number) => { nextBurrowId = n; };

export const spawnBurrow = (position: Vector3, ownerId: number, size: number, existingData?: any, id?: number): Entity => {
    return world.add({
        id: id !== undefined ? id : nextBurrowId++,
        position: position.clone(),
        burrow: existingData ? existingData : {
            ownerId,
            occupants: [],
            radius: size * 1.5, // Visual size relative to agent
            digProgress: 0
        }
    });
};