import { Vector3, Color } from 'three';
import { world } from '../core/ecs';
import { HEART_BURST_COUNT, HEART_LIFETIME, HEART_SIZE_MULT } from '../core/constants';

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

export const spawnParticle = (pos: Vector3, type: 'birth' | 'death' | 'heart' | 'dirt' | 'zzz', color?: {r: number, g: number, b: number}, scaleMult: number = 1.0) => {
    let count = 0;
    
    // Configurable parameters based on specs
    if (type === 'heart') count = HEART_BURST_COUNT; 
    else if (type === 'birth') count = 20;
    else if (type === 'death') count = 15;
    else if (type === 'dirt') count = 3; // Small loop per frame
    else if (type === 'zzz') count = 1;
    
    for (let i = 0; i < count; i++) {
        const speed = type === 'birth' ? 3 : 4;
        let life = 1.0;
        
        let pColor;
        let velocity;
        let scale = 0.3;
        let rotation = 0;

        if (type === 'heart') {
            life = HEART_LIFETIME; 
            pColor = new Color(1, 0.4, 0.6);
            
            // Soft outward velocity with slight upward drift
            // Random point in sphere for softness
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            const r = rand(0.5, 1.5);
            
            velocity = new Vector3(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta) + 2.0, // Upward bias
                r * Math.cos(phi)
            );
            
            // Explicit scale requirement: 1.8x base
            scale = rand(0.3, 0.5) * HEART_SIZE_MULT * scaleMult; 
            rotation = rand(-0.2, 0.2);

        } else if (type === 'zzz') {
            life = 2.5;
            pColor = new Color(1, 1, 1);
            // Slow bobbing upward, drifting slightly
            velocity = new Vector3(rand(-0.2, 0.2), 0.5, rand(-0.2, 0.2));
            scale = rand(0.4, 0.6) * scaleMult;

        } else if (type === 'dirt') {
             life = 0.5;
             pColor = new Color(0.35, 0.25, 0.15); // Darker brown
             // Downward/Outward from feet
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
            life = rand(0.5, 1.5);
            pColor = color ? new Color(color.r, color.g, color.b).multiplyScalar(0.7) : new Color(0.5, 0.5, 0.5);
            velocity = new Vector3(rand(-1, 1), rand(-1, 1) + 1, rand(-1, 1)).normalize().multiplyScalar(rand(1, 3) * speed);
        }

        // Adjust spawn position 
        const spawnPos = pos.clone();
        if (type === 'dirt') {
            // Spawn at feet level (origin is center body)
            spawnPos.y = 0.1;
            spawnPos.x += rand(-0.3, 0.3);
            spawnPos.z += rand(-0.3, 0.3);
        } else if (type === 'heart') {
             // Chest height approximate relative to rabbit
             spawnPos.y += 0.5 * scaleMult;
        } else if (type === 'zzz') {
             // Above head
             spawnPos.y += 1.2 * scaleMult;
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