import React, { useRef, useMemo, useState } from 'react';
import '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color, Vector3 } from 'three';
import { agents } from '../../core/ecs';
import { Html } from '@react-three/drei';

interface Props {
    selectedAgentId: number | null;
    onSelectAgent: (id: number | null) => void;
}

export const InteractionLayer: React.FC<Props> = ({ selectedAgentId, onSelectAgent }) => {
    const hitMeshRef = useRef<InstancedMesh>(null);
    const ringMeshRef = useRef<InstancedMesh>(null);
    const tempObj = useMemo(() => new Object3D(), []);
    const [hoveredId, setHoveredId] = useState<number | null>(null);

    useFrame((state) => {
        const allAgents = agents.entities;
        const count = allAgents.length;

        // 1. Update Hitboxes (Invisible)
        if (hitMeshRef.current) {
            hitMeshRef.current.count = count;
            for (let i = 0; i < count; i++) {
                const entity = allAgents[i];
                if (!entity.agent) continue;

                // Position hitbox at base, slightly elevated to cover body
                tempObj.position.copy(entity.position);
                tempObj.position.y += 0.5; 
                
                // Hide hitbox if in burrow to prevent clicking underground rabbits easily
                if (entity.agent.currentBurrowId !== null) {
                    tempObj.scale.set(0, 0, 0);
                } else {
                    const size = entity.agent.genes.size;
                    tempObj.scale.set(size, size, size);
                }
                
                tempObj.rotation.set(0, 0, 0);
                tempObj.updateMatrix();
                hitMeshRef.current.setMatrixAt(i, tempObj.matrix);
                
                // Store ID in user data for raycasting mapping if needed, 
                // but standard onClick passes instanceId which maps to index here 
                // IF the array order hasn't changed. Miniplex arrays can change order on removal.
                // We handle mapping in the event handler below.
            }
            hitMeshRef.current.instanceMatrix.needsUpdate = true;
        }

        // 2. Update Selection Ring
        if (ringMeshRef.current) {
            let ringCount = 0;
            
            // Show ring for selected
            if (selectedAgentId !== null) {
                const selected = allAgents.find(e => e.id === selectedAgentId);
                if (selected && selected.agent && selected.agent.currentBurrowId === null) {
                    tempObj.position.copy(selected.position);
                    tempObj.position.y = 0.05; // Just above ground
                    
                    const scale = selected.agent.genes.size * 1.5;
                    // Pulse effect
                    const pulse = 1.0 + Math.sin(state.clock.elapsedTime * 5) * 0.1;
                    
                    tempObj.scale.set(scale * pulse, scale * pulse, 1);
                    tempObj.rotation.set(-Math.PI / 2, 0, state.clock.elapsedTime);
                    tempObj.updateMatrix();
                    
                    ringMeshRef.current.setMatrixAt(ringCount, tempObj.matrix);
                    ringMeshRef.current.setColorAt(ringCount, new Color('#3b82f6')); // Blue
                    ringCount++;
                }
            }

            // Show ring for hovered (if different)
            if (hoveredId !== null && hoveredId !== selectedAgentId) {
                const hovered = allAgents.find(e => e.id === hoveredId);
                if (hovered && hovered.agent && hovered.agent.currentBurrowId === null) {
                    tempObj.position.copy(hovered.position);
                    tempObj.position.y = 0.05;
                    const scale = hovered.agent.genes.size * 1.2;
                    tempObj.scale.set(scale, scale, 1);
                    tempObj.rotation.set(-Math.PI / 2, 0, 0);
                    tempObj.updateMatrix();
                    
                    ringMeshRef.current.setMatrixAt(ringCount, tempObj.matrix);
                    ringMeshRef.current.setColorAt(ringCount, new Color('#ffffff')); // White
                    ringCount++;
                }
            }
            
            ringMeshRef.current.count = ringCount;
            ringMeshRef.current.instanceMatrix.needsUpdate = true;
            if (ringMeshRef.current.instanceColor) ringMeshRef.current.instanceColor.needsUpdate = true;
        }
    });

    const handleClick = (e: any) => {
        e.stopPropagation();
        const instanceId = e.instanceId;
        const allAgents = agents.entities;
        if (instanceId !== undefined && instanceId < allAgents.length) {
            const agent = allAgents[instanceId];
            onSelectAgent(agent.id);
        }
    };

    const handlePointerOver = (e: any) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        const instanceId = e.instanceId;
        const allAgents = agents.entities;
        if (instanceId !== undefined && instanceId < allAgents.length) {
            setHoveredId(allAgents[instanceId].id);
        }
    };

    const handlePointerOut = (e: any) => {
        document.body.style.cursor = 'default';
        setHoveredId(null);
    };

    return (
        <group>
            {/* Invisible Hit Boxes */}
            <instancedMesh 
                ref={hitMeshRef} 
                args={[undefined, undefined, 2000]} 
                onClick={handleClick}
                onPointerOver={handlePointerOver}
                onPointerOut={handlePointerOut}
                visible={true} // Must be visible for raycast
            >
                <boxGeometry args={[1.5, 2, 1.5]} />
                <meshBasicMaterial transparent opacity={0.0} depthWrite={false} color="red" />
            </instancedMesh>

            {/* Selection/Hover Rings */}
            <instancedMesh ref={ringMeshRef} args={[undefined, undefined, 2]} frustumCulled={false}>
                <ringGeometry args={[0.8, 1.0, 32]} />
                <meshBasicMaterial transparent opacity={0.8} depthWrite={false} toneMapped={false} />
            </instancedMesh>
        </group>
    );
};