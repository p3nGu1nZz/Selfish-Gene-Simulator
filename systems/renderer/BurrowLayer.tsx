import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D } from 'three';
import { burrows } from '../../core/ecs';

export const BurrowLayer: React.FC = () => {
    const meshRef = useRef<InstancedMesh>(null);
    const tempObj = useMemo(() => new Object3D(), []);

    useFrame(() => {
        const allBurrows = burrows.entities;
        if (meshRef.current) {
            meshRef.current.count = allBurrows.length;
            for (let i = 0; i < allBurrows.length; i++) {
                const ent = allBurrows[i];
                if (!ent.burrow) continue;
                
                tempObj.position.copy(ent.position);
                // Burrow is slightly into the ground
                tempObj.position.y = 0.1; 
                
                // Reduced scale multiplier from 2.0 to 1.3
                const scale = ent.burrow.radius * 1.3; 
                tempObj.scale.set(scale, scale * 0.3, scale); // Flattened sphere
                tempObj.updateMatrix();
                meshRef.current.setMatrixAt(i, tempObj.matrix);
            }
            meshRef.current.instanceMatrix.needsUpdate = true;
        }
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, 200]} receiveShadow>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial color="#1a1510" roughness={0.9} />
        </instancedMesh>
    );
};