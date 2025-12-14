import React, { useRef, useMemo } from 'react';
import '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color, BufferGeometry, CanvasTexture, Vector3 } from 'three';
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
    const energyBarMeshRef = useRef<InstancedMesh>(null);
    const shadowMeshRef = useRef<InstancedMesh>(null);

    const tempObj = useMemo(() => new Object3D(), []);
    const tempColor = useMemo(() => new Color(), []);
    const tempVec = useMemo(() => new Vector3(), []);
    const dummyBase = useMemo(() => new Object3D(), []);

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
        const targetMesh = meshRef.current;

        if (targetMesh && externalGeometry) {
            targetMesh.count = count;
            if (energyBarMeshRef.current) energyBarMeshRef.current.count = showEnergyBars ? count : 0;
            if (shadowMeshRef.current) shadowMeshRef.current.count = count;

            for (let i = 0; i < count; i++) {
                const entity = allAgents[i];
                const { position, agent } = entity;
                if (!agent) continue;

                const isInBurrow = agent.currentBurrowId !== null;
                const scale = isInBurrow ? 0 : agent.genes.size * 2.5; 
                
                if (isInBurrow) {
                    tempObj.scale.set(0,0,0);
                    tempObj.updateMatrix();
                    targetMesh.setMatrixAt(i, tempObj.matrix);
                    if (shadowMeshRef.current) shadowMeshRef.current.setMatrixAt(i, tempObj.matrix);
                    if (energyBarMeshRef.current) energyBarMeshRef.current.setMatrixAt(i, tempObj.matrix);
                    continue; 
                }

                // Animation
                let hopY = 0;
                let bodyTilt = 0;
                let rootYOffset = 0;
                const isStaticState = agent.state === 'resting' || agent.state === 'sleeping' || agent.state === 'snuggling';

                if (!isStaticState && agent.state !== 'digging' && agent.hopTimer < HOP_DURATION) {
                    const progress = agent.hopTimer / HOP_DURATION;
                    const speedMag = entity.velocity ? entity.velocity.length() : 0;
                    
                    const velocityFactor = speedMag * 0.2; 
                    const sizeFactor = scale * 0.3;
                    const dynamicHeight = Math.max(sizeFactor, Math.min(scale * 3.0, velocityFactor + sizeFactor));

                    hopY = Math.sin(progress * Math.PI) * dynamicHeight;
                    bodyTilt = -Math.sin(progress * Math.PI) * 0.3 * Math.min(1.0, speedMag * 0.1);
                } else if (isStaticState) {
                    hopY = Math.sin(state.clock.elapsedTime * 2 + entity.id) * 0.05 * scale;
                    if (agent.state === 'snuggling') bodyTilt = 0.1;
                } else if (agent.state === 'digging') {
                    const digCycle = (state.clock.elapsedTime * 15) % (Math.PI * 2);
                    hopY = Math.sin(digCycle) * 0.1 * scale;
                    bodyTilt = Math.PI / 3.5;
                    rootYOffset = -0.2 * scale;
                }

                tempVec.copy(position);
                tempVec.y += hopY + rootYOffset;
                dummyBase.position.copy(tempVec);
                tempObj.position.copy(tempVec).add(agent.heading);
                dummyBase.lookAt(tempObj.position);
                dummyBase.rotateX(bodyTilt);

                const { r, g, b } = getAgentColorRGB(agent, viewMode);
                tempColor.setRGB(r, g, b);

                tempObj.position.copy(tempVec);
                tempObj.rotation.copy(dummyBase.rotation);
                tempObj.scale.set(scale, scale, scale);
                tempObj.updateMatrix();
                targetMesh.setMatrixAt(i, tempObj.matrix);
                targetMesh.setColorAt(i, tempColor);

                // Update Shadow
                if (shadowMeshRef.current) {
                    tempObj.position.set(position.x, 0.05, position.z); 
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

    if (!externalGeometry) return null;

    return (
        <>
            <instancedMesh
                ref={meshRef}
                args={[externalGeometry, undefined, MAX_POPULATION]}
                frustumCulled={false}
                castShadow
                receiveShadow
            >
                {/* Standard material without vertexColors prop ensures InstanceColor is used cleanly */}
                <meshStandardMaterial roughness={0.4} metalness={0.5} color="white" />
            </instancedMesh>

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