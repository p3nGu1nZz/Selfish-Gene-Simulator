import React, { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { BufferGeometry, Mesh, CapsuleGeometry, Material, MeshStandardMaterial, DoubleSide, TextureLoader, SRGBColorSpace } from 'three';
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
    
    // We remove explicit useTexture here because it causes the app to crash 
    // if the assets are missing or paths are incorrect on the server.
    // Instead, we load them safely in useEffect below.

    const rabbitGeo = useMemo(() => {
        let geo: BufferGeometry | undefined;
        rabbitScene.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const m = child as Mesh;
                if (!geo) geo = m.geometry;
                
                // Fix Rabbit Textures (usually embedded)
                const mat = m.material as MeshStandardMaterial;
                if (mat.map) {
                    mat.map.flipY = false;
                    mat.needsUpdate = true;
                }
            }
        });
        return geo || new CapsuleGeometry(0.5, 1);
    }, [rabbitScene]);

    const carrotModels = useMemo(() => {
        // Clone scene to avoid mutating global cache if used elsewhere
        const scene = carrotScene.clone();

        scene.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const m = child as Mesh;
                const mat = m.material as MeshStandardMaterial;
                
                // Heuristic: Check material or mesh name for 'leaf' to assign leaf texture properties
                const lowerName = (mat.name + m.name).toLowerCase();
                
                if (lowerName.includes('leaf') || lowerName.includes('leaves')) {
                    mat.transparent = true; 
                    mat.alphaTest = 0.5; 
                    mat.side = DoubleSide; 
                    mat.depthWrite = true;
                } 
                
                // Ensure material knows we might update maps later
                mat.needsUpdate = true;
            }
        });

        const parts: { geometry: BufferGeometry; material: Material, meshName: string }[] = [];
        scene.traverse((child) => {
            if ((child as Mesh).isMesh) {
                const m = child as Mesh;
                parts.push({ 
                    geometry: m.geometry, 
                    material: m.material as Material,
                    meshName: m.name 
                });
            }
        });
        return parts;
    }, [carrotScene]);

    // Safe Texture Loading
    useEffect(() => {
        const loader = new TextureLoader();
        
        const applyTexture = (path: string, isLeaf: boolean) => {
            loader.load(
                path,
                (texture) => {
                    texture.flipY = false; // GLTF convention
                    texture.colorSpace = SRGBColorSpace;
                    
                    carrotModels.forEach(part => {
                        const mat = part.material as MeshStandardMaterial;
                        const lowerName = (mat.name + part.meshName).toLowerCase();
                        const isLeafPart = lowerName.includes('leaf') || lowerName.includes('leaves');

                        if (isLeaf && isLeafPart) {
                            mat.map = texture;
                            mat.needsUpdate = true;
                        } else if (!isLeaf && !isLeafPart) {
                            mat.map = texture;
                            mat.needsUpdate = true;
                        }
                    });
                },
                undefined,
                (err) => {
                    console.warn(`[Simulation] Could not load texture at ${path}. Using model fallback.`, err);
                }
            );
        };

        // Try to load the textures requested
        // Using relative paths 'assets/...' which works best with most bundlers/servers
        // compared to '/assets/...' which requires root server config.
        applyTexture('assets/carrot/textures/Carrot_Base_diffuse.png', false);
        applyTexture('assets/carrot/textures/Carrot_Leaves_diffuse.png', true);

    }, [carrotModels]);

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