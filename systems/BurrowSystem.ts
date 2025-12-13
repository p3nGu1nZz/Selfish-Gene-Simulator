import { burrows } from '../core/ecs';
import { spawnParticle } from '../entities/Particle';

export const BurrowSystem = (dt: number) => {
    for (const entity of burrows.entities) {
        if (!entity.burrow) continue;
        const b = entity.burrow;

        // Animation: Grow from 0 to 1
        if (b.digProgress < 1.0) {
            // Speed of growth
            b.digProgress += dt * 3.0; 
            
            if (b.digProgress >= 1.0) {
                b.digProgress = 1.0;
                
                // Final burst of dirt when complete
                for(let i=0; i<5; i++) {
                    spawnParticle(entity.position, 'dirt');
                }
            } else {
                // Ongoing crumbling effect while growing
                if (Math.random() < 0.3) {
                    spawnParticle(entity.position, 'dirt');
                }
            }
        }
    }
};