import React, { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { BufferGeometry, Mesh, CapsuleGeometry, Material, MeshStandardMaterial, Color } from 'three';
import { SimulationParams, ViewMode, AgentData } from '../core/types';
import { clearWorld, agents } from '../core/ecs';
import { spawnAgent, spawnFood, resetIds } from '../entities';
import { LogicSystem } from '../systems/LogicSystem';
import { RenderSystem } from '../systems/render/RenderSystem';
import { RABBIT_MODEL_PATH, CARROT_MODEL_PATH, ENABLE_EXTERNAL_MODELS } from '../core/constants';

interface SimulationProps {
  params: SimulationParams;
  setParams: React.Dispatch<React.SetStateAction<SimulationParams>>;
  paused: boolean;
  onStatsUpdate: (count: number, avgSelfishness: number) => void;
  onAgentUpdate: (data: AgentData | null) => void;
  selectedAgentId: number | null;
  onSelectAgent: (id: number | null) => void;
  resetTrigger: number;
  viewMode: ViewMode;
  showEnergyBars: boolean;
  showTrails: boolean;
  showGrid?: boolean;
  fallbackMode?: boolean;
}

// --- Component: Simulation Root ---
interface SimulationRootProps extends SimulationProps {
    externalGeometry?: BufferGeometry;
    foodModels?: { geometry: BufferGeometry; material: Material }[];
}

const SimulationRoot: React.FC<SimulationRootProps> = ({ 
    params, 
    setParams,
    paused, 
    onStatsUpdate, 
    onAgentUpdate,
    selectedAgentId,
    onSelectAgent,
    resetTrigger, 
    viewMode, 
    showEnergyBars,
    showTrails,
    showGrid,
    externalGeometry,
    foodModels
}) => {
  
  // Handle Reset and Initial Spawn
  useEffect(() => {
    clearWorld();
    resetIds();
    for (let i = 0; i < params.initialPop; i++) spawnAgent();
    for (let i = 0; i < 20; i++) spawnFood(undefined, params.foodValue);
    
    // Auto-select the first agent on reset
    if (agents.entities.length > 0) {
        onSelectAgent(agents.entities[0].id);
    } else {
        onSelectAgent(null);
    }
  }, [resetTrigger, params.initialPop]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <LogicSystem 
          params={params} 
          paused={paused} 
          onStatsUpdate={onStatsUpdate} 
          onAgentUpdate={onAgentUpdate}
          selectedAgentId={selectedAgentId}
          viewMode={viewMode} 
          onTimeUpdate={(newTime) => {
              setParams(p => ({ ...p, timeOfDay: newTime }));
          }}
      />
      <RenderSystem 
          paused={paused}
          viewMode={viewMode}
          showEnergyBars={showEnergyBars}
          showTrails={showTrails}
          showGrid={showGrid || false}
          externalGeometry={externalGeometry}
          foodModels={foodModels}
          selectedAgentId={selectedAgentId}
          onSelectAgent={onSelectAgent}
          timeOfDay={params.timeOfDay}
      />
    </>
  );
};

// --- Model Loader Wrapper ---
const SimulationModelWrapper: React.FC<SimulationProps> = (props) => {
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
                const newMat = new MeshStandardMaterial({ roughness: 0.8, metalness: 0.1 });

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

export const Simulation: React.FC<SimulationProps> = ({ fallbackMode, ...props }) => {
    if (!ENABLE_EXTERNAL_MODELS || fallbackMode) {
        return <SimulationRoot {...props} />;
    }
    return <SimulationModelWrapper {...props} />;
};

useGLTF.preload(RABBIT_MODEL_PATH);
useGLTF.preload(CARROT_MODEL_PATH);