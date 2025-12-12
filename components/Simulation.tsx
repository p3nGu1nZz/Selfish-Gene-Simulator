import React, { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { BufferGeometry, Mesh, CapsuleGeometry, Material, MeshStandardMaterial, Color } from 'three';
import { SimulationParams, ViewMode, Entity } from '../types';
import { clearWorld } from '../core/ecs';
import { spawnAgent, spawnFood, resetIds } from '../entities';
import { LogicSystem } from '../core/LogicSystem';
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
          foodModels={foodModels}
      />
    </>
  );
};

// --- Model Loader Wrapper ---
const SimulationModelWrapper: React.FC<SimulationProps> = (props) => {
    const { scene: rabbitScene } = useGLTF('/assets/rabbit_model.gltf');
    // Load carrot model from scene.gltf
    const { scene: carrotScene } = useGLTF('/assets/carrot/scene.gltf');
    
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
                // Clone geometry to avoid mutations if reused
                const geo = mesh.geometry.clone();
                
                // --- Material Handling ---
                // The GLTFLoader might produce materials with unsupported PBR extensions
                // or textures might fail to load. We manually reconstruct a robust StandardMaterial.
                const originalMat = mesh.material as any;
                
                const newMat = new MeshStandardMaterial({
                     roughness: 0.8,
                     metalness: 0.1
                });

                // Try to preserve the map if the loader found it
                if (originalMat.map) {
                    newMat.map = originalMat.map;
                    newMat.color = new Color(1, 1, 1); // White if texture exists
                } else {
                    // Fallback colors based on name if map is missing
                    const name = mesh.name.toLowerCase();
                    // Heuristic: Leaves usually have 'leaf', 'leave' in name, or are the second mesh
                    // But names in scene.gltf might be generic.
                    // Let's assume standard carrot colors if we can't find texture.
                    
                    // Note: In many carrot models, one mesh is the root (orange) and one is leaves (green).
                    // We can try to guess based on mesh name or just index logic if names fail.
                    if (name.includes('leaf') || name.includes('leaves') || name.includes('green')) {
                        newMat.color.setHex(0x228b22); // Forest Green
                    } else {
                         // Default to orange for the body
                         newMat.color.setHex(0xff8c00); // Dark Orange
                    }
                }
                
                parts.push({ geometry: geo, material: newMat });
            }
        });
        
        // If we found parts but the fallback color logic failed (both orange), 
        // we can try to refine it by simple heuristics: 
        // usually the smaller volume or higher Y is leaves? 
        // simpler: if we have 2 parts and both are orange, force one to green.
        if (parts.length === 2) {
             const m0 = parts[0].material as MeshStandardMaterial;
             const m1 = parts[1].material as MeshStandardMaterial;
             // If both are same color and no maps
             if (!m0.map && !m1.map && m0.color.getHex() === m1.color.getHex()) {
                 // Assume second one is leaves (often the case in exports)
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