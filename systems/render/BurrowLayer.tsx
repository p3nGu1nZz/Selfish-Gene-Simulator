import React, { useRef, useMemo } from 'react';
import '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color } from 'three';
import { burrows } from '../../core/ecs';

export const BurrowLayer: React.FC = () => {
    const holeMeshRef = useRef<InstancedMesh>(null);
    const moundMeshRef = useRef<InstancedMesh>(null);
    const tempObj = useMemo(() => new Object3D(), []);

    useFrame(() => {
        const allBurrows = burrows.entities;
        
        // 1. Hole (Sphere)
        if (holeMeshRef.current) {
            holeMeshRef.current.count = allBurrows.length;
            for (let i = 0; i < allBurrows.length; i++) {
                const ent = allBurrows[i];
                if (!ent.burrow) continue;
                
                tempObj.position.copy(ent.position);
                tempObj.position.y = 0.1; 
                
                const progress = ent.burrow.digProgress;
                const scaleMult = progress < 1 ? Math.sin(progress * Math.PI / 2) : 1; 
                const scale = ent.burrow.radius * 1.3 * scaleMult; 
                
                tempObj.scale.set(scale, scale * 0.3, scale); 
                tempObj.updateMatrix();
                holeMeshRef.current.setMatrixAt(i, tempObj.matrix);
            }
            holeMeshRef.current.instanceMatrix.needsUpdate = true;
        }

        // 2. Mound (Torus/Ring)
        if (moundMeshRef.current) {
            moundMeshRef.current.count = allBurrows.length;
            for (let i = 0; i < allBurrows.length; i++) {
                const ent = allBurrows[i];
                if (!ent.burrow) continue;
                
                tempObj.position.copy(ent.position);
                // Slightly elevated
                tempObj.position.y = 0.05; 
                tempObj.rotation.set(-Math.PI/2, 0, 0); // Flat on ground
                
                const progress = ent.burrow.digProgress;
                // Mound grows slightly wider than the hole
                const scaleMult = progress < 1 ? Math.sin(progress * Math.PI / 2) : 1; 
                const scale = ent.burrow.radius * 2.0 * scaleMult;

                tempObj.scale.set(scale, scale, 0.4); // Z is height in Torus coords
                tempObj.updateMatrix();
                moundMeshRef.current.setMatrixAt(i, tempObj.matrix);
            }
            moundMeshRef.current.instanceMatrix.needsUpdate = true;
        }
    });

    return (
        <group>
            {/* The deep dark hole */}
            <instancedMesh ref={holeMeshRef} args={[undefined, undefined, 200]} receiveShadow>
                <sphereGeometry args={[1, 16, 16]} />
                <meshStandardMaterial color="#0a0500" roughness={1.0} />
            </instancedMesh>
            
            {/* The dirt mound rim around it */}
            <instancedMesh ref={moundMeshRef} args={[undefined, undefined, 200]} receiveShadow castShadow>
                <torusGeometry args={[0.5, 0.2, 8, 16]} />
                <meshStandardMaterial color="#5d4037" roughness={1.0} />
            </instancedMesh>
        </group>
    );
};