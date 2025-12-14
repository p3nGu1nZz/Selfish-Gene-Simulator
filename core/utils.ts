import { ViewMode } from './types';
import { Color } from 'three';

const tempColor = new Color();

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
    } else if (viewMode === 'mutation') {
        const s = agentData.genes.mutationRate * 5; 
        r = 0.5 + s * 0.5; g = 0.5; b = 0.5 + s * 0.5;
    } else if (viewMode === 'energy') {
        // Yellow scale
        const s = agentData.genes.energy;
        r = s;
        g = s * 0.9;
        b = 0.2; 
    } else if (viewMode === 'fertility') {
        // Pink/Purple scale
        const s = agentData.genes.fertility;
        r = 0.9;
        g = 0.2 + (s * 0.4);
        b = 0.6 + (s * 0.4);
    } else if (viewMode === 'affinity') {
        // Inheritance Mode: Use the inherited Hue gene
        // Saturation and Lightness are fixed/high to ensure visibility
        tempColor.setHSL(agentData.genes.hue, 0.75, 0.6);
        r = tempColor.r;
        g = tempColor.g;
        b = tempColor.b;
    } else {
        r = 1; g = 1; b = 1;
    }
    return { r, g, b };
};