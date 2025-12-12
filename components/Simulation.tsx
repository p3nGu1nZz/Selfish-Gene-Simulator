import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color, DynamicDrawUsage, BufferGeometry, Shape, DoubleSide, AdditiveBlending, Mesh, CapsuleGeometry } from 'three';
import { SimulationParams, ViewMode, Entity } from '../types';
import { agents, food, particles, clearWorld } from '../ecs';
import { AgentSystem, FoodSystem, ParticleSystem } from '../systems';
import { spawnAgent, spawnFood, resetIds } from '../entities';
import { WORLD_SIZE, MAX_POPULATION, AGENT_RADIUS_BASE } from '../constants';

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
}

const getAgentColorRGB = (agentData: any, viewMode: ViewMode): {r: number, g: number, b: number} => {
    let r, g, b;
    if (viewMode === 'selfishness') {
        const s = agentData.genes.selfishness;
        r = 0.29 + (0.97 - 0.29) * s;
        g = 0.87 + (0.44 - 0.87) * s;
        b = 0.50 + (0.44 - 0.50) * s;
    } else if (viewMode === 'speed') {
        const s = (agentData.genes.speed - 0.5) / 2.5; 
        r = s; g = s; b = 1.0 - s * 0.5;
    } else if (viewMode === 'size') {
        const s = (agentData.genes.size - 0.5) / 1.5;
        r = 0.5 + s * 0.5; g = s * 0.5; b = 0.8 - s * 0.8;
    } else { // Mutation
        const s = agentData.genes.mutationRate * 5; 
        r = 0.5 + s * 0.5; g = 0.5; b = 0.5 + s * 0.5;
    }
    return { r, g, b };
}

// Precompute Heart Geometry
const heartShape = new Shape();
const x = 0, y = 0;
heartShape.moveTo(x + 0.25, y + 0.25);
heartShape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.20, y, x, y);
heartShape.bezierCurveTo(x - 0.30, y, x - 0.30, y + 0.35, x - 0.30, y + 0.35);
heartShape.bezierCurveTo(x - 0.30, y + 0.55, x - 0.10, y + 0.77, x + 0.25, y + 0.95);
heartShape.bezierCurveTo(x + 0.60, y + 0.77, x + 0.80, y + 0.55, x + 0.80, y + 0.35);
heartShape.bezierCurveTo(x + 0.80, y + 0.35, x + 0.80, y, x + 0.50, y);
heartShape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);

