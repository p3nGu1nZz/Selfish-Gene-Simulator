import { resetAgentId } from './Agent';
import { resetFoodId } from './Food';
import { resetBurrowId } from './Burrow';

export * from './Agent';
export * from './Food';
export * from './Particle';
export * from './Burrow';

export const resetIds = () => {
    resetAgentId();
    resetFoodId();
    resetBurrowId();
};