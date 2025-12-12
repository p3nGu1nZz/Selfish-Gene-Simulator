import React, { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { BufferGeometry, Mesh, CapsuleGeometry } from 'three';
import { SimulationParams, ViewMode, Entity } from '../types';
import { clearWorld } from '../ecs';
import { spawnAgent, spawnFood, resetIds } from '../entities';
import { SimulationSystem } from '../systems/Simulation';
import { RendererSystem } from '../systems/Renderer';

interface SimulationProps {
  params: SimulationParams;
  paused: boolean;
  onStatsUpdate: (count: number, avgSelfishness: number) => void;
  resetTrigger: number;
  viewMode: ViewMode;
  onHoverAgent: (agent: Entity | null) => void;
  hoveredAgent: Entity | null;
  onSelectAgent: (agent: Entity | null) => void;
  selectedAgent: Entity | null;
  showEnergyBars: boolean;
  fallbackMode?: boolean;
}

// --- Component: Simulation Root ---
// Handles Initial Spawn and Orchestration

const SimulationRoot: React.FC<SimulationProps & { externalGeometry?: BufferGeometry }> = ({ 
    params, 
    paused, 
    onStatsUpdate, 
    resetTrigger,
    viewMode,
    onHoverAgent,
    hoveredAgent,
    onSelectAgent,
    selectedAgent,
    showEnergyBars,
    externalGeometry
}) => {
  // Initialize World
  useEffect(() => {
    clearWorld();
    resetIds();
    onHoverAgent(null);
    onSelectAgent(null);
    for (let i = 0; i < params.initialPop; i++) spawnAgent();
    for (let i = 0; i < 50; i++) spawnFood(undefined, params.foodValue);
  }, [resetTrigger, params.initialPop]);

  return (
    <>
      <SimulationSystem 
          params={params} 
          paused={paused} 
          onStatsUpdate={onStatsUpdate} 
          viewMode={viewMode} 
      />
      <RendererSystem 
          paused={paused}
          viewMode={viewMode}
          onHoverAgent={onHoverAgent}
          hoveredAgent={hoveredAgent}
          onSelectAgent={onSelectAgent}
          selectedAgent={selectedAgent}
          showEnergyBars={showEnergyBars}
          externalGeometry={externalGeometry}
      />
    </>
  );
};

// --- Model Loader Wrapper ---
const SimulationModelWrapper: React.FC<SimulationProps> = (props) => {
    const { scene } = useGLTF('/assets/rabbit_model.gltf');
    
    const geometry = useMemo(() => {
        let geo: BufferGeometry | undefined;
        scene.traverse((child) => {
            if ((child as Mesh).isMesh && !geo) {
                geo = (child as Mesh).geometry;
            }
        });
        return geo || new CapsuleGeometry(0.5, 1);
    }, [scene]);

    return <SimulationRoot {...props} externalGeometry={geometry} />;
};

// --- Main Export ---
export const Simulation: React.FC<SimulationProps> = ({ fallbackMode, ...props }) => {
    if (fallbackMode) {
        return <SimulationRoot {...props} />;
    }
    return <SimulationModelWrapper {...props} />;
};