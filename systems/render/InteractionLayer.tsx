import React, { useRef, useMemo, useState, useEffect } from 'react';
import '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color, Sphere, Vector3 } from 'three';
import { agents } from '../../core/ecs';

interface Props {
    selectedAgentId: number | null;
    onSelectAgent: (id: number | null) => void;
}

export const InteractionLayer: React.FC<Props> = ({ selectedAgentId, onSelectAgent }) => {
    const hitMeshRef = useRef<InstancedMesh>(null);
    const ringMeshRef = useRef<InstancedMesh>(null);
    const tempObj = useMemo(() => new Object3D(), []);
    const [hoveredId, setHoveredId] = useState<number | null>(null);
    
    // Ensure bounding sphere is large to prevent frustum culling issues with scattered agents
    useEffect(() => {
        if (hitMeshRef.current) {
            hitMeshRef.current.geometry.boundingSphere = new Sphere(new Vector3(0,0,0), Infinity);
        }
        if (ringMeshRef.current) {
            ringMeshRef.current.geometry.boundingSphere = new Sphere(new Vector3(0,0,0), Infinity);
        }
    }, []);

    useFrame((state) => {
        const allAgents = agents.entities;
        const count = allAgents.length;

        // 1. Update Hitboxes
        if (hitMeshRef.current) {
            hitMeshRef.current.count = count;
            for (let i = 0; i < count; i++) {
                const entity = allAgents[i];
                if (!entity.agent) continue;

                tempObj.position.copy(entity.position);
                
                if (entity.agent.currentBurrowId !== null) {
                    tempObj.scale.set(0, 0, 0);
                } else {
                    const visualScale = entity.agent.genes.size * 2.5;
                    
                    // Position hitbox center higher up to allow clicking above the rabbit's head
                    tempObj.position.y += visualScale * 1.5; 
                    
                    // Hitbox dimensions: significantly taller
                    // Width/Depth 2.0x visual, Height 4.0x visual
                    tempObj.scale.set(visualScale * 2.0, visualScale * 4.0, visualScale * 2.0);
                }
                
                tempObj.rotation.set(0, 0, 0);
                tempObj.updateMatrix();
                hitMeshRef.current.setMatrixAt(i, tempObj.matrix);
            }
            hitMeshRef.current.instanceMatrix.needsUpdate = true;
        }

        // 2. Update Selection/Hover Ring
        if (ringMeshRef.current) {
            let ringCount = 0;
            const now = state.clock.elapsedTime;
            
            // Helper to render ring
            const addRing = (agentId: number, color: string, pulse: boolean) => {
                const entity = allAgents.find(e => e.id === agentId);
                if (entity && entity.agent && entity.agent.currentBurrowId === null) {
                    tempObj.position.copy(entity.position);
                    tempObj.position.y = 0.05; 
                    
                    const scale = entity.agent.genes.size * 2.5 * 1.2; 
                    const scaleFactor = pulse ? (1.0 + Math.sin(now * 5) * 0.1) : 1.0;
                    
                    tempObj.scale.set(scale * scaleFactor, scale * scaleFactor, 1);
                    tempObj.rotation.set(-Math.PI / 2, 0, pulse ? now : 0);
                    tempObj.updateMatrix();
                    
                    ringMeshRef.current!.setMatrixAt(ringCount, tempObj.matrix);
                    ringMeshRef.current!.setColorAt(ringCount, new Color(color));
                    ringCount++;
                }
            };

            if (selectedAgentId !== null) {
                addRing(selectedAgentId, '#3b82f6', true); // Blue selected
            }
            if (hoveredId !== null && hoveredId !== selectedAgentId) {
                addRing(hoveredId, '#ffffff', false); // White hover
            }
            
            ringMeshRef.current.count = ringCount;
            ringMeshRef.current.instanceMatrix.needsUpdate = true;
            if (ringMeshRef.current.instanceColor) ringMeshRef.current.instanceColor.needsUpdate = true;
        }
    });

    // Standard Click Handling
    const handleClick = (e: any) => {
        // Prevent selection if user was dragging camera
        if (e.delta > 2) return;

        e.stopPropagation();
        const instanceId = e.instanceId;
        const allAgents = agents.entities;
        
        // Safety check: ensure index is within bounds of current entity list
        if (instanceId !== undefined && instanceId >= 0 && instanceId < allAgents.length) {
            onSelectAgent(allAgents[instanceId].id);
        }
    };

    const handlePointerOver = (e: any) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        const instanceId = e.instanceId;
        const allAgents = agents.entities;
        if (instanceId !== undefined && instanceId >= 0 && instanceId < allAgents.length) {
            setHoveredId(allAgents[instanceId].id);
        }
    };

    const handlePointerOut = (e: any) => {
        document.body.style.cursor = 'default';
        setHoveredId(null);
    };

    return (
        <group>
            {/* Invisible Hit Boxes for Raycasting */}
            <instancedMesh 
                ref={hitMeshRef} 
                args={[undefined, undefined, 2000]} 
                onClick={handleClick}
                onPointerOver={handlePointerOver}
                onPointerOut={handlePointerOut}
                visible={true} 
                frustumCulled={false}
            >
                <boxGeometry args={[1, 1, 1]} />
                {/* Invisible material: visible=true for raycast, but opacity 0 */}
                <meshBasicMaterial transparent opacity={0.0} depthWrite={false} color="red" />
            </instancedMesh>

            {/* Selection/Hover Rings Visuals */}
            <instancedMesh ref={ringMeshRef} args={[undefined, undefined, 2]} frustumCulled={false}>
                <ringGeometry args={[0.8, 1.0, 32]} />
                <meshBasicMaterial transparent opacity={0.8} depthWrite={false} toneMapped={false} />
            </instancedMesh>
        </group>
    );
};