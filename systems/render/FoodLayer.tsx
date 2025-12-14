import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, BufferGeometry, Material } from 'three';
import { food } from '../../core/ecs';

interface Props {
    models?: { geometry: BufferGeometry; material: Material }[];
}

export const FoodLayer: React.FC<Props> = ({ models }) => {
    const meshRefs = useRef<(InstancedMesh | null)[]>([]);
    const tempObj = useMemo(() => new Object3D(), []);

    // Helper to keep refs array correct size for external models
    if (models && meshRefs.current.length !== models.length) {
        meshRefs.current = Array(models.length).fill(null);
    }

    useFrame(() => {
        const allFood = food.entities;
        const count = allFood.length;

        // Mode 1: External Models Only
        if (models && models.length > 0) {
            models.forEach((_, partIndex) => {
                const mesh = meshRefs.current[partIndex];
                if (mesh) {
                    mesh.count = count;
                    for (let i = 0; i < count; i++) {
                        const entity = allFood[i];
                        tempObj.position.copy(entity.position);
                        
                        // Deterministic rotation
                        const seed = entity.id * 123.45; 
                        tempObj.rotation.set(0, (seed % (Math.PI * 2)), Math.PI / 8);
                        
                        const scale = 0.15;
                        tempObj.scale.set(scale, scale, scale);
                        
                        tempObj.updateMatrix();
                        mesh.setMatrixAt(i, tempObj.matrix);
                    }
                    mesh.instanceMatrix.needsUpdate = true;
                }
            });
        } 
    });

    if (!models || models.length === 0) return null;

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
};