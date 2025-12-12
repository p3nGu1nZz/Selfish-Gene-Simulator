import { ViewMode } from '../types';

export const getAgentColorRGB = (agentData: any, viewMode: ViewMode): {r: number, g: number, b: number} => {
    let r, g, b;
    if (viewMode === 'selfishness') {
        const s = agentData.genes.selfishness;
        r = 0.29 + (0.97 - 0.29) * s;
        g = 0.87 + (0.44 - 0.87) * s;
        b = 0.50 + (0.44 - 0.50) * s;
    } else if (viewMode === 'speed') {
        const s = (agentData.genes.speed - 0.5) / 2.5; 
        r = s; g = s; b = 1.0 - s * 0.5;
    } else if (viewMode === 'size') {
        const s = (agentData.genes.size - 0.5) / 1.5;
        r = 0.5 + s * 0.5; g = s * 0.5; b = 0.8 - s * 0.8;
    } else { // Mutation
        const s = agentData.genes.mutationRate * 5; 
        r = 0.5 + s * 0.5; g = 0.5; b = 0.5 + s * 0.5;
    }
    return { r, g, b };
};