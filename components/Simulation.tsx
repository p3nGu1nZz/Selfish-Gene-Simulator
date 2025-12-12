import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { InstancedMesh, Object3D, Vector3, Color, DynamicDrawUsage, BufferGeometry, BufferAttribute } from 'three';
import { Agent, Food, Genome, SimulationParams, ViewMode } from '../types';
import { WORLD_SIZE, MAX_POPULATION, AGENT_RADIUS_BASE, MAX_SPEED_BASE, SENSOR_RADIUS } from '../constants';

// Helper to generate random number in range
const rand = (min: number, max: number) => Math.random() * (max - min) + min;

// Helper to create a random genome
const createRandomGenome = (): Genome => ({
  selfishness: Math.random(),
  speed: rand(0.8, 1.5),
  size: rand(0.8, 1.2),
  mutationRate: rand(0.01, 0.1),
  hue: 0, // Calculated later based on selfishness
});

// Helper to mutate a genome
const mutateGenome = (parent: Genome, magnitude: number): Genome => {
  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
  const mutate = (val: number) => val + (Math.random() - 0.5) * magnitude;
  
  return {
    selfishness: clamp(mutate(parent.selfishness), 0, 1),
    speed: clamp(mutate(parent.speed), 0.5, 3.0),
    size: clamp(mutate(parent.size), 0.5, 2.0),
    mutationRate: clamp(mutate(parent.mutationRate), 0.01, 0.2),
    hue: 0,
  };
};

const getAgentColorRGB = (agent: Agent, viewMode: ViewMode): {r: number, g: number, b: number} => {
    let r, g, b;
    if (viewMode === 'selfishness') {
        const s = agent.genes.selfishness;
        r = 0.29 + (0.97 - 0.29) * s;
        g = 0.87 + (0.44 - 0.87) * s;
        b = 0.50 + (0.44 - 0.50) * s;
    } else if (viewMode === 'speed') {
        const s = (agent.genes.speed - 0.5) / 2.5; 
        r = s; g = s; b = 1.0 - s * 0.5;
    } else if (viewMode === 'size') {
        const s = (agent.genes.size - 0.5) / 1.5;
        r = 0.5 + s * 0.5; g = s * 0.5; b = 0.8 - s * 0.8;
    } else { // Mutation
        const s = agent.genes.mutationRate * 5; 
        r = 0.5 + s * 0.5; g = 0.5; b = 0.5 + s * 0.5;
    }
    return { r, g, b };
}

interface SimulationProps {
  params: SimulationParams;
  paused: boolean;
  onStatsUpdate: (count: number, avgSelfishness: number) => void;
  resetTrigger: number;
  viewMode: ViewMode;
  onHoverAgent: (agent: Agent | null) => void;
  hoveredAgent: Agent | null;
  onSelectAgent: (agent: Agent | null) => void;
  selectedAgent: Agent | null;
}

