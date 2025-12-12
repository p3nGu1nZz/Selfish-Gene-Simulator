import React from 'react';
import { useFrame } from '@react-three/fiber';
import { FoodSystem, AgentSystem, ParticleSystem } from './index';
import { SimulationParams, ViewMode } from '../types';
import { agents } from '../ecs';
import { getAgentColorRGB } from './Renderer';

interface SimulationSystemProps {
    params: SimulationParams;
    paused: boolean;
    onStatsUpdate: (count: number, avgSelfishness: number) => void;
    viewMode: ViewMode;
}

export const SimulationSystem: React.FC<SimulationSystemProps> = ({ params, paused, onStatsUpdate, viewMode }) => {
    useFrame((state, delta) => {
        const dt = paused ? 0 : Math.min(delta, 0.1) * params.simulationSpeed;
        
        if (!paused) {
            FoodSystem(dt, params);
            AgentSystem(dt, params, (e) => getAgentColorRGB(e.agent!, viewMode));
        }
        
        if (!paused) {
            ParticleSystem(dt);
        }

        if (state.clock.elapsedTime % 0.5 < 0.1) {
            const allAgents = agents.entities;
            let totalSelfishness = 0;
            for(const e of allAgents) {
                if(e.agent) totalSelfishness += e.agent.genes.selfishness;
            }
            onStatsUpdate(allAgents.length, allAgents.length > 0 ? totalSelfishness / allAgents.length : 0);
        }
    });
    return null;
}