export const Simulation: React.FC<SimulationProps> = ({ 
    params, 
    paused, 
    onStatsUpdate, 
    resetTrigger,
    viewMode,
    onHoverAgent,
    hoveredAgent,
    onSelectAgent,
    selectedAgent,
    showEnergyBars
}) => {
  const agentsMeshRef = useRef<InstancedMesh>(null);
  const foodMeshRef = useRef<InstancedMesh>(null);
  const particleMeshRef = useRef<InstancedMesh>(null);
  const heartMeshRef = useRef<InstancedMesh>(null);
  const energyBarMeshRef = useRef<InstancedMesh>(null);
  const trailGeoRef = useRef<BufferGeometry>(null);

  // Fallback Geometry (Capsule) since external model failed to load
  const agentGeometry = useMemo(() => {
    // CapsuleGeometry(radius, length, capSubdivisions, radialSegments)
    const geo = new CapsuleGeometry(AGENT_RADIUS_BASE * 0.8, AGENT_RADIUS_BASE * 1.5, 4, 16);
    // Rotate to align with forward direction (Z-axis)
    geo.rotateX(Math.PI / 2);
    return geo;
  }, []);

  // We use this to safely access entities inside event handlers without closure staleness
  const interactionRef = useRef<Entity[]>([]);

  const tempObj = useMemo(() => new Object3D(), []);
  const tempColor = useMemo(() => new Color(), []);
  
  // Buffers for trails
  const MAX_TRAIL_POINTS = 20;
  const MAX_SEGMENTS = MAX_POPULATION * (MAX_TRAIL_POINTS - 1);
  const [trailPositions, trailColors] = useMemo(() => [
      new Float32Array(MAX_SEGMENTS * 2 * 3),
      new Float32Array(MAX_SEGMENTS * 2 * 3)
  ], []);

  // Initialize World
  useEffect(() => {
    clearWorld();
    resetIds();
    onHoverAgent(null);
    onSelectAgent(null);

    // Initial Population
    for (let i = 0; i < params.initialPop; i++) {
        spawnAgent();
    }
    // Initial Food
    for (let i = 0; i < 50; i++) {
        spawnFood(undefined, params.foodValue);
    }
  }, [resetTrigger, params.initialPop]);

  // Main Loop
  useFrame((state, delta) => {
    const dt = paused ? 0 : Math.min(delta, 0.1) * params.simulationSpeed;

    if (!paused) {
        // --- Run ECS Systems ---
        FoodSystem(dt, params);
        AgentSystem(dt, params, (e) => getAgentColorRGB(e.agent!, viewMode));
    }
    
    // Particles update even if paused
    if (!paused) {
        ParticleSystem(dt);
    }

    // --- Render Sync (Visual System) ---
    
    // 1. Sync Agents & Trails
    if (agentsMeshRef.current) {
        const mesh = agentsMeshRef.current;
        const barMesh = energyBarMeshRef.current;
        const allAgents = agents.entities;
        
        // Update interaction ref for click handlers
        interactionRef.current = allAgents;

        mesh.count = allAgents.length;
        if (barMesh) barMesh.count = showEnergyBars ? allAgents.length : 0;

        let trailVertexIndex = 0;
        let totalSelfishness = 0;
        
        for (let i = 0; i < allAgents.length; i++) {
            const entity = allAgents[i];
            const { position, agent, velocity } = entity;
            if(!agent) continue;

            // Update Instance Matrix
            tempObj.position.copy(position);
            const scale = agent.genes.size;
            tempObj.scale.set(scale, scale, scale);
            
            // Rotate towards velocity to face movement direction
            if (velocity && velocity.lengthSq() > 0.001) {
                // Look at point = current position + velocity vector
                tempObj.lookAt(
                    position.x + velocity.x, 
                    position.y + velocity.y, 
                    position.z + velocity.z
                );
            } else {
                tempObj.rotation.set(0,0,0);
            }

            tempObj.updateMatrix();
            mesh.setMatrixAt(i, tempObj.matrix);
            
            // Color
            const { r, g, b } = getAgentColorRGB(agent, viewMode);
            tempColor.setRGB(r, g, b);
            
            if (hoveredAgent === entity || selectedAgent === entity) {
                tempColor.offsetHSL(0, 0, 0.2);
            }
            mesh.setColorAt(i, tempColor);
            
            // Update Energy Bar
            if (barMesh && showEnergyBars) {
                const energyRatio = Math.min(agent.energy / 100, 1.0);
                tempColor.setHSL(energyRatio * 0.33, 1.0, 0.5); 
                barMesh.setColorAt(i, tempColor);

                tempObj.position.copy(position);
                tempObj.position.y += (agent.genes.size * AGENT_RADIUS_BASE) + 1.2; 
                tempObj.scale.set(Math.max(0.01, energyRatio), 1, 1);
                // Reset rotation for the bar so it's always flat/aligned to world
                tempObj.rotation.set(0, 0, 0); 
                tempObj.updateMatrix();
                barMesh.setMatrixAt(i, tempObj.matrix);
            }

            // Trails
            if (!paused) {
                agent.trail.push(position.clone());
                if (agent.trail.length > MAX_TRAIL_POINTS) agent.trail.shift();
            }

            if (agent.trail.length > 1) {
                for (let j = 0; j < agent.trail.length - 1; j++) {
                    const p1 = agent.trail[j];
                    const p2 = agent.trail[j+1];

                    if (trailVertexIndex * 3 < trailPositions.length) {
                        const fade1 = Math.pow(j / (MAX_TRAIL_POINTS - 1), 2);
                        const fade2 = Math.pow((j + 1) / (MAX_TRAIL_POINTS - 1), 2);

                        trailPositions[trailVertexIndex * 3] = p1.x;
                        trailPositions[trailVertexIndex * 3 + 1] = p1.y;
                        trailPositions[trailVertexIndex * 3 + 2] = p1.z;
                        trailColors[trailVertexIndex * 3] = r * fade1;
                        trailColors[trailVertexIndex * 3 + 1] = g * fade1;
                        trailColors[trailVertexIndex * 3 + 2] = b * fade1;

                        trailPositions[(trailVertexIndex + 1) * 3] = p2.x;
                        trailPositions[(trailVertexIndex + 1) * 3 + 1] = p2.y;
                        trailPositions[(trailVertexIndex + 1) * 3 + 2] = p2.z;
                        trailColors[(trailVertexIndex + 1) * 3] = r * fade2;
                        trailColors[(trailVertexIndex + 1) * 3 + 1] = g * fade2;
                        trailColors[(trailVertexIndex + 1) * 3 + 2] = b * fade2;

                        trailVertexIndex += 2;
                    }
                }
            }
            
            totalSelfishness += agent.genes.selfishness;
        }

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        
        if (barMesh) {
            barMesh.instanceMatrix.needsUpdate = true;
            if (barMesh.instanceColor) barMesh.instanceColor.needsUpdate = true;
        }

        // Update Trails Geometry
        if (trailGeoRef.current) {
            trailGeoRef.current.setDrawRange(0, trailVertexIndex);
            trailGeoRef.current.attributes.position.needsUpdate = true;
            trailGeoRef.current.attributes.color.needsUpdate = true;
        }

        // Stats
        if (state.clock.elapsedTime % 0.5 < 0.1) {
             onStatsUpdate(allAgents.length, allAgents.length > 0 ? totalSelfishness / allAgents.length : 0);
        }
    }

    // 2. Sync Food
    if (foodMeshRef.current) {
        const mesh = foodMeshRef.current;
        const allFood = food.entities;
        mesh.count = allFood.length;
        for (let i = 0; i < allFood.length; i++) {
            tempObj.position.copy(allFood[i].position);
            tempObj.scale.set(1, 1, 1);
            tempObj.rotation.set(0,0,0);
            tempObj.updateMatrix();
            mesh.setMatrixAt(i, tempObj.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    }

    // 3. Sync Particles (Split into Hearts and Standard Particles)
    if (particleMeshRef.current && heartMeshRef.current) {
        const pMesh = particleMeshRef.current;
        const hMesh = heartMeshRef.current;
        const allParticles = particles.entities;
        
        let pCount = 0;
        let hCount = 0;

        for (let i = 0; i < allParticles.length; i++) {
            const ent = allParticles[i];
            const p = ent.particle!;
            
            tempObj.position.copy(ent.position);
            const scale = p.scale * (p.life / p.maxLife);
            tempObj.scale.set(scale, scale, scale);
            
            if (p.type === 'heart') {
                // Hearts face camera roughly or just face up + rotation
                // Simple billboard-ish behavior: look at camera
                tempObj.lookAt(state.camera.position);
                // Then add some local spin
                tempObj.rotateZ(p.rotation || 0);
                tempObj.updateMatrix();
                
                hMesh.setMatrixAt(hCount, tempObj.matrix);
                hMesh.setColorAt(hCount, p.color);
                hCount++;
            } else {
                // Standard particles
                tempObj.rotation.set(0,0,0);
                tempObj.updateMatrix();

                pMesh.setMatrixAt(pCount, tempObj.matrix);
                pMesh.setColorAt(pCount, p.color);
                pCount++;
            }
        }

        pMesh.count = pCount;
        pMesh.instanceMatrix.needsUpdate = true;
        if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;

        hMesh.count = hCount;
        hMesh.instanceMatrix.needsUpdate = true;
        if (hMesh.instanceColor) hMesh.instanceColor.needsUpdate = true;
    }

  });

  // Handler for interaction
  const handleInteract = (instanceId: number | undefined) => {
    if (instanceId !== undefined) {
        const entity = interactionRef.current[instanceId];
        if (entity) {
             onSelectAgent(entity);
        }
    }
  };
  
  const handleHover = (instanceId: number | undefined) => {
      if (instanceId !== undefined) {
          const entity = interactionRef.current[instanceId];
          if (entity && entity !== hoveredAgent) {
              onHoverAgent(entity);
          }
      } else {
          onHoverAgent(null);
      }
  };

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshStandardMaterial color="#111" roughness={0.8} metalness={0.2} />
      </mesh>
      
      {/* Grid Helper */}
      <gridHelper args={[WORLD_SIZE, 20, 0x444444, 0x222222]} />

      {/* Agents Mesh */}
      <instancedMesh
        ref={agentsMeshRef}
        args={[undefined, undefined, MAX_POPULATION * 2]} 
        frustumCulled={false}
        castShadow
        receiveShadow
        onClick={(e) => {
             e.stopPropagation();
             handleInteract(e.instanceId);
        }}
        onPointerMove={(e) => {
            e.stopPropagation();
            handleHover(e.instanceId);
        }}
        onPointerOut={() => onHoverAgent(null)}
        geometry={agentGeometry}
      >
        <meshStandardMaterial roughness={0.4} metalness={0.5} />
      </instancedMesh>

      {/* Energy Bars */}
      {showEnergyBars && (
        <instancedMesh
            ref={energyBarMeshRef}
            args={[undefined, undefined, MAX_POPULATION * 2]}
            frustumCulled={false}
            onClick={(e) => {
                e.stopPropagation();
                handleInteract(e.instanceId);
            }}
            onPointerMove={(e) => {
                e.stopPropagation();
                handleHover(e.instanceId);
            }}
            onPointerOut={() => onHoverAgent(null)}
        >
            <boxGeometry args={[1.5, 0.15, 0.15]} />
            <meshBasicMaterial />
        </instancedMesh>
      )}

      {/* Standard Particles */}
      <instancedMesh
        ref={particleMeshRef}
        args={[undefined, undefined, 2000]}
        frustumCulled={false}
      >
          <boxGeometry args={[0.7, 0.7, 0.7]} />
          <meshBasicMaterial 
            transparent 
            opacity={0.8} 
            blending={AdditiveBlending} 
            depthWrite={false}
          />
      </instancedMesh>

      {/* Heart Particles */}
      <instancedMesh
        ref={heartMeshRef}
        args={[undefined, undefined, 500]}
        frustumCulled={false}
      >
          <shapeGeometry args={[heartShape]} />
          <meshBasicMaterial 
            color="#ff69b4"
            side={DoubleSide}
            transparent 
            opacity={0.9} 
            blending={AdditiveBlending} 
            depthWrite={false}
          />
      </instancedMesh>

      {/* Trails */}
      <lineSegments frustumCulled={false}>
          <bufferGeometry ref={trailGeoRef}>
            <bufferAttribute
                attach="attributes-position"
                count={trailPositions.length / 3}
                array={trailPositions}
                itemSize={3}
                usage={DynamicDrawUsage}
            />
            <bufferAttribute
                attach="attributes-color"
                count={trailColors.length / 3}
                array={trailColors}
                itemSize={3}
                usage={DynamicDrawUsage}
            />
          </bufferGeometry>
          <lineBasicMaterial vertexColors opacity={0.6} transparent blending={AdditiveBlending} />
      </lineSegments>

      {/* Food */}
      <instancedMesh
        ref={foodMeshRef}
        args={[undefined, undefined, 1000]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.5} />
      </instancedMesh>

      {/* Selection Ring */}
      {(hoveredAgent || selectedAgent) && (
          <mesh 
            position={[
                (selectedAgent || hoveredAgent)?.position.x || 0,
                -0.45, 
                (selectedAgent || hoveredAgent)?.position.z || 0
            ]} 
            rotation={[-Math.PI/2, 0, 0]}
          >
             <ringGeometry 
                args={[
                    1.2 * ((selectedAgent || hoveredAgent)?.agent?.genes.size || 1), 
                    1.4 * ((selectedAgent || hoveredAgent)?.agent?.genes.size || 1), 
                    32
                ]} 
             />
             <meshBasicMaterial 
                color={selectedAgent ? "#3b82f6" : "white"} 
                opacity={0.8} 
                transparent 
                blending={AdditiveBlending}
                side={2} // DoubleSide
             />
          </mesh>
      )}
    </group>
  );
};