export const Simulation: React.FC<SimulationProps> = ({ 
    params, 
    paused, 
    onStatsUpdate, 
    resetTrigger,
    viewMode,
    onHoverAgent,
    hoveredAgent,
    onSelectAgent,
    selectedAgent
}) => {
  const agentsMeshRef = useRef<InstancedMesh>(null);
  const foodMeshRef = useRef<InstancedMesh>(null);
  const trailGeoRef = useRef<BufferGeometry>(null);
  
  // Simulation State stored in Refs for performance (avoiding React re-renders)
  const agents = useRef<Agent[]>([]);
  const food = useRef<Food[]>([]);
  const frameCount = useRef(0);
  const nextAgentId = useRef(0);
  const nextFoodId = useRef(0);

  // Temporary objects for Three.js manipulation
  const tempObj = useMemo(() => new Object3D(), []);
  const tempColor = useMemo(() => new Color(), []);
  const tempVec = useMemo(() => new Vector3(), []);
  const tempVec2 = useMemo(() => new Vector3(), []);

  // Trail Buffers
  const MAX_TRAIL_POINTS = 20;
  const MAX_SEGMENTS = MAX_POPULATION * (MAX_TRAIL_POINTS - 1);
  const [trailPositions, trailColors] = useMemo(() => [
      new Float32Array(MAX_SEGMENTS * 2 * 3),
      new Float32Array(MAX_SEGMENTS * 2 * 3)
  ], []);

  // Initialize Simulation
  useEffect(() => {
    agents.current = [];
    food.current = [];
    nextAgentId.current = 0;
    nextFoodId.current = 0;
    onHoverAgent(null);
    onSelectAgent(null);

    // Create initial population
    for (let i = 0; i < params.initialPop; i++) {
      const genome = createRandomGenome();
      agents.current.push({
        id: nextAgentId.current++,
        position: new Vector3(rand(-WORLD_SIZE/2, WORLD_SIZE/2), 0, rand(-WORLD_SIZE/2, WORLD_SIZE/2)),
        velocity: new Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(MAX_SPEED_BASE),
        target: null,
        genes: genome,
        energy: 100,
        age: 0,
        state: 'wandering',
        trail: []
      });
    }

    // Initial food
    for (let i = 0; i < 50; i++) {
      food.current.push({
        id: nextFoodId.current++,
        position: new Vector3(rand(-WORLD_SIZE/2, WORLD_SIZE/2), 0, rand(-WORLD_SIZE/2, WORLD_SIZE/2)),
        value: params.foodValue,
      });
    }
  }, [resetTrigger, params.initialPop]);

  // Main Simulation Loop
  useFrame((state, delta) => {
    const dt = paused ? 0 : Math.min(delta, 0.1) * params.simulationSpeed;

    if (!paused) {
        frameCount.current++;

        // --- 1. Spawn Food ---
        if (Math.random() < params.foodSpawnRate * dt * 5) {
            const clusterX = rand(-WORLD_SIZE/2, WORLD_SIZE/2);
            const clusterZ = rand(-WORLD_SIZE/2, WORLD_SIZE/2);
            for(let k=0; k<rand(1,3); k++) {
                food.current.push({
                    id: nextFoodId.current++,
                    position: new Vector3(clusterX + rand(-5,5), 0, clusterZ + rand(-5,5)),
                    value: params.foodValue
                });
            }
        }

        if (food.current.length > 300) {
            food.current = food.current.slice(food.current.length - 300);
        }

        // --- 2. Update Agents ---
        const currentAgents = agents.current;
        const currentFood = food.current;
        const newAgents: Agent[] = [];
        const deadAgentIds = new Set<number>();
        const consumedFoodIds = new Set<number>();

        for (let i = 0; i < currentAgents.length; i++) {
            const agent = currentAgents[i];
            if (deadAgentIds.has(agent.id)) continue;

            agent.age += dt;
            const energyCost = params.energyCostPerTick * dt * (0.5 * agent.genes.size + 0.5 * agent.genes.speed * agent.genes.speed);
            agent.energy -= energyCost;

            if (agent.energy <= 0 || agent.age > params.maxAge) {
                deadAgentIds.add(agent.id);
                continue;
            }

            // --- Perception & Behavior ---
            let nearestFood: Food | null = null;
            let nearestFoodDist = Infinity;
            let nearestAgent: Agent | null = null;
            let nearestAgentDist = Infinity;
            
            for (const f of currentFood) {
                if (consumedFoodIds.has(f.id)) continue;
                const distSq = agent.position.distanceToSquared(f.position);
                if (distSq < SENSOR_RADIUS * SENSOR_RADIUS && distSq < nearestFoodDist) {
                nearestFoodDist = distSq;
                nearestFood = f;
                }
            }

            for (let j = 0; j < currentAgents.length; j++) {
                if (i === j) continue;
                const other = currentAgents[j];
                if (deadAgentIds.has(other.id)) continue;
                const distSq = agent.position.distanceToSquared(other.position);
                
                if (distSq < SENSOR_RADIUS * SENSOR_RADIUS && distSq < nearestAgentDist) {
                nearestAgentDist = distSq;
                nearestAgent = other;
                }
            }

            const distToFood = Math.sqrt(nearestFoodDist);
            const distToAgent = Math.sqrt(nearestAgentDist);

            const collisionDist = (agent.genes.size + (nearestAgent?.genes.size || 1)) * AGENT_RADIUS_BASE * 0.8;
            
            if (nearestAgent && distToAgent < collisionDist) {
                const mySelfish = agent.genes.selfishness > 0.5;
                const otherSelfish = nearestAgent.genes.selfishness > 0.5;

                if (mySelfish && otherSelfish) {
                    const damage = 20 * dt;
                    agent.energy -= damage;
                    tempVec.subVectors(agent.position, nearestAgent.position).normalize().multiplyScalar(2 * dt);
                    agent.position.add(tempVec);
                } else if (mySelfish && !otherSelfish) {
                    const steal = 10 * dt;
                    if (nearestAgent.energy > steal) {
                        agent.energy += steal;
                        nearestAgent.energy -= steal;
                    }
                    tempVec.subVectors(nearestAgent.position, agent.position).normalize().multiplyScalar(2 * dt);
                    nearestAgent.velocity.add(tempVec);
                } else if (!mySelfish && !otherSelfish) {
                    tempVec.subVectors(agent.position, nearestAgent.position).normalize().multiplyScalar(0.5 * dt);
                    agent.position.add(tempVec);
                } 
            }

            const accel = tempVec.set(0, 0, 0);

            if (nearestFood) {
                if (distToFood < (agent.genes.size * AGENT_RADIUS_BASE + 0.5)) {
                    agent.energy += nearestFood.value;
                    consumedFoodIds.add(nearestFood.id);
                } else {
                    tempVec2.subVectors(nearestFood.position, agent.position).normalize().multiplyScalar(2.0);
                    accel.add(tempVec2);
                }
            } else {
                const noise = new Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(0.5);
                accel.add(noise);
            }

            if (agent.position.x > WORLD_SIZE/2 - 2) accel.x -= 5;
            if (agent.position.x < -WORLD_SIZE/2 + 2) accel.x += 5;
            if (agent.position.z > WORLD_SIZE/2 - 2) accel.z -= 5;
            if (agent.position.z < -WORLD_SIZE/2 + 2) accel.z += 5;

            agent.velocity.add(accel.multiplyScalar(dt));
            const maxSpeed = MAX_SPEED_BASE * agent.genes.speed;
            if (agent.velocity.length() > maxSpeed) {
                agent.velocity.normalize().multiplyScalar(maxSpeed);
            }

            agent.position.add(agent.velocity.clone().multiplyScalar(dt * 10));

            agent.position.x = Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, agent.position.x));
            agent.position.z = Math.max(-WORLD_SIZE/2, Math.min(WORLD_SIZE/2, agent.position.z));

            if (agent.energy > params.reproductionThreshold && currentAgents.length < MAX_POPULATION) {
                agent.energy *= 0.5;
                const offspringGenes = mutateGenome(agent.genes, params.mutationMagnitude * 10 * agent.genes.mutationRate); 
                
                newAgents.push({
                    id: nextAgentId.current++,
                    position: agent.position.clone().add(new Vector3(rand(-1,1), 0, rand(-1,1))),
                    velocity: agent.velocity.clone().multiplyScalar(-1),
                    target: null,
                    genes: offspringGenes,
                    energy: agent.energy,
                    age: 0,
                    state: 'wandering',
                    trail: []
                });
            }
        }

        food.current = currentFood.filter(f => !consumedFoodIds.has(f.id));
        const survivors = currentAgents.filter(a => !deadAgentIds.has(a.id));
        agents.current = [...survivors, ...newAgents];
        
        // Deselect if agent died
        if (selectedAgent && deadAgentIds.has(selectedAgent.id)) {
            // Check if we should nullify selection
            // We can check if selectedAgent is still in agents.current
            // But since this runs in frame loop, triggering react state update might be too frequent if not careful
            // For now, let the user manually deselect or let it point to last known pos
        }
    }

    // --- Render Updates ---
    
    // 1. Update Trails & Agents Mesh
    let trailVertexIndex = 0;
    
    if (agentsMeshRef.current) {
        const mesh = agentsMeshRef.current;
        mesh.count = agents.current.length;
        
        let totalSelfishness = 0;

        for (let i = 0; i < agents.current.length; i++) {
            const agent = agents.current[i];
            
            // --- Update Trail ---
            // Only push if paused is false, or just always maintain trail for visuals
            if (!paused) {
                 agent.trail.push(agent.position.clone());
                 if (agent.trail.length > MAX_TRAIL_POINTS) agent.trail.shift();
            }

            const { r, g, b } = getAgentColorRGB(agent, viewMode);
            
            // Populate Trail Buffer
            if (agent.trail.length > 1) {
                for (let j = 0; j < agent.trail.length - 1; j++) {
                    const p1 = agent.trail[j];
                    const p2 = agent.trail[j+1];

                    // Simple fade logic: older points are darker/more transparent (simulated by black)
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

            // --- Update Agent Instance ---
            tempObj.position.copy(agent.position);
            const scale = agent.genes.size;
            tempObj.scale.set(scale, scale, scale);
            tempObj.updateMatrix();
            mesh.setMatrixAt(i, tempObj.matrix);

            tempColor.setRGB(r, g, b);
            
            // Highlight logic
            const isHovered = hoveredAgent && agent.id === hoveredAgent.id;
            const isSelected = selectedAgent && agent.id === selectedAgent.id;

            if (isHovered || isSelected) {
                tempColor.offsetHSL(0, 0, 0.2);
            }

            mesh.setColorAt(i, tempColor);
            totalSelfishness += agent.genes.selfishness;
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        if (frameCount.current % 10 === 0) {
            onStatsUpdate(agents.current.length, agents.current.length > 0 ? totalSelfishness / agents.current.length : 0);
        }
    }

    // Update Trail Geometry
    if (trailGeoRef.current) {
        trailGeoRef.current.setDrawRange(0, trailVertexIndex);
        trailGeoRef.current.attributes.position.needsUpdate = true;
        trailGeoRef.current.attributes.color.needsUpdate = true;
    }

    if (foodMeshRef.current) {
        const mesh = foodMeshRef.current;
        mesh.count = food.current.length;
        for (let i = 0; i < food.current.length; i++) {
            tempObj.position.copy(food.current[i].position);
            tempObj.scale.set(1, 1, 1);
            tempObj.updateMatrix();
            mesh.setMatrixAt(i, tempObj.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshStandardMaterial color="#111" roughness={0.8} metalness={0.2} />
      </mesh>
      
      {/* Grid Helper */}
      <gridHelper args={[WORLD_SIZE, 20, 0x444444, 0x222222]} />

      {/* Agents Instanced Mesh */}
      <instancedMesh
        ref={agentsMeshRef}
        args={[undefined, undefined, MAX_POPULATION * 2]} // Buffer extra size
        frustumCulled={false}
        castShadow
        receiveShadow
        onClick={(e) => {
             e.stopPropagation();
             if (e.instanceId !== undefined && agents.current[e.instanceId]) {
                 onSelectAgent(agents.current[e.instanceId]);
             }
        }}
        onPointerMove={(e) => {
            e.stopPropagation();
            if (e.instanceId !== undefined && agents.current[e.instanceId]) {
                const agent = agents.current[e.instanceId];
                if (agent.id !== hoveredAgent?.id) {
                     onHoverAgent(agent);
                }
            }
        }}
        onPointerOut={() => onHoverAgent(null)}
      >
        <sphereGeometry args={[AGENT_RADIUS_BASE, 16, 16]} />
        <meshStandardMaterial roughness={0.4} metalness={0.5} />
      </instancedMesh>

      {/* Trails Mesh */}
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
          <lineBasicMaterial vertexColors opacity={0.6} transparent />
      </lineSegments>

      {/* Food Instanced Mesh */}
      <instancedMesh
        ref={foodMeshRef}
        args={[undefined, undefined, 1000]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.5} />
      </instancedMesh>

      {/* Selection Ring (Hover or Selected) */}
      {(hoveredAgent || selectedAgent) && (
          <mesh 
            position={(selectedAgent || hoveredAgent)?.position} 
            rotation={[-Math.PI/2, 0, 0]}
          >
             <ringGeometry 
                args={[
                    0.8 * ((selectedAgent || hoveredAgent)?.genes.size || 1), 
                    0.9 * ((selectedAgent || hoveredAgent)?.genes.size || 1), 
                    32
                ]} 
             />
             <meshBasicMaterial 
                color={selectedAgent ? "#3b82f6" : "white"} 
                opacity={0.8} 
                transparent 
             />
          </mesh>
      )}
    </group>
  );
};