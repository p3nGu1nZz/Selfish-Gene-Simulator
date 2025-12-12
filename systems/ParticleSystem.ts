import { world } from '../ecs';

export const ParticleSystem = (dt: number) => {
    for (const entity of world.with('particle', 'velocity', 'position')) {
         const { particle, position, velocity } = entity;
         particle.life -= dt;
         position.add(velocity.clone().multiplyScalar(dt * 5));
         velocity.y -= dt * 9.8; 
         
         if (position.y < 0) {
             position.y = 0;
             velocity.y *= -0.5;
         }

         if (particle.life <= 0) {
             world.remove(entity);
         }
    }
}