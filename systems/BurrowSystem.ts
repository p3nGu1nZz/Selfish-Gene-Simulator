import { burrows } from '../core/ecs';

export const BurrowSystem = (dt: number) => {
    // Logic moved to AgentSystem. This system currently acts as a placeholder or could be used for decay.
    // We keep it to avoid breaking imports in LogicSystem, and potentially for future logic like burrow degradation.
    for (const entity of burrows.entities) {
        if (!entity.burrow) continue;
        // Currently no autonomous behavior for burrows
    }
};