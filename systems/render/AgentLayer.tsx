import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color, BufferGeometry, Vector3 as ThreeVector3, CanvasTexture } from 'three';
import { ViewMode } from '../../core/types';
import { agents } from '../../core/ecs';
import { MAX_POPULATION, AGENT_RADIUS_BASE, HOP_DURATION } from '../../core/constants';
import { getAgentColorRGB } from '../../core/utils';

interface Props {
    viewMode: ViewMode;
    externalGeometry?: BufferGeometry;
    showEnergyBars: boolean;
}

export const AgentLayer: React.FC<Props> = ({ viewMode, externalGeometry, showEnergyBars }) => {
    const meshRef = useRef<InstancedMesh>(null);
    const bodyRef = useRef<InstancedMesh>(null);
    const earsRef = useRef<InstancedMesh>(null);
    const tailRef = useRef<InstancedMesh>(null);
    const eyesRef = useRef<InstancedMesh>(null);
    const pawsRef = useRef<InstancedMesh>(null);
    const energyBarMeshRef = useRef<InstancedMesh>(null);
    const shadowMeshRef = useRef<InstancedMesh>(null);

    const tempObj = useMemo(() => new Object3D(), []);
    const tempColor = useMemo(() => new Color(), []);

    const shadowTexture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
            gradient.addColorStop(0, 'rgba(0,0,0,0.6)');
            gradient.addColorStop(0.5, 'rgba(0,0,0,0.3)');
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 128, 128);
        }
        return new CanvasTexture(canvas);
    }, []);

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
            if (shadowMeshRef.current) shadowMeshRef.current.count = count;

            for (let i = 0; i < count; i++) {
                const entity = allAgents[i];
                const { position, agent } = entity;
                if (!agent) continue;

                // VISIBILITY CHECK: If in burrow, strictly hide
                const isInBurrow = agent.currentBurrowId !== null;
                const scale = isInBurrow ? 0 : agent.genes.size * 3.5;
                
                // If scale is 0, we can just set matrix to 0 scale and continue to save calculation, 
                // but we need to ensure shadows/bars are also hidden.
                if (isInBurrow) {
                    tempObj.scale.set(0,0,0);
                    tempObj.updateMatrix();
                    targetMesh.setMatrixAt(i, tempObj.matrix);
                    if (shadowMeshRef.current) shadowMeshRef.current.setMatrixAt(i, tempObj.matrix);
                    if (energyBarMeshRef.current) energyBarMeshRef.current.setMatrixAt(i, tempObj.matrix);
                    if (!hasExternal) {
                        if (earsRef.current) { earsRef.current.setMatrixAt(i*2, tempObj.matrix); earsRef.current.setMatrixAt(i*2+1, tempObj.matrix); }
                        if (tailRef.current) tailRef.current.setMatrixAt(i, tempObj.matrix);
                        if (eyesRef.current) { eyesRef.current.setMatrixAt(i*2, tempObj.matrix); eyesRef.current.setMatrixAt(i*2+1, tempObj.matrix); }
                        if (pawsRef.current) { pawsRef.current.setMatrixAt(i*2, tempObj.matrix); pawsRef.current.setMatrixAt(i*2+1, tempObj.matrix); }
                    }
                    continue; 
                }

                // Animation Logic
                let hopY = 0;
                let bodyTilt = 0;
                let rootYOffset = 0;
                
                const isStaticState = agent.state === 'resting' || agent.state === 'sleeping' || agent.state === 'snuggling';

                if (!isStaticState && agent.state !== 'digging' && agent.hopTimer < HOP_DURATION) {
                    const progress = agent.hopTimer / HOP_DURATION;
                    const baseHeight = scale * 0.8; 
                    const speedFactor = Math.max(0.6, agent.genes.speed * 0.8);
                    const jumpSeed = Math.floor(agent.age) + entity.id; 
                    const randomVar = (Math.sin(jumpSeed * 12.9898) * 0.5 + 0.5) * 0.4 + 0.8; 
                    
                    hopY = Math.sin(progress * Math.PI) * baseHeight * speedFactor * randomVar;
                    bodyTilt = -Math.sin(progress * Math.PI) * 0.3 * speedFactor;

                } else if (isStaticState) {
                    // Gentle breathing
                    hopY = Math.sin(state.clock.elapsedTime * 2 + entity.id) * 0.05 * scale;
                    if (agent.state === 'snuggling') bodyTilt = 0.1;
                } else if (agent.state === 'digging') {
                    // Digging Animation: Rapid bobbing with head down and root motion downward
                    const digCycle = (state.clock.elapsedTime * 15) % (Math.PI * 2);
                    hopY = Math.sin(digCycle) * 0.1 * scale;
                    bodyTilt = Math.PI / 3.5; // Steep head down
                    rootYOffset = -0.2 * scale; // Sink slightly into ground
                }

                const currentPos = position.clone();
                currentPos.y += hopY + rootYOffset;

                const dummyBase = new Object3D();
                dummyBase.position.copy(currentPos);
                
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

                // Update Shadow
                if (shadowMeshRef.current) {
                    tempObj.position.set(position.x, 0.05, position.z); // Slightly above ground
                    tempObj.rotation.set(-Math.PI / 2, 0, 0);
                    
                    const heightFactor = 1.0 / (1.0 + Math.max(0, hopY) * 0.5);
                    const shadowScale = scale * 1.5 * heightFactor;
                    
                    tempObj.scale.set(shadowScale, shadowScale, 1);
                    tempObj.updateMatrix();
                    shadowMeshRef.current.setMatrixAt(i, tempObj.matrix);
                } 

                // Energy Bar
                if (energyBarMeshRef.current && showEnergyBars) {
                    const energyRatio = Math.min(agent.energy / 100, 1.0);
                    const barColor = new Color().setHSL(energyRatio * 0.33, 1.0, 0.5); 
                    tempObj.position.copy(position);
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
                // (Procedural loop repeats similar logic for positions, but we skip for brevity as structure is identical to body loop above)
                // We must iterate again for parts to match the body logic we just did, or refactor to single loop.
                // Refactoring for safety:
                for (let i = 0; i < count; i++) {
                     const entity = allAgents[i];
                     if(!entity.agent) continue;
                     const { position, agent } = entity;
                     const isInBurrow = agent.currentBurrowId !== null;
                     
                     if (isInBurrow) {
                        // Parts already hidden by initial scale=0 check if we move this loop or add check here
                         tempObj.scale.set(0,0,0); tempObj.updateMatrix();
                         earsRef.current.setMatrixAt(i*2, tempObj.matrix); earsRef.current.setMatrixAt(i*2+1, tempObj.matrix);
                         tailRef.current!.setMatrixAt(i, tempObj.matrix);
                         eyesRef.current.setMatrixAt(i*2, tempObj.matrix); eyesRef.current.setMatrixAt(i*2+1, tempObj.matrix);
                         pawsRef.current.setMatrixAt(i*2, tempObj.matrix); pawsRef.current.setMatrixAt(i*2+1, tempObj.matrix);
                         continue;
                     }

                     const scale = agent.genes.size * 3.5;
                     
                     // Re-calc anims (in optimized engine we'd cache this)
                     let hopY = 0;
                     let rootYOffset = 0;
                     if (agent.state === 'digging') {
                         hopY = Math.sin((state.clock.elapsedTime * 15) % (Math.PI * 2)) * 0.1 * scale;
                         rootYOffset = -0.2 * scale;
                     } else if (!['resting','sleeping','snuggling'].includes(agent.state) && agent.hopTimer < HOP_DURATION) {
                         const progress = agent.hopTimer / HOP_DURATION;
                         hopY = Math.sin(progress * Math.PI) * scale * 0.8 * Math.max(0.6, agent.genes.speed * 0.8) * ((Math.sin((Math.floor(agent.age)+entity.id)*12.9) * 0.5 + 0.5) * 0.4 + 0.8);
                     } else if (['resting','sleeping','snuggling'].includes(agent.state)) {
                         hopY = Math.sin(state.clock.elapsedTime * 2 + entity.id) * 0.05 * scale;
                     }

                     const currentPos = position.clone();
                     currentPos.y += hopY + rootYOffset;
                     const dummyBase = new Object3D();
                     dummyBase.position.copy(currentPos);
                     dummyBase.lookAt(currentPos.clone().add(agent.heading));
                     
                     // Apply tilt again
                     if(agent.state === 'digging') dummyBase.rotateX(Math.PI / 3.5);
                     else if (agent.state === 'snuggling') dummyBase.rotateX(0.1);
                     else if (agent.hopTimer < HOP_DURATION && !['resting','sleeping','snuggling'].includes(agent.state)) {
                        const progress = agent.hopTimer / HOP_DURATION;
                        dummyBase.rotateX(-Math.sin(progress * Math.PI) * 0.3 * Math.max(0.6, agent.genes.speed * 0.8));
                     }

                     const { r, g, b } = getAgentColorRGB(agent, viewMode);
                     tempColor.setRGB(r, g, b);

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
            
            if (shadowMeshRef.current) {
                shadowMeshRef.current.instanceMatrix.needsUpdate = true;
            }

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

            <instancedMesh 
                ref={shadowMeshRef} 
                args={[undefined, undefined, MAX_POPULATION]} 
                frustumCulled={false}
            >
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial 
                    map={shadowTexture} 
                    transparent={true} 
                    opacity={0.8} 
                    depthWrite={false} 
                    alphaTest={0.01}
                />
            </instancedMesh>

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