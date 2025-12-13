import React from 'react';
import { useFrame } from '@react-three/fiber';
import { FoodSystem, AgentSystem, ParticleSystem, BurrowSystem } from './index';
import { SimulationParams, ViewMode, AgentData } from '../core/types';
import { agents } from '../core/ecs';
import { getAgentColorRGB } from '../core/utils';
import { REAL_SECONDS_PER_GAME_DAY } from '../core/constants';

interface LogicSystemProps {
    params: SimulationParams;
    paused: boolean;
    onStatsUpdate: (count: number, avgSelfishness: number) => void;
    onAgentUpdate: (data: AgentData | null) => void;
    selectedAgentId: number | null;
    viewMode: ViewMode;
    onTimeUpdate: (newTime: number) => void;
}

export const LogicSystem: React.FC<LogicSystemProps> = ({ 
    params, 
    paused, 
    onStatsUpdate, 
    onAgentUpdate,
    selectedAgentId,
    viewMode, 
    onTimeUpdate 
}) => {
    useFrame((state, delta) => {
        const dt = paused ? 0 : Math.min(delta, 0.1) * params.simulationSpeed;
        
        // Time Cycle Logic
        if (!paused) {
            const hoursPerSecond = 24 / REAL_SECONDS_PER_GAME_DAY;
            let newTime = params.timeOfDay + (dt * hoursPerSecond);
            if (newTime >= 24) newTime = 0;
            onTimeUpdate(newTime);
        }

        if (!paused) {
            FoodSystem(dt, params);
            AgentSystem(dt, params, (e) => getAgentColorRGB(e.agent!, viewMode));
            BurrowSystem(dt);
        }
        
        if (!paused) {
            ParticleSystem(dt);
        }

        // Low frequency updates (2Hz)
        if (state.clock.elapsedTime % 0.5 < 0.1) {
            const allAgents = agents.entities;
            let totalSelfishness = 0;
            let selectedData: AgentData | null = null;

            for(const e of allAgents) {
                if(e.agent) {
                    totalSelfishness += e.agent.genes.selfishness;
                    if (e.id === selectedAgentId) {
                        selectedData = { ...e.agent }; // Clone to avoid mutation issues in UI
                    }
                }
            }
            onStatsUpdate(allAgents.length, allAgents.length > 0 ? totalSelfishness / allAgents.length : 0);
            onAgentUpdate(selectedData);
        }
    });
    return null;
}