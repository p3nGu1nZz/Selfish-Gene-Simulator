import { Vector3, Color } from 'three';
import { world } from '../core/ecs';

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

export const spawnParticle = (pos: Vector3, type: 'birth' | 'death' | 'dirt', color?: {r: number, g: number, b: number}, scaleMult: number = 1.0) => {
    let count = 0;
    
    if (type === 'birth') count = 20;
    else if (type === 'death') count = 15;
    else if (type === 'dirt') count = 3; 
    
    for (let i = 0; i < count; i++) {
        const speed = type === 'birth' ? 3 : 4;
        let life = 1.0;
        
        let pColor;
        let velocity;
        let scale = 0.3;
        let rotation = 0;

        if (type === 'dirt') {
             life = 0.5;
             pColor = new Color(0.35, 0.25, 0.15); // Darker brown
             velocity = new Vector3(rand(-1.5, 1.5), rand(1, 2.5), rand(-1.5, 1.5));
             scale = rand(0.15, 0.3);

        } else if (type === 'birth') {
            life = rand(0.5, 1.2);
            const mix = Math.random();
            if (color && mix > 0.4) {
                 pColor = new Color(color.r, color.g, color.b).multiplyScalar(1.2);
                 pColor.lerp(new Color(1, 1, 1), 0.3);
            } else {
                 pColor = new Color(1, 1, 0.9);
            }
            velocity = new Vector3(rand(-1, 1), rand(-0.5, 1.5), rand(-1, 1)).normalize().multiplyScalar(rand(1, 3) * speed);

        } else {
            // Death/Generic
            life = rand(0.5, 1.5);
            pColor = color ? new Color(color.r, color.g, color.b).multiplyScalar(0.7) : new Color(0.5, 0.5, 0.5);
            velocity = new Vector3(rand(-1, 1), rand(-1, 1) + 1, rand(-1, 1)).normalize().multiplyScalar(rand(1, 3) * speed);
        }

        // Adjust spawn position 
        const spawnPos = pos.clone();
        if (type === 'dirt') {
            spawnPos.y = 0.1;
            spawnPos.x += rand(-0.3, 0.3);
            spawnPos.z += rand(-0.3, 0.3);
        }

        world.add({
            id: -1, 
            position: spawnPos,
            velocity: velocity,
            particle: {
                type: type,
                life,
                maxLife: life,
                color: pColor,
                scale,
                rotation
            }
        });
    }
};