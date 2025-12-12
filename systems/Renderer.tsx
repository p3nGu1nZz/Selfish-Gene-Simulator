import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color, DynamicDrawUsage, BufferGeometry, Shape, DoubleSide, AdditiveBlending, Matrix4, Vector3 as ThreeVector3, Quaternion, Material, MeshStandardMaterial } from 'three';
import { ViewMode, Entity } from '../types';
import { agents, food, particles } from '../ecs';
import { WORLD_SIZE, MAX_POPULATION, AGENT_RADIUS_BASE, MAX_TRAIL_POINTS } from '../constants';

export interface RendererProps {
    paused: boolean;
    viewMode: ViewMode;
    onHoverAgent: (agent: Entity | null) => void;
    hoveredAgent: Entity | null;
    onSelectAgent: (agent: Entity | null) => void;
    selectedAgent: Entity | null;
    showEnergyBars: boolean;
    externalGeometry?: BufferGeometry;
    foodGeometry?: BufferGeometry;
    foodMaterial?: Material;
}

export const getAgentColorRGB = (agentData: any, viewMode: ViewMode): {r: number, g: number, b: number} => {
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

const heartShape = new Shape();
const x = 0, y = 0;
heartShape.moveTo(x + 0.25, y + 0.25);
heartShape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.20, y, x, y);
heartShape.bezierCurveTo(x - 0.30, y, x - 0.30, y + 0.35, x - 0.30, y + 0.35);
heartShape.bezierCurveTo(x - 0.30, y + 0.55, x - 0.10, y + 0.77, x + 0.25, y + 0.95);
heartShape.bezierCurveTo(x + 0.60, y + 0.77, x + 0.80, y + 0.55, x + 0.80, y + 0.35);
heartShape.bezierCurveTo(x + 0.80, y + 0.35, x + 0.80, y, x + 0.50, y);
heartShape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);

