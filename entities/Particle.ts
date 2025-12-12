import { Vector3, Color } from 'three';
import { world } from '../core/ecs';

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

export const spawnParticle = (pos: Vector3, type: 'birth' | 'death' | 'heart', color?: {r: number, g: number, b: number}) => {
    const isHeart = type === 'heart';
    const count = isHeart ? 5 : (type === 'birth' ? 20 : 15);
    
    for (let i = 0; i < count; i++) {
        const speed = type === 'birth' ? 3 : 4;
        const life = isHeart ? rand(2, 4) : (type === 'birth' ? rand(0.5, 1.2) : rand(0.5, 1.5));
        
        let pColor;
        if (isHeart) {
            pColor = new Color(1, 0.4, 0.6); // Pinkish red
        } else if (type === 'birth') {
            // Mix between white/bright and parent color for birth
            const mix = Math.random();
            if (color && mix > 0.4) {
                 // Bright version of parent color
                 pColor = new Color(color.r, color.g, color.b).multiplyScalar(1.2);
                 pColor.lerp(new Color(1, 1, 1), 0.3);
            } else {
                 pColor = new Color(1, 1, 0.9); // Bright warm white
            }
        } else {
            pColor = color ? new Color(color.r, color.g, color.b).multiplyScalar(0.7) : new Color(0.5, 0.5, 0.5);
        }

        // Velocity distribution
        let velocity;
        if (isHeart) {
            // Float up gently
            velocity = new Vector3(rand(-0.5, 0.5), rand(1, 3), rand(-0.5, 0.5));
        } else if (type === 'birth') {
            // Starburst effect
            velocity = new Vector3(rand(-1, 1), rand(-0.5, 1.5), rand(-1, 1)).normalize().multiplyScalar(rand(1, 3) * speed);
        } else {
            // Death crumble/poof
            velocity = new Vector3(rand(-1, 1), rand(-1, 1) + 1, rand(-1, 1)).normalize().multiplyScalar(rand(1, 3) * speed);
        }

        world.add({
            id: -1, // Particles don't need strict IDs
            position: pos.clone().add(new Vector3(rand(-0.2, 0.2), rand(0, 0.5), rand(-0.2, 0.2))),
            velocity: velocity,
            particle: {
                type: isHeart ? 'heart' : 'particle',
                life,
                maxLife: life,
                color: pColor,
                scale: isHeart ? rand(0.2, 0.5) : rand(0.1, 0.4),
                rotation: isHeart ? rand(-0.5, 0.5) : 0
            }
        });
    }
};