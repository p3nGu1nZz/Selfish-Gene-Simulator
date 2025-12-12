import { Vector3, Color } from 'three';
import { world } from '../ecs';

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

export const spawnParticle = (pos: Vector3, type: 'birth' | 'death', color?: {r: number, g: number, b: number}) => {
    const count = type === 'birth' ? 10 : 15;
    for (let i = 0; i < count; i++) {
        const speed = type === 'birth' ? 2 : 4;
        const life = type === 'birth' ? rand(0.5, 1.0) : rand(0.5, 1.5);
        
        let pColor;
        if (type === 'birth') {
            pColor = new Color(1, 1, 0.8);
        } else {
            pColor = color ? new Color(color.r, color.g, color.b).multiplyScalar(0.7) : new Color(0.5, 0.5, 0.5);
        }

        world.add({
            id: -1, // Particles don't need strict IDs
            position: pos.clone().add(new Vector3(rand(-0.2, 0.2), rand(0, 0.5), rand(-0.2, 0.2))),
            velocity: new Vector3(rand(-1, 1), rand(-1, 1) + (type === 'birth' ? 1 : 0), rand(-1, 1)).normalize().multiplyScalar(rand(1, 3) * speed),
            particle: {
                life,
                maxLife: life,
                color: pColor,
                scale: rand(0.1, 0.3)
            }
        });
    }
};