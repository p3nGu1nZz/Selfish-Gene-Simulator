import React from 'react';
import '@react-three/fiber';
import { BufferGeometry, Material } from 'three';
import { ViewMode } from '../../core/types';
import { EnvironmentLayer } from './EnvironmentLayer';
import { AgentLayer } from './AgentLayer';
import { TrailLayer } from './TrailLayer';
import { FoodLayer } from './FoodLayer';
import { ParticleLayer } from './ParticleLayer';
import { BurrowLayer } from './BurrowLayer';
import { InteractionLayer } from './InteractionLayer';
import { SkyLayer } from './SkyLayer';
import { ThoughtBubbleLayer } from './ThoughtBubbleLayer';

export interface RendererProps {
    paused: boolean;
    viewMode: ViewMode;
    showEnergyBars: boolean;
    showTrails: boolean;
    showGrid: boolean;
    externalGeometry?: BufferGeometry;
    foodModels?: { geometry: BufferGeometry; material: Material }[];
    selectedAgentId: number | null;
    onSelectAgent: (id: number | null) => void;
    timeOfDay?: number;
}

export const RenderSystem: React.FC<RendererProps> = ({ 
    viewMode, 
    showEnergyBars,
    showTrails,
    showGrid,
    externalGeometry,
    foodModels,
    selectedAgentId,
    onSelectAgent,
    timeOfDay = 8
}) => {
    return (
        <group>
            <SkyLayer timeOfDay={timeOfDay} />
            <EnvironmentLayer onSelectAgent={onSelectAgent} showGrid={showGrid} />
            <BurrowLayer />
            <AgentLayer 
                viewMode={viewMode}
                externalGeometry={externalGeometry}
                showEnergyBars={showEnergyBars}
            />
            {showTrails ? <TrailLayer viewMode={viewMode} /> : null}
            <FoodLayer models={foodModels} />
            <ParticleLayer />
            <ThoughtBubbleLayer />
            <InteractionLayer selectedAgentId={selectedAgentId} onSelectAgent={onSelectAgent} />
        </group>
    );
};