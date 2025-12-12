import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color, BufferGeometry, Vector3 as ThreeVector3, MathUtils } from 'three';
import { ViewMode } from '../../types';
import { agents } from '../../core/ecs';
import { MAX_POPULATION, AGENT_RADIUS_BASE } from '../../core/constants';
import { getAgentColorRGB } from '../../core/utils';

interface Props {
    viewMode: ViewMode;
    externalGeometry?: BufferGeometry;
    showEnergyBars: boolean;
}

const HOP_DURATION = 0.3; // Must match AgentSystem

export const AgentLayer: React.FC<Props> = ({ viewMode, externalGeometry, showEnergyBars }) => {
    const meshRef = useRef<InstancedMesh>(null);
    const bodyRef = useRef<InstancedMesh>(null);
    const earsRef = useRef<InstancedMesh>(null);
    const tailRef = useRef<InstancedMesh>(null);
    const eyesRef = useRef<InstancedMesh>(null);
    const pawsRef = useRef<InstancedMesh>(null);
    const energyBarMeshRef = useRef<InstancedMesh>(null);

    const tempObj = useMemo(() => new Object3D(), []);
    const tempColor = useMemo(() => new Color(), []);

    useFrame((state) => {
        const allAgents = agents.entities;
        const count = allAgents.length;

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

        if (targetMesh) {
            targetMesh.count = count;
            if (earsRef.current) earsRef.current.count = count * 2;
            if (tailRef.current) tailRef.current.count = count;
            if (eyesRef.current) eyesRef.current.count = count * 2;
            if (pawsRef.current) pawsRef.current.count = count * 2;
            if (energyBarMeshRef.current) energyBarMeshRef.current.count = showEnergyBars ? count : 0;

            for (let i = 0; i < count; i++) {
                const entity = allAgents[i];
                const { position, agent } = entity;
                if (!agent) continue;

                // Scale Logic: Increased to 3.5x for better visibility
                const scale = agent.genes.size * 3.5;
                
                // Animation Logic
                // Sync animation perfectly with the hop timer from AgentSystem
                let hopY = 0;
                let bodyTilt = 0;
                
                // Check if actively hopping (timer < duration AND not resting)
                if (agent.state !== 'resting' && agent.hopTimer < HOP_DURATION) {
                    const progress = agent.hopTimer / HOP_DURATION; // 0 to 1
                    
                    // Parabolic arc for jump height
                    // Sin(0) -> 0, Sin(PI/2) -> 1, Sin(PI) -> 0
                    hopY = Math.sin(progress * Math.PI) * scale * 0.8;
                    
                    // Tilt forward slightly during jump
                    bodyTilt = -Math.sin(progress * Math.PI) * 0.2;
                } else if (agent.state === 'resting') {
                    // Slight breathing animation when resting
                    hopY = Math.sin(state.clock.elapsedTime * 2 + entity.id) * 0.05 * scale;
                }

                const currentPos = position.clone();
                currentPos.y += hopY;

                const dummyBase = new Object3D();
                dummyBase.position.copy(currentPos);
                
                // Orientation: Look at heading
                const lookTarget = currentPos.clone().add(agent.heading);
                dummyBase.lookAt(lookTarget);
                dummyBase.rotateX(bodyTilt);

                const { r, g, b } = getAgentColorRGB(agent, viewMode);
                tempColor.setRGB(r, g, b);

                if (hasExternal) {
                    tempObj.position.copy(currentPos);
                    tempObj.rotation.copy(dummyBase.rotation);
                    tempObj.scale.set(scale, scale, scale);
                    tempObj.updateMatrix();
                    targetMesh.setMatrixAt(i, tempObj.matrix);
                    targetMesh.setColorAt(i, tempColor);
                } else {
                    updatePart(bodyRef.current!, i, currentPos, dummyBase, scale, new ThreeVector3(0, 0.5, 0), new ThreeVector3(1, 1, 1));
                    bodyRef.current!.setColorAt(i, tempColor);
                }

                // Energy Bar
                if (energyBarMeshRef.current && showEnergyBars) {
                    const energyRatio = Math.min(agent.energy / 100, 1.0);
                    const barColor = new Color().setHSL(energyRatio * 0.33, 1.0, 0.5); 
                    tempObj.position.copy(position);
                    // Adjust bar height higher due to scale increase
                    tempObj.position.y += (scale * AGENT_RADIUS_BASE * 1.5) + 2.5; 
                    tempObj.rotation.set(0,0,0);
                    tempObj.scale.set(Math.max(0.01, energyRatio), 1, 1);
                    tempObj.updateMatrix();
                    energyBarMeshRef.current.setMatrixAt(i, tempObj.matrix);
                    energyBarMeshRef.current.setColorAt(i, barColor);
                }
            }

            // Procedural Parts Update (if not using external model)
            if (!hasExternal && earsRef.current && eyesRef.current && pawsRef.current) {
                // ... (Logic mostly same, just ensuring scale prop is used correctly) ...
                for (let i = 0; i < count; i++) {
                     const entity = allAgents[i];
                     if(!entity.agent) continue;
                     const { position, agent } = entity;
                     const scale = agent.genes.size * 3.5;
                     
                     // Re-calc height for procedural parts
                     let hopY = 0;
                     if (agent.state !== 'resting' && agent.hopTimer < HOP_DURATION) {
                         const progress = agent.hopTimer / HOP_DURATION;
                         hopY = Math.sin(progress * Math.PI) * scale * 0.8;
                     } else if (agent.state === 'resting') {
                         hopY = Math.sin(state.clock.elapsedTime * 2 + entity.id) * 0.05 * scale;
                     }
                     
                     const currentPos = position.clone();
                     currentPos.y += hopY;
                     const dummyBase = new Object3D();
                     dummyBase.position.copy(currentPos);
                     dummyBase.lookAt(currentPos.clone().add(agent.heading));

                     const { r, g, b } = getAgentColorRGB(agent, viewMode);
                     tempColor.setRGB(r, g, b);

                     // Procedural animation details (ear wiggle, etc)
                     const wiggle = Math.sin(state.clock.elapsedTime * 10 + entity.id) * 0.1;

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

                     const pawY = (agent.hopTimer < HOP_DURATION) ? Math.sin(agent.hopTimer * 10) * 0.1 : 0;
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
            if (targetMesh.instanceColor) targetMesh.instanceColor.needsUpdate = true;
            if (energyBarMeshRef.current) {
                energyBarMeshRef.current.instanceMatrix.needsUpdate = true;
                if (energyBarMeshRef.current.instanceColor) energyBarMeshRef.current.instanceColor.needsUpdate = true;
            }
        }
    });

    return (
        <>
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

            {!externalGeometry && (
                <>
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
                    <instancedMesh ref={earsRef} args={[undefined, undefined, MAX_POPULATION * 2]} frustumCulled={false} castShadow>
                        <capsuleGeometry args={[0.12, 0.4, 4, 8]} />
                        <meshStandardMaterial roughness={0.5} metalness={0.1} />
                    </instancedMesh>
                    <instancedMesh ref={tailRef} args={[undefined, undefined, MAX_POPULATION]} frustumCulled={false}>
                        <sphereGeometry args={[0.18, 8, 8]} />
                        <meshStandardMaterial roughness={0.8} metalness={0} />
                    </instancedMesh>
                    <instancedMesh ref={eyesRef} args={[undefined, undefined, MAX_POPULATION * 2]} frustumCulled={false}>
                        <sphereGeometry args={[0.12, 12, 12]} />
                        <meshStandardMaterial color="black" roughness={0.2} metalness={0.8} />
                    </instancedMesh>
                    <instancedMesh ref={pawsRef} args={[undefined, undefined, MAX_POPULATION * 2]} frustumCulled={false}>
                        <sphereGeometry args={[0.12, 8, 8]} />
                        <meshStandardMaterial roughness={0.5} metalness={0.1} />
                    </instancedMesh>
                </>
            )}

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
        </>
    );
};