export const RendererSystem: React.FC<RendererProps> = ({ 
    paused, 
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
    // Refs
    const meshRef = useRef<InstancedMesh>(null);
    const hitboxRef = useRef<InstancedMesh>(null); // Invisible large click targets
    const bodyRef = useRef<InstancedMesh>(null);
    const earsRef = useRef<InstancedMesh>(null);
    const tailRef = useRef<InstancedMesh>(null);
    const eyesRef = useRef<InstancedMesh>(null);
    const pawsRef = useRef<InstancedMesh>(null);
    const foodMeshRef = useRef<InstancedMesh>(null);
    const particleMeshRef = useRef<InstancedMesh>(null);
    const heartMeshRef = useRef<InstancedMesh>(null);
    const energyBarMeshRef = useRef<InstancedMesh>(null);
    const trailGeoRef = useRef<BufferGeometry>(null);

    // Helpers
    const interactionRef = useRef<Entity[]>([]);
    const tempObj = useMemo(() => new Object3D(), []);
    const tempColor = useMemo(() => new Color(), []);
    
    // Trail Buffers
    const MAX_SEGMENTS = MAX_POPULATION * (MAX_TRAIL_POINTS - 1);
    const [trailPositions, trailColors] = useMemo(() => [
        new Float32Array(MAX_SEGMENTS * 2 * 3),
        new Float32Array(MAX_SEGMENTS * 2 * 3)
    ], []);

    useFrame((state, delta) => {
        const time = state.clock.elapsedTime;
        const allAgents = agents.entities;
        interactionRef.current = allAgents;

        const updatePart = (
            mesh: InstancedMesh, 
            index: number, 
            basePos: ThreeVector3, 
            baseRot: Object3D, 
            baseScale: number,
            partOffset: ThreeVector3, 
            partScaleVec: ThreeVector3,
            partRotOffset: ThreeVector3 = new ThreeVector3(0,0,0)
        ) => {
            tempObj.position.copy(basePos);
            tempObj.rotation.copy(baseRot.rotation);
            tempObj.scale.set(baseScale, baseScale, baseScale);
            const offsetRotated = partOffset.clone().applyEuler(baseRot.rotation);
            tempObj.position.add(offsetRotated);
            tempObj.rotateX(partRotOffset.x);
            tempObj.rotateY(partRotOffset.y);
            tempObj.rotateZ(partRotOffset.z);
            tempObj.scale.multiply(partScaleVec);
            tempObj.updateMatrix();
            mesh.setMatrixAt(index, tempObj.matrix);
        };

        const hasExternal = !!externalGeometry;
        const targetMesh = hasExternal ? meshRef.current : bodyRef.current;
        
        if (targetMesh && hitboxRef.current) {
            targetMesh.count = allAgents.length;
            hitboxRef.current.count = allAgents.length;

            if (earsRef.current) earsRef.current.count = allAgents.length * 2;
            if (tailRef.current) tailRef.current.count = allAgents.length;
            if (eyesRef.current) eyesRef.current.count = allAgents.length * 2;
            if (pawsRef.current) pawsRef.current.count = allAgents.length * 2;
            if (energyBarMeshRef.current) energyBarMeshRef.current.count = showEnergyBars ? allAgents.length : 0;

            let trailVertexIndex = 0;
            
            for (let i = 0; i < allAgents.length; i++) {
                const entity = allAgents[i];
                const { position, agent, velocity } = entity;
                if(!agent) continue;

                const scale = agent.genes.size;
                const speed = velocity ? velocity.length() : 0;
                const isMoving = speed > 0.05;

                // Improved Organic Hopping
                let hopY = 0;
                if (isMoving) {
                    const hopFreq = 6 + (speed * 10); 
                    const hopPhase = entity.id * 13.37;
                    const rawHop = Math.sin(time * hopFreq + hopPhase);
                    hopY = Math.pow(Math.abs(rawHop), 1.5) * 0.4 * scale; 
                }
                
                const currentPos = position.clone();
                currentPos.y += hopY;

                const dummyBase = new Object3D();
                dummyBase.position.copy(currentPos);
                if (velocity && velocity.lengthSq() > 0.001) {
                    dummyBase.lookAt(currentPos.clone().add(velocity));
                }

                const { r, g, b } = getAgentColorRGB(agent, viewMode);
                tempColor.setRGB(r, g, b);
                if (hoveredAgent === entity || selectedAgent === entity) {
                    tempColor.offsetHSL(0, 0, 0.2);
                }

                if (hasExternal) {
                    // Update Visual Mesh
                    tempObj.position.copy(currentPos);
                    tempObj.rotation.copy(dummyBase.rotation);
                    tempObj.scale.set(scale, scale, scale);
                    tempObj.updateMatrix();
                    targetMesh.setMatrixAt(i, tempObj.matrix);
                    targetMesh.setColorAt(i, tempColor);
                } else {
                    // Procedural Body
                    updatePart(bodyRef.current!, i, currentPos, dummyBase, scale, new ThreeVector3(0, 0.5, 0), new ThreeVector3(1, 1, 1));
                    bodyRef.current!.setColorAt(i, tempColor);
                }

                // Update Hitbox (Invisible, larger)
                tempObj.position.copy(currentPos);
                // Lift hitbox slightly so it centers on the body not feet
                tempObj.position.y += 0.5 * scale; 
                tempObj.rotation.copy(dummyBase.rotation);
                // Extra generous scale for clicking
                const hitScale = scale * 1.5; 
                tempObj.scale.set(hitScale, hitScale, hitScale);
                tempObj.updateMatrix();
                hitboxRef.current.setMatrixAt(i, tempObj.matrix);


                if (energyBarMeshRef.current && showEnergyBars) {
                    const energyRatio = Math.min(agent.energy / 100, 1.0);
                    const barColor = new Color().setHSL(energyRatio * 0.33, 1.0, 0.5); 
                    tempObj.position.copy(position);
                    tempObj.position.y += (agent.genes.size * AGENT_RADIUS_BASE) + 1.5; 
                    tempObj.rotation.set(0,0,0);
                    tempObj.scale.set(Math.max(0.01, energyRatio), 1, 1);
                    tempObj.updateMatrix();
                    energyBarMeshRef.current.setMatrixAt(i, tempObj.matrix);
                    energyBarMeshRef.current.setColorAt(i, barColor);
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
            }

            // Procedural Extras Loop
            if (!hasExternal && earsRef.current && eyesRef.current && pawsRef.current) {
                for (let i = 0; i < allAgents.length; i++) {
                    const entity = allAgents[i];
                    if(!entity.agent) continue;
                    const { position, velocity, agent } = entity;
                    const scale = agent.genes.size;
                    const speed = velocity ? velocity.length() : 0;
                    const isMoving = speed > 0.05;
                    
                    let hopY = 0;
                    if (isMoving) {
                        const hopFreq = 6 + (speed * 10); 
                        const hopPhase = entity.id * 13.37;
                        const rawHop = Math.sin(time * hopFreq + hopPhase);
                        hopY = Math.pow(Math.abs(rawHop), 1.5) * 0.4 * scale; 
                    }
                    
                    const currentPos = position.clone();
                    currentPos.y += hopY;
                    const dummyBase = new Object3D();
                    dummyBase.position.copy(currentPos);
                    if (velocity && velocity.lengthSq() > 0.001) dummyBase.lookAt(currentPos.clone().add(velocity));

                    const { r, g, b } = getAgentColorRGB(agent, viewMode);
                    tempColor.setRGB(r, g, b);
                    if (hoveredAgent === entity || selectedAgent === entity) tempColor.offsetHSL(0, 0, 0.2);

                    const wiggle = Math.sin(time * 10 + entity.id) * 0.1;

                    updatePart(earsRef.current, i * 2, currentPos, dummyBase, scale, 
                        new ThreeVector3(-0.2, 0.9, 0), new ThreeVector3(1, 1, 1), new ThreeVector3(wiggle + 0.1, 0, -0.2));
                    earsRef.current.setColorAt(i * 2, tempColor);
                    
                    updatePart(earsRef.current, i * 2 + 1, currentPos, dummyBase, scale, 
                        new ThreeVector3(0.2, 0.9, 0), new ThreeVector3(1, 1, 1), new ThreeVector3(wiggle - 0.1, 0, 0.2));
                    earsRef.current.setColorAt(i * 2 + 1, tempColor);

                    const eyeColor = new Color(0,0,0);
                    updatePart(eyesRef.current, i * 2, currentPos, dummyBase, scale, 
                        new ThreeVector3(-0.15, 0.6, 0.35), new ThreeVector3(1, 1, 1));
                    eyesRef.current.setColorAt(i * 2, eyeColor);
                    updatePart(eyesRef.current, i * 2 + 1, currentPos, dummyBase, scale, 
                        new ThreeVector3(0.15, 0.6, 0.35), new ThreeVector3(1, 1, 1));
                    eyesRef.current.setColorAt(i * 2 + 1, eyeColor);
                    
                    updatePart(tailRef.current!, i, currentPos, dummyBase, scale, 
                        new ThreeVector3(0, 0.2, -0.45), new ThreeVector3(1, 1, 1));
                    tailRef.current!.setColorAt(i, tempColor);

                    const pawY = isMoving ? Math.sin(time * 20 + entity.id) * 0.1 : 0;
                    updatePart(pawsRef.current, i * 2, currentPos, dummyBase, scale, 
                        new ThreeVector3(-0.2, 0.1 + pawY, 0.3), new ThreeVector3(1, 1, 1));
                    pawsRef.current.setColorAt(i * 2, tempColor);
                    updatePart(pawsRef.current, i * 2 + 1, currentPos, dummyBase, scale, 
                        new ThreeVector3(0.2, 0.1 - pawY, 0.3), new ThreeVector3(1, 1, 1));
                    pawsRef.current.setColorAt(i * 2 + 1, tempColor);
                }
                earsRef.current.instanceMatrix.needsUpdate = true;
                if(earsRef.current.instanceColor) earsRef.current.instanceColor.needsUpdate = true;
                eyesRef.current.instanceMatrix.needsUpdate = true;
                if(eyesRef.current.instanceColor) eyesRef.current.instanceColor.needsUpdate = true;
                tailRef.current!.instanceMatrix.needsUpdate = true;
                if(tailRef.current!.instanceColor) tailRef.current!.instanceColor.needsUpdate = true;
                pawsRef.current.instanceMatrix.needsUpdate = true;
                if(pawsRef.current.instanceColor) pawsRef.current.instanceColor.needsUpdate = true;
            }

            targetMesh.instanceMatrix.needsUpdate = true;
            hitboxRef.current.instanceMatrix.needsUpdate = true;
            
            if (targetMesh.instanceColor) targetMesh.instanceColor.needsUpdate = true;
            if (energyBarMeshRef.current) {
                energyBarMeshRef.current.instanceMatrix.needsUpdate = true;
                if (energyBarMeshRef.current.instanceColor) energyBarMeshRef.current.instanceColor.needsUpdate = true;
            }
            if (trailGeoRef.current) {
                trailGeoRef.current.setDrawRange(0, trailVertexIndex);
                trailGeoRef.current.attributes.position.needsUpdate = true;
                trailGeoRef.current.attributes.color.needsUpdate = true;
            }
        }

        // Food
        if (foodMeshRef.current) {
            const mesh = foodMeshRef.current;
            const allFood = food.entities;
            mesh.count = allFood.length;
            for (let i = 0; i < allFood.length; i++) {
                tempObj.position.copy(allFood[i].position);
                if (foodGeometry) {
                    // Adjust carrot: scale up and rotate to stand up or angle
                    tempObj.scale.set(1.5, 1.5, 1.5);
                    // Add some random rotation for variety
                    tempObj.rotation.set(0, Math.random() * Math.PI, Math.PI / 4);
                } else {
                    tempObj.scale.set(1, 1, 1);
                    tempObj.rotation.set(0,0,0);
                }
                tempObj.updateMatrix();
                mesh.setMatrixAt(i, tempObj.matrix);
            }
            mesh.instanceMatrix.needsUpdate = true;
        }

        // Particles
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
                    tempObj.lookAt(state.camera.position);
                    tempObj.rotateZ(p.rotation || 0);
                    tempObj.updateMatrix();
                    hMesh.setMatrixAt(hCount, tempObj.matrix);
                    hMesh.setColorAt(hCount, p.color);
                    hCount++;
                } else {
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

    const handleInteract = (instanceId: number | undefined, isMultiPart: boolean = false) => {
        if (instanceId !== undefined) {
            const index = isMultiPart ? Math.floor(instanceId / 2) : instanceId;
            const entity = interactionRef.current[index];
            if (entity) onSelectAgent(entity);
        }
    };
    const handleHover = (instanceId: number | undefined, isMultiPart: boolean = false) => {
        if (instanceId !== undefined) {
            const index = isMultiPart ? Math.floor(instanceId / 2) : instanceId;
            const entity = interactionRef.current[index];
            if (entity && entity !== hoveredAgent) onHoverAgent(entity);
        } else {
            onHoverAgent(null);
        }
    };

    return (
        <group>
            {/* Ground */}
            <mesh 
                rotation={[-Math.PI / 2, 0, 0]} 
                position={[0, -0.5, 0]} 
                receiveShadow
                onClick={(e) => { e.stopPropagation(); onSelectAgent(null); }}
                onPointerOver={() => document.body.style.cursor = 'default'}
            >
                <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
                <meshStandardMaterial color="#111" roughness={0.8} metalness={0.2} />
            </mesh>
            <gridHelper args={[WORLD_SIZE, 20, 0x444444, 0x222222]} />

             {/* HITBOX LAYER - Invisible but interactive */}
             <instancedMesh
                ref={hitboxRef}
                args={[undefined, undefined, MAX_POPULATION]}
                visible={true} // Must be visible for raycasting
                onClick={(e) => { e.stopPropagation(); handleInteract(e.instanceId); }}
                onPointerMove={(e) => { e.stopPropagation(); handleHover(e.instanceId); }}
                onPointerOut={() => onHoverAgent(null)}
            >
                <sphereGeometry args={[0.8, 8, 8]} /> {/* Larger radius for easier clicking */}
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </instancedMesh>

            {/* Agents - External Model */}
            {externalGeometry && (
                <instancedMesh
                    ref={meshRef}
                    args={[externalGeometry, undefined, MAX_POPULATION]}
                    frustumCulled={false}
                    castShadow
                    receiveShadow
                >
                    <meshStandardMaterial roughness={0.4} metalness={0.5} />
                </instancedMesh>
            )}

            {/* Agents - Procedural Multi-Mesh */}
            {!externalGeometry && (
                <>
                    {/* Body */}
                    <instancedMesh
                        ref={bodyRef}
                        args={[undefined, undefined, MAX_POPULATION]}
                        frustumCulled={false}
                        castShadow
                        receiveShadow
                    >
                        <sphereGeometry args={[0.45, 16, 16]} />
                        <meshStandardMaterial roughness={0.5} metalness={0.1} />
                    </instancedMesh>
                    
                    {/* Ears */}
                    <instancedMesh ref={earsRef} args={[undefined, undefined, MAX_POPULATION * 2]} frustumCulled={false} castShadow>
                        <capsuleGeometry args={[0.12, 0.4, 4, 8]} />
                        <meshStandardMaterial roughness={0.5} metalness={0.1} />
                    </instancedMesh>

                    {/* Tail */}
                    <instancedMesh ref={tailRef} args={[undefined, undefined, MAX_POPULATION]} frustumCulled={false}>
                        <sphereGeometry args={[0.18, 8, 8]} />
                        <meshStandardMaterial roughness={0.8} metalness={0} />
                    </instancedMesh>

                    {/* Eyes */}
                    <instancedMesh ref={eyesRef} args={[undefined, undefined, MAX_POPULATION * 2]} frustumCulled={false}>
                        <sphereGeometry args={[0.12, 12, 12]} />
                        <meshStandardMaterial color="black" roughness={0.2} metalness={0.8} />
                    </instancedMesh>

                    {/* Paws */}
                    <instancedMesh ref={pawsRef} args={[undefined, undefined, MAX_POPULATION * 2]} frustumCulled={false}>
                        <sphereGeometry args={[0.12, 8, 8]} />
                        <meshStandardMaterial roughness={0.5} metalness={0.1} />
                    </instancedMesh>
                </>
            )}

            {/* Energy Bars */}
            {showEnergyBars && (
                <instancedMesh
                    ref={energyBarMeshRef}
                    args={[undefined, undefined, MAX_POPULATION]}
                    frustumCulled={false}
                >
                    <boxGeometry args={[1.5, 0.15, 0.15]} />
                    <meshBasicMaterial />
                </instancedMesh>
            )}

            {/* Standard Particles */}
            <instancedMesh ref={particleMeshRef} args={[undefined, undefined, 2000]} frustumCulled={false}>
                <boxGeometry args={[0.7, 0.7, 0.7]} />
                <meshBasicMaterial transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Heart Particles */}
            <instancedMesh ref={heartMeshRef} args={[undefined, undefined, 500]} frustumCulled={false}>
                <shapeGeometry args={[heartShape]} />
                <meshBasicMaterial color="#ff69b4" side={DoubleSide} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} />
            </instancedMesh>

            {/* Trails */}
            <lineSegments frustumCulled={false}>
                <bufferGeometry ref={trailGeoRef}>
                    <bufferAttribute attach="attributes-position" count={trailPositions.length / 3} array={trailPositions} itemSize={3} usage={DynamicDrawUsage} />
                    <bufferAttribute attach="attributes-color" count={trailColors.length / 3} array={trailColors} itemSize={3} usage={DynamicDrawUsage} />
                </bufferGeometry>
                <lineBasicMaterial vertexColors opacity={0.6} transparent blending={AdditiveBlending} />
            </lineSegments>

            {/* Food */}
            {foodGeometry ? (
                 <instancedMesh ref={foodMeshRef} args={[foodGeometry, undefined, 1000]} frustumCulled={false}>
                    <primitive object={foodMaterial || new MeshStandardMaterial({ color: 'orange' })} attach="material" />
                </instancedMesh>
            ) : (
                <instancedMesh ref={foodMeshRef} args={[undefined, undefined, 1000]} frustumCulled={false}>
                    <boxGeometry args={[0.5, 0.5, 0.5]} />
                    <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.5} />
                </instancedMesh>
            )}

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
                    <meshBasicMaterial color={selectedAgent ? "#3b82f6" : "white"} opacity={0.8} transparent blending={AdditiveBlending} side={2} />
                </mesh>
            )}
        </group>
    );
};