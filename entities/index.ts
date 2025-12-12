import { resetAgentId } from './Agent';
import { resetFoodId } from './Food';

export * from './Agent';
export * from './Food';
export * from './Particle';

export const resetIds = () => {
    resetAgentId();
    resetFoodId();
};