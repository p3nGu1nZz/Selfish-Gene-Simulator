import { Vector3 } from 'three';
import { world } from '../core/ecs';
import { Entity } from '../systems/types';

let nextBurrowId = 0;

export const resetBurrowId = () => {
    nextBurrowId = 0;
};

export const spawnBurrow = (position: Vector3, ownerId: number, size: number): Entity => {
    return world.add({
        id: nextBurrowId++,
        position: position.clone(),
        burrow: {
            ownerId,
            occupants: [],
            radius: size * 1.5 // Visual size relative to agent
        }
    });
};