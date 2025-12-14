import React, { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { BufferGeometry, Mesh, CapsuleGeometry, Material, MeshStandardMaterial, DoubleSide, Vector3 } from 'three';
import { SimulationParams, ViewMode, AgentData } from '../core/types';
import { clearWorld, agents } from '../core/ecs';
import { spawnAgent, spawnFood, resetIds } from '../entities';
import { LogicSystem } from '../systems/LogicSystem';
import { RenderSystem } from '../systems/render/RenderSystem';
import { RABBIT_MODEL_PATH, CARROT_MODEL_PATH } from '../core/constants';
import { SaveState, restoreWorld } from '../core/SaveLoad';

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
  fallbackMode?: boolean; // Deprecated but kept in interface for compatibility
  loadedData: SaveState | null;
  onLoadComplete: () => void;
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
    foodModels,
    loadedData,
    onLoadComplete
}) => {
  
  // Handle Reset and Initial Spawn
  useEffect(() => {
    clearWorld();
    
    if (loadedData) {
        restoreWorld(loadedData);
        onLoadComplete(); // Clear loaded data in parent so future resets are random
    } else {
        resetIds();
        for (let i = 0; i < params.initialPop; i++) spawnAgent();
        for (let i = 0; i < 20; i++) spawnFood(undefined, params.foodValue);
    }
    
    // Auto-select the first agent if exists
    // Timeout to allow ECS to update if needed
    setTimeout(() => {
        if (agents.entities.length > 0) {
            onSelectAgent(agents.entities[0].id);
        } else {
            onSelectAgent(null);
        }
    }, 50);

  }, [resetTrigger, loadedData]); // Trigger on reset or when loadedData is set

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

export const Simulation: React.FC<SimulationProps> = (props) => {
    // Load Rabbit
    const { scene: rabbitScene } = useGLTF(RABBIT_MODEL_PATH);
    // Load Carrot
    const { scene: carrotScene } = useGLTF(CARROT_MODEL_PATH);
    
    const rabbitGeo = useMemo(() => {
        let geo: BufferGeometry | undefined;
        rabbitScene.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const m = child as Mesh;
                if (!geo) {
                    // Clone geometry so we can modify it safely
                    geo = m.geometry.clone();
                }
            }
        });
        
        if (geo) {
            // Normalize Scale and Center
            geo.computeBoundingBox();
            const box = geo.boundingBox!;
            const center = new Vector3();
            box.getCenter(center);
            const size = new Vector3();
            box.getSize(size);
            
            // 1. Center geometry on X/Z, but align bottom to Y=0
            geo.translate(-center.x, -box.min.y, -center.z);
            
            // 2. Normalize Scale (Fit to Unit Cube 1x1x1)
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) {
                const scale = 1.0 / maxDim;
                geo.scale(scale, scale, scale);
            }
        }

        return geo || new CapsuleGeometry(0.5, 1);
    }, [rabbitScene]);

    const carrotModels = useMemo(() => {
        // Clone scene to avoid mutating global cache
        const scene = carrotScene.clone();

        const parts: { geometry: BufferGeometry; material: Material, meshName: string }[] = [];
        
        // 1. Traverse and Collect Parts + Bake Transforms
        scene.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const m = child as Mesh;
                
                // Fix Materials
                const mat = m.material as MeshStandardMaterial;
                const lowerName = (mat.name + m.name).toLowerCase();
                mat.map = null; // Remove textures to use colors
                if (lowerName.includes('leaf') || lowerName.includes('leaves')) {
                    mat.color.setHex(0x4caf50); 
                    mat.transparent = true; 
                    mat.alphaTest = 0.5; 
                    mat.side = DoubleSide; 
                    mat.depthWrite = true;
                } else {
                    mat.color.setHex(0xff7f00); 
                }
                mat.needsUpdate = true;

                // Bake transform into geometry so we can discard the scene graph
                m.updateWorldMatrix(true, false);
                m.geometry.applyMatrix4(m.matrixWorld);

                parts.push({ 
                    geometry: m.geometry, 
                    material: m.material as Material,
                    meshName: m.name 
                });
            }
        });

        // 2. Normalize All Parts Together
        if (parts.length > 0) {
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

            // Calculate global bounds
            parts.forEach(p => {
                p.geometry.computeBoundingBox();
                const b = p.geometry.boundingBox!;
                minX = Math.min(minX, b.min.x);
                minY = Math.min(minY, b.min.y);
                minZ = Math.min(minZ, b.min.z);
                maxX = Math.max(maxX, b.max.x);
                maxY = Math.max(maxY, b.max.y);
                maxZ = Math.max(maxZ, b.max.z);
            });

            const sizeX = maxX - minX;
            const sizeY = maxY - minY;
            const sizeZ = maxZ - minZ;
            const maxDim = Math.max(sizeX, sizeY, sizeZ);
            
            const centerX = (minX + maxX) / 2;
            const centerZ = (minZ + maxZ) / 2;
            // Use minY to align bottom to 0

            if (maxDim > 0) {
                const s = 1.0 / maxDim;
                parts.forEach(p => {
                    // Translate center X/Z to 0, and bottom Y to 0
                    p.geometry.translate(-centerX, -minY, -centerZ);
                    p.geometry.scale(s, s, s);
                });
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

// Preload assets
useGLTF.preload(RABBIT_MODEL_PATH);
useGLTF.preload(CARROT_MODEL_PATH);