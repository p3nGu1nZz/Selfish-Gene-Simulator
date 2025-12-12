import { Vector3, Color } from 'three';
import { world } from '../core/ecs';

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

export const spawnParticle = (pos: Vector3, type: 'birth' | 'death' | 'heart' | 'dirt' | 'zzz', color?: {r: number, g: number, b: number}) => {
    let count = 0;
    if (type === 'heart') count = 5;
    else if (type === 'birth') count = 20;
    else if (type === 'death') count = 15;
    else if (type === 'dirt') count = 3;
    else if (type === 'zzz') count = 1;
    
    for (let i = 0; i < count; i++) {
        const speed = type === 'birth' ? 3 : 4;
        let life = 1.0;
        
        let pColor;
        let velocity;
        let scale = 0.3;
        let rotation = 0;

        if (type === 'heart') {
            life = rand(2, 4);
            pColor = new Color(1, 0.4, 0.6);
            velocity = new Vector3(rand(-0.5, 0.5), rand(1, 3), rand(-0.5, 0.5));
            scale = rand(0.2, 0.5);
            rotation = rand(-0.5, 0.5);
        } else if (type === 'zzz') {
            life = 2.0;
            pColor = new Color(1, 1, 1);
            velocity = new Vector3(rand(-0.1, 0.1), 1.5, rand(-0.1, 0.1));
            scale = rand(0.2, 0.4);
        } else if (type === 'dirt') {
             life = 0.5;
             pColor = new Color(0.4, 0.3, 0.2);
             velocity = new Vector3(rand(-1, 1), rand(2, 4), rand(-1, 1));
             scale = rand(0.1, 0.3);
        } else if (type === 'birth') {
            life = rand(0.5, 1.2);
            // Mix between white/bright and parent color
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

        world.add({
            id: -1, 
            position: pos.clone().add(new Vector3(rand(-0.2, 0.2), rand(0, 0.5), rand(-0.2, 0.2))),
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