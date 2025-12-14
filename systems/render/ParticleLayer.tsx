import React, { useRef, useMemo } from 'react';
import '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, AdditiveBlending } from 'three';
import { particles } from '../../core/ecs';

export const ParticleLayer: React.FC = () => {
    const particleMeshRef = useRef<InstancedMesh>(null);
    const tempObj = useMemo(() => new Object3D(), []);

    useFrame((state) => {
        if (particleMeshRef.current) {
            const pMesh = particleMeshRef.current;
            const allParticles = particles.entities;
            let pCount = 0;
            
            for (let i = 0; i < allParticles.length; i++) {
                const ent = allParticles[i];
                const p = ent.particle!;
                
                // Only render standard particles here
                if (p.type === 'particle' || p.type === 'dirt' || p.type === 'birth' || p.type === 'death') {
                    tempObj.position.copy(ent.position);
                    const normalizedLife = p.life / p.maxLife;
                    
                    const scale = p.scale * normalizedLife;
                    tempObj.scale.set(scale, scale, scale);
                    tempObj.rotation.set(Math.random(), Math.random(), Math.random());
                    tempObj.updateMatrix();
                    pMesh.setMatrixAt(pCount, tempObj.matrix);
                    pMesh.setColorAt(pCount, p.color);
                    pCount++;
                }
            }
            
            pMesh.count = pCount;
            pMesh.instanceMatrix.needsUpdate = true;
            if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
        }
    });

    return (
        <instancedMesh ref={particleMeshRef} args={[undefined, undefined, 2000]} frustumCulled={false}>
            <boxGeometry args={[0.7, 0.7, 0.7]} />
            <meshBasicMaterial transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} />
        </instancedMesh>
    );
};