import { resetAgentId } from './../entities/Agent';
import { resetFoodId } from './../entities/Food';
import { resetBurrowId } from './../entities/Burrow';

export * from './AgentSystem';
export * from './FoodSystem';
export * from './ParticleSystem';
export * from './BurrowSystem';

export const resetIds = () => {
    resetAgentId();
    resetFoodId();
    resetBurrowId();
};