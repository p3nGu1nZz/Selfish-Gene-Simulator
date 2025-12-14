import React, { useRef, useMemo, useState } from 'react';
import '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color } from 'three';
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
    
    // Store pointer down state to manually detect clicks vs drags
    const downState = useRef<{ x: number, y: number, ts: number } | null>(null);

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
                    // Match AgentLayer scale logic: agent.genes.size * 2.5
                    const visualScale = entity.agent.genes.size * 2.5;
                    
                    // Center hitbox vertically relative to the visual model (approx)
                    // Visual model hops, so we make the hitbox tall enough to cover the hop
                    tempObj.position.y += visualScale * 0.75; 
                    
                    // Hitbox dimensions: Wider than visual to make clicking easy
                    // Height: High enough to catch jumps (approx 2x visual height)
                    tempObj.scale.set(visualScale * 1.5, visualScale * 2.5, visualScale * 1.5);
                }
                
                tempObj.rotation.set(0, 0, 0);
                tempObj.updateMatrix();
                hitMeshRef.current.setMatrixAt(i, tempObj.matrix);
            }
            hitMeshRef.current.instanceMatrix.needsUpdate = true;
        }

        // 2. Update Selection Ring
        if (ringMeshRef.current) {
            let ringCount = 0;
            const now = state.clock.elapsedTime;
            
            // Show ring for selected
            if (selectedAgentId !== null) {
                const selected = allAgents.find(e => e.id === selectedAgentId);
                if (selected && selected.agent && selected.agent.currentBurrowId === null) {
                    tempObj.position.copy(selected.position);
                    tempObj.position.y = 0.05; 
                    
                    const scale = selected.agent.genes.size * 2.5 * 1.2; // Match visual scale
                    const pulse = 1.0 + Math.sin(now * 5) * 0.1;
                    
                    tempObj.scale.set(scale * pulse, scale * pulse, 1);
                    tempObj.rotation.set(-Math.PI / 2, 0, now);
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
                    const scale = hovered.agent.genes.size * 2.5 * 1.0;
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

    const handlePointerDown = (e: any) => {
        // Capture interaction start
        downState.current = { 
            x: e.nativeEvent.clientX, 
            y: e.nativeEvent.clientY,
            ts: Date.now()
        };
    };

    const handlePointerUp = (e: any) => {
        if (!downState.current) return;

        const dx = e.nativeEvent.clientX - downState.current.x;
        const dy = e.nativeEvent.clientY - downState.current.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const dt = Date.now() - downState.current.ts;

        downState.current = null;

        // Threshold: Allow up to 40px movement to tolerate shaky hands / micro-pans
        if (dist < 40 && dt < 600) {
            e.stopPropagation(); // Prevent falling through to ground
            
            const instanceId = e.instanceId;
            const allAgents = agents.entities;
            if (instanceId !== undefined && instanceId < allAgents.length) {
                const agent = allAgents[instanceId];
                onSelectAgent(agent.id);
            }
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
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onClick={(e) => e.stopPropagation()} // Eat standard clicks so they don't hit ground
                onPointerOver={handlePointerOver}
                onPointerOut={handlePointerOut}
                visible={true} 
            >
                <boxGeometry args={[1, 1, 1]} />
                {/* Invisible material for raycasting */}
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