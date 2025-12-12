import React, { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { BufferGeometry, Mesh, CapsuleGeometry, Material } from 'three';
import { SimulationParams, ViewMode, Entity } from '../types';
import { clearWorld } from '../ecs';
import { spawnAgent, spawnFood, resetIds } from '../entities';
import { LogicSystem } from '../systems/Simulation';
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

interface SimulationRootProps extends SimulationProps {
    externalGeometry?: BufferGeometry;
    foodGeometry?: BufferGeometry;
    foodMaterial?: Material;
}

const SimulationRoot: React.FC<SimulationRootProps> = ({ 
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
    externalGeometry,
    foodGeometry,
    foodMaterial
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
      <LogicSystem 
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
          foodGeometry={foodGeometry}
          foodMaterial={foodMaterial}
      />
    </>
  );
};

// --- Model Loader Wrapper ---
const SimulationModelWrapper: React.FC<SimulationProps> = (props) => {
    const { scene: rabbitScene } = useGLTF('/assets/rabbit_model.gltf');
    // Load carrot model - assuming standard structure in assets/carrot/
    const { scene: carrotScene } = useGLTF('/assets/carrot/carrot.gltf');
    
    const rabbitGeo = useMemo(() => {
        let geo: BufferGeometry | undefined;
        rabbitScene.traverse((child) => {
            if ((child as Mesh).isMesh && !geo) {
                geo = (child as Mesh).geometry;
            }
        });
        return geo || new CapsuleGeometry(0.5, 1);
    }, [rabbitScene]);

    const { geometry: carrotGeo, material: carrotMat } = useMemo(() => {
        let geo: BufferGeometry | undefined;
        let mat: Material | undefined;
        carrotScene.traverse((child) => {
            if ((child as Mesh).isMesh && !geo) {
                geo = (child as Mesh).geometry;
                mat = (child as Mesh).material as Material;
            }
        });
        return { geometry: geo, material: mat };
    }, [carrotScene]);

    return (
        <SimulationRoot 
            {...props} 
            externalGeometry={rabbitGeo} 
            foodGeometry={carrotGeo}
            foodMaterial={carrotMat}
        />
    );
};

// --- Main Export ---
export const Simulation: React.FC<SimulationProps> = ({ fallbackMode, ...props }) => {
    if (fallbackMode) {
        return <SimulationRoot {...props} />;
    }
    return <SimulationModelWrapper {...props} />;
};