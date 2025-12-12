import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, AdditiveBlending, Vector3 as ThreeVector3 } from 'three';
import { Entity } from '../../types';
import { agents } from '../../core/ecs';
import { MAX_POPULATION } from '../../core/constants';

interface Props {
    onHoverAgent: (agent: Entity | null) => void;
    hoveredAgent: Entity | null;
    onSelectAgent: (agent: Entity | null) => void;
    selectedAgent: Entity | null;
}

const HOP_DURATION = 0.3; // Must match AgentSystem

export const InteractionLayer: React.FC<Props> = ({ onHoverAgent, hoveredAgent, onSelectAgent, selectedAgent }) => {
    const hitboxRef = useRef<InstancedMesh>(null);
    const tempObj = useMemo(() => new Object3D(), []);
    const interactionRef = useRef<Entity[]>([]);

    useFrame((state) => {
        const time = state.clock.elapsedTime;
        const allAgents = agents.entities;
        interactionRef.current = allAgents;

        if (hitboxRef.current) {
            hitboxRef.current.count = allAgents.length;
            
            for (let i = 0; i < allAgents.length; i++) {
                const entity = allAgents[i];
                const { position, agent, velocity } = entity;
                if(!agent) continue;

                // Match AgentLayer scale logic
                const scale = agent.genes.size * 3.5;
                
                // Match AgentLayer hop logic
                let hopY = 0;
                if (agent.state !== 'resting' && agent.hopTimer < HOP_DURATION) {
                    const progress = agent.hopTimer / HOP_DURATION;
                    hopY = Math.sin(progress * Math.PI) * scale * 0.8;
                } else if (agent.state === 'resting') {
                    hopY = Math.sin(time * 2 + entity.id) * 0.05 * scale;
                }
                
                const currentPos = position.clone();
                currentPos.y += hopY;

                const dummyBase = new Object3D();
                dummyBase.position.copy(currentPos);
                // Use heading for rotation if available to match visual
                if (agent.heading) {
                    dummyBase.lookAt(currentPos.clone().add(agent.heading));
                }

                tempObj.position.copy(currentPos);
                // Center hitbox on body
                tempObj.position.y += 0.5 * scale; 
                tempObj.rotation.copy(dummyBase.rotation);
                
                // Hitbox scale - generous to make clicking easy
                const hitScale = scale * 1.2; 
                tempObj.scale.set(hitScale, hitScale, hitScale);
                tempObj.updateMatrix();
                hitboxRef.current.setMatrixAt(i, tempObj.matrix);
            }
            hitboxRef.current.instanceMatrix.needsUpdate = true;
        }
    });

    const handleInteract = (instanceId: number | undefined) => {
        if (instanceId !== undefined) {
            const entity = interactionRef.current[instanceId];
            if (entity) onSelectAgent(entity);
        }
    };
    const handleHover = (instanceId: number | undefined) => {
        if (instanceId !== undefined) {
            const entity = interactionRef.current[instanceId];
            if (entity && entity !== hoveredAgent) onHoverAgent(entity);
        } else {
            onHoverAgent(null);
        }
    };

    return (
        <group>
             <instancedMesh
                ref={hitboxRef}
                args={[undefined, undefined, MAX_POPULATION]}
                visible={true}
                onClick={(e) => { e.stopPropagation(); handleInteract(e.instanceId); }}
                onPointerMove={(e) => { e.stopPropagation(); handleHover(e.instanceId); }}
                onPointerOut={() => onHoverAgent(null)}
            >
                <sphereGeometry args={[0.8, 8, 8]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </instancedMesh>

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
                            1.2 * ((selectedAgent || hoveredAgent)?.agent?.genes.size || 1) * 3.5, 
                            1.4 * ((selectedAgent || hoveredAgent)?.agent?.genes.size || 1) * 3.5, 
                            32
                        ]} 
                    />
                    <meshBasicMaterial color={selectedAgent ? "#3b82f6" : "white"} opacity={0.8} transparent blending={AdditiveBlending} side={2} />
                </mesh>
            )}
        </group>
    );
};