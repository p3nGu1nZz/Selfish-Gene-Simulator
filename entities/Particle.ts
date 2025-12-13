import { Vector3, Color } from 'three';
import { world } from '../core/ecs';

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

export const spawnParticle = (pos: Vector3, type: 'birth' | 'death' | 'heart' | 'dirt' | 'zzz', color?: {r: number, g: number, b: number}, scaleMult: number = 1.0) => {
    let count = 0;
    
    // Configurable parameters for quick iteration
    if (type === 'heart') count = 10; // Burst of 8-12
    else if (type === 'birth') count = 20;
    else if (type === 'death') count = 15;
    else if (type === 'dirt') count = 2; // Small loop per frame
    else if (type === 'zzz') count = 1;
    
    for (let i = 0; i < count; i++) {
        const speed = type === 'birth' ? 3 : 4;
        let life = 1.0;
        
        let pColor;
        let velocity;
        let scale = 0.3;
        let rotation = 0;

        if (type === 'heart') {
            life = 0.9; // Specified 0.9s
            pColor = new Color(1, 0.4, 0.6);
            
            // Soft outward velocity + slight upward drift
            const angle = rand(0, Math.PI * 2);
            const radius = rand(0.2, 0.5);
            velocity = new Vector3(Math.cos(angle) * radius, rand(1.5, 3.0), Math.sin(angle) * radius);
            
            // Larger scale (~1.8x original) + rabbit scale multiplier
            scale = rand(0.4, 0.7) * scaleMult; 
            rotation = rand(-0.5, 0.5);

        } else if (type === 'zzz') {
            life = 2.0;
            pColor = new Color(1, 1, 1);
            // Slow bobbing upward
            velocity = new Vector3(rand(-0.1, 0.1), 0.8, rand(-0.1, 0.1));
            scale = rand(0.3, 0.5) * scaleMult;

        } else if (type === 'dirt') {
             life = 0.6;
             pColor = new Color(0.35, 0.25, 0.15); // Darker brown
             // Downward/Outward from feet
             velocity = new Vector3(rand(-1, 1), rand(1, 2), rand(-1, 1));
             scale = rand(0.15, 0.35);

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
            life = rand(0.5, 1.5);
            pColor = color ? new Color(color.r, color.g, color.b).multiplyScalar(0.7) : new Color(0.5, 0.5, 0.5);
            velocity = new Vector3(rand(-1, 1), rand(-1, 1) + 1, rand(-1, 1)).normalize().multiplyScalar(rand(1, 3) * speed);
        }

        // Adjust spawn position slightly
        const spawnPos = pos.clone();
        if (type === 'dirt') {
            // Spawn at feet level
            spawnPos.y = 0.1;
            spawnPos.x += rand(-0.2, 0.2);
            spawnPos.z += rand(-0.2, 0.2);
        } else if (type === 'heart') {
             // Chest height approximate
             spawnPos.y += 0.5 * scaleMult;
             spawnPos.x += rand(-0.1, 0.1);
             spawnPos.z += rand(-0.1, 0.1);
        }

        world.add({
            id: -1, 
            position: spawnPos,
            velocity: velocity,
            particle: {
                type: type === 'heart' ? 'heart' : (type === 'zzz' ? 'zzz' : 'particle'),
                life,
                maxLife: life,
                color: pColor,
                scale,
                rotation
            }
        });
    }
};