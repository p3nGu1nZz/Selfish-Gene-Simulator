import React, { useRef, useLayoutEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, BufferGeometry, Material, MeshStandardMaterial } from 'three';
import { food } from '../../core/ecs';

interface Props {
    models?: { geometry: BufferGeometry; material: Material }[];
}

export const FoodLayer: React.FC<Props> = ({ models }) => {
    // We need a ref for each part of the model
    // Since we don't know how many parts ahead of time in a static hook way without complexity,
    // we will assume a max of 2 parts for the carrot (body + leaves) or fallback to generic box.
    // If models are provided, we map them.
    
    const meshRefs = useRef<(InstancedMesh | null)[]>([]);
    const tempObj = useMemo(() => new Object3D(), []);

    // Helper to keep refs array correct size
    if (models && meshRefs.current.length !== models.length) {
        meshRefs.current = Array(models.length).fill(null);
    }

    useFrame(() => {
        const allFood = food.entities;
        const count = allFood.length;

        if (models && models.length > 0) {
            // Render specific models (Carrot)
            models.forEach((_, partIndex) => {
                const mesh = meshRefs.current[partIndex];
                if (mesh) {
                    mesh.count = count;
                    for (let i = 0; i < count; i++) {
                        const entity = allFood[i];
                        tempObj.position.copy(entity.position);
                        
                        // Deterministic rotation based on ID (no wiggling)
                        // Use a hash of the ID to get a consistent random-looking rotation
                        const seed = entity.id * 123.45; 
                        tempObj.rotation.set(
                            0, 
                            (seed % (Math.PI * 2)), 
                            Math.PI / 8 // Slight tilt
                        );
                        
                        // Fixed scale (smaller)
                        const scale = 0.15;
                        tempObj.scale.set(scale, scale, scale);
                        
                        tempObj.updateMatrix();
                        mesh.setMatrixAt(i, tempObj.matrix);
                    }
                    mesh.instanceMatrix.needsUpdate = true;
                }
            });
        } else {
            // Render Fallback (Box)
            const mesh = meshRefs.current[0];
            if (mesh) {
                mesh.count = count;
                for (let i = 0; i < count; i++) {
                    const entity = allFood[i];
                    tempObj.position.copy(entity.position);
                    tempObj.rotation.set(0, 0, 0);
                    tempObj.scale.set(1, 1, 1);
                    tempObj.updateMatrix();
                    mesh.setMatrixAt(i, tempObj.matrix);
                }
                mesh.instanceMatrix.needsUpdate = true;
            }
        }
    });

    if (models && models.length > 0) {
        return (
            <group>
                {models.map((part, i) => (
                    <instancedMesh 
                        key={i}
                        ref={(el) => { meshRefs.current[i] = el; }}
                        args={[part.geometry, undefined, 1000]} 
                        frustumCulled={false}
                        castShadow
                        receiveShadow
                    >
                        <primitive object={part.material} attach="material" />
                    </instancedMesh>
                ))}
            </group>
        );
    }

    return (
        <instancedMesh 
            ref={(el) => { meshRefs.current[0] = el; }} 
            args={[undefined, undefined, 1000]} 
            frustumCulled={false}
        >
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.5} />
        </instancedMesh>
    );
};