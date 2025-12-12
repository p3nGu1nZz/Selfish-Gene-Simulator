import React, { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { BufferGeometry, Mesh, CapsuleGeometry, Material, MeshStandardMaterial, Color } from 'three';
import { SimulationParams, ViewMode, Entity } from '../systems/types';
import { clearWorld } from '../core/ecs';
import { spawnAgent, spawnFood, resetIds } from '../entities';
import { LogicSystem } from '../core/LogicSystem';
import { RendererSystem } from '../systems/Renderer';

// Updated asset paths to be relative to the deployment root.
// This assumes your deployment copies 'assets' to the root of the 'compiled' directory.
const RABBIT_MODEL_PATH = './assets/rabbit_model.gltf';
const CARROT_MODEL_PATH = './assets/carrot/scene.gltf';

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
interface SimulationRootProps extends SimulationProps {
    externalGeometry?: BufferGeometry;
    foodModels?: { geometry: BufferGeometry; material: Material }[];
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
    foodModels
}) => {
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
          foodModels={foodModels}
      />
    </>
  );
};

// --- Model Loader Wrapper ---
const SimulationModelWrapper: React.FC<SimulationProps> = (props) => {
    // Pass the string paths directly to useGLTF
    const { scene: rabbitScene } = useGLTF(RABBIT_MODEL_PATH);
    const { scene: carrotScene } = useGLTF(CARROT_MODEL_PATH);
    
    const rabbitGeo = useMemo(() => {
        let geo: BufferGeometry | undefined;
        rabbitScene.traverse((child) => {
            if ((child as Mesh).isMesh && !geo) {
                geo = (child as Mesh).geometry;
            }
        });
        return geo || new CapsuleGeometry(0.5, 1);
    }, [rabbitScene]);

    const carrotModels = useMemo(() => {
        const parts: { geometry: BufferGeometry; material: Material }[] = [];
        carrotScene.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const mesh = child as Mesh;
                const geo = mesh.geometry.clone();
                
                const originalMat = mesh.material as any;
                const newMat = new MeshStandardMaterial({
                     roughness: 0.8,
                     metalness: 0.1
                });

                if (originalMat.map) {
                    newMat.map = originalMat.map;
                    newMat.color = new Color(1, 1, 1); 
                } else {
                    const name = mesh.name.toLowerCase();
                    if (name.includes('leaf') || name.includes('leaves') || name.includes('green')) {
                        newMat.color.setHex(0x228b22); 
                    } else {
                         newMat.color.setHex(0xff8c00); 
                    }
                }
                
                parts.push({ geometry: geo, material: newMat });
            }
        });
        
        // Simple heuristic to fix carrot colors if textures fail
        if (parts.length === 2) {
             const m0 = parts[0].material as MeshStandardMaterial;
             const m1 = parts[1].material as MeshStandardMaterial;
             if (!m0.map && !m1.map && m0.color.getHex() === m1.color.getHex()) {
                 m1.color.setHex(0x228b22);
             }
        }
        
        return parts;
    }, [carrotScene]);

    return (
        <SimulationRoot 
            {...props} 
            externalGeometry={rabbitGeo} 
            foodModels={carrotModels}
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

// Preload assets
useGLTF.preload(RABBIT_MODEL_PATH);
useGLTF.preload(CARROT_MODEL_PATH);
