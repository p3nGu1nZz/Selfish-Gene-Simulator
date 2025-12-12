import React from 'react';
import { BufferGeometry, Material } from 'three';
import { ViewMode, Entity } from './types';
import { EnvironmentLayer } from './renderer/EnvironmentLayer';
import { InteractionLayer } from './renderer/InteractionLayer';
import { AgentLayer } from './renderer/AgentLayer';
import { TrailLayer } from './renderer/TrailLayer';
import { FoodLayer } from './renderer/FoodLayer';
import { ParticleLayer } from './renderer/ParticleLayer';
import { BurrowLayer } from './renderer/BurrowLayer';

export interface RendererProps {
    paused: boolean;
    viewMode: ViewMode;
    onHoverAgent: (agent: Entity | null) => void;
    hoveredAgent: Entity | null;
    onSelectAgent: (agent: Entity | null) => void;
    selectedAgent: Entity | null;
    showEnergyBars: boolean;
    externalGeometry?: BufferGeometry;
    foodModels?: { geometry: BufferGeometry; material: Material }[];
}

export const RendererSystem: React.FC<RendererProps> = ({ 
    viewMode, 
    onHoverAgent, 
    hoveredAgent, 
    onSelectAgent, 
    selectedAgent, 
    showEnergyBars, 
    externalGeometry,
    foodModels
}) => {
    return (
        <group>
            <EnvironmentLayer onSelectAgent={onSelectAgent} />
            <BurrowLayer />
            <InteractionLayer 
                onHoverAgent={onHoverAgent}
                hoveredAgent={hoveredAgent}
                onSelectAgent={onSelectAgent}
                selectedAgent={selectedAgent}
            />
            <AgentLayer 
                viewMode={viewMode}
                externalGeometry={externalGeometry}
                showEnergyBars={showEnergyBars}
            />
            <TrailLayer viewMode={viewMode} />
            <FoodLayer models={foodModels} />
            <ParticleLayer />
        </group>
    );
};