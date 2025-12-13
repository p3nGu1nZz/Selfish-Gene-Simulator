import React from 'react';
import { useFrame } from '@react-three/fiber';
import { FoodSystem, AgentSystem, ParticleSystem, BurrowSystem } from './index';
import { SimulationParams, ViewMode } from './types';
import { agents } from '../core/ecs';
import { getAgentColorRGB } from '../core/utils';

interface LogicSystemProps {
    params: SimulationParams;
    paused: boolean;
    onStatsUpdate: (count: number, avgSelfishness: number) => void;
    viewMode: ViewMode;
    onTimeUpdate: (newTime: number) => void;
}

export const LogicSystem: React.FC<LogicSystemProps> = ({ params, paused, onStatsUpdate, viewMode, onTimeUpdate }) => {
    // We use a ref for time to avoid re-rendering this component unnecessarily, 
    // although params is passed in.
    
    useFrame((state, delta) => {
        const dt = paused ? 0 : Math.min(delta, 0.1) * params.simulationSpeed;
        
        // Update Time of Day
        if (!paused) {
            // 24 game hours = 120 real seconds (approx) at 1x speed
            // So 1 hour = 5 seconds
            // dt is in seconds.
            const realSecondsPerGameDay = 120;
            const hoursPerSecond = 24 / realSecondsPerGameDay;
            
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