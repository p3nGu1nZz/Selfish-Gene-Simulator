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

                const scale = agent.genes.size;
                const speed = velocity ? velocity.length() : 0;
                const isMoving = speed > 0.05;

                let hopY = 0;
                if (isMoving) {
                    const hopFreq = 3 + Math.min(speed * 2, 4); 
                    const hopPhase = entity.id * 13.37;
                    const rawSine = Math.sin(time * hopFreq + hopPhase);
                    const threshold = 0.2; 
                    const hopGate = Math.max(0, rawSine - threshold);
                    const normalizedHop = hopGate / (1 - threshold);
                    hopY = Math.pow(normalizedHop, 1.5) * 0.6 * scale;
                }
                
                const currentPos = position.clone();
                currentPos.y += hopY;

                const dummyBase = new Object3D();
                dummyBase.position.copy(currentPos);
                if (velocity && velocity.lengthSq() > 0.001) {
                    dummyBase.lookAt(currentPos.clone().add(velocity));
                }

                tempObj.position.copy(currentPos);
                tempObj.position.y += 0.5 * scale; 
                tempObj.rotation.copy(dummyBase.rotation);
                const hitScale = scale * 1.5; 
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