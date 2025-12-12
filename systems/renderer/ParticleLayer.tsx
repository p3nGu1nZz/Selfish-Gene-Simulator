import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Shape, DoubleSide, AdditiveBlending } from 'three';
import { particles } from '../../core/ecs';

const heartShape = new Shape();
const x = 0, y = 0;
heartShape.moveTo(x + 0.25, y + 0.25);
heartShape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.20, y, x, y);
heartShape.bezierCurveTo(x - 0.30, y, x - 0.30, y + 0.35, x - 0.30, y + 0.35);
heartShape.bezierCurveTo(x - 0.30, y + 0.55, x - 0.10, y + 0.77, x + 0.25, y + 0.95);
heartShape.bezierCurveTo(x + 0.60, y + 0.77, x + 0.80, y + 0.55, x + 0.80, y + 0.35);
heartShape.bezierCurveTo(x + 0.80, y + 0.35, x + 0.80, y, x + 0.50, y);
heartShape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);

export const ParticleLayer: React.FC = () => {
    const particleMeshRef = useRef<InstancedMesh>(null);
    const heartMeshRef = useRef<InstancedMesh>(null);
    const tempObj = useMemo(() => new Object3D(), []);

    useFrame((state) => {
        if (particleMeshRef.current && heartMeshRef.current) {
            const pMesh = particleMeshRef.current;
            const hMesh = heartMeshRef.current;
            const allParticles = particles.entities;
            let pCount = 0;
            let hCount = 0;
            for (let i = 0; i < allParticles.length; i++) {
                const ent = allParticles[i];
                const p = ent.particle!;
                tempObj.position.copy(ent.position);
                const scale = p.scale * (p.life / p.maxLife);
                tempObj.scale.set(scale, scale, scale);
                if (p.type === 'heart') {
                    tempObj.lookAt(state.camera.position);
                    tempObj.rotateZ(p.rotation || 0);
                    tempObj.updateMatrix();
                    hMesh.setMatrixAt(hCount, tempObj.matrix);
                    hMesh.setColorAt(hCount, p.color);
                    hCount++;
                } else {
                    tempObj.rotation.set(0,0,0);
                    tempObj.updateMatrix();
                    pMesh.setMatrixAt(pCount, tempObj.matrix);
                    pMesh.setColorAt(pCount, p.color);
                    pCount++;
                }
            }
            pMesh.count = pCount;
            pMesh.instanceMatrix.needsUpdate = true;
            if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
            hMesh.count = hCount;
            hMesh.instanceMatrix.needsUpdate = true;
            if (hMesh.instanceColor) hMesh.instanceColor.needsUpdate = true;
        }
    });

    return (
        <>
            <instancedMesh ref={particleMeshRef} args={[undefined, undefined, 2000]} frustumCulled={false}>
                <boxGeometry args={[0.7, 0.7, 0.7]} />
                <meshBasicMaterial transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} />
            </instancedMesh>
            <instancedMesh ref={heartMeshRef} args={[undefined, undefined, 500]} frustumCulled={false}>
                <shapeGeometry args={[heartShape]} />
                <meshBasicMaterial color="#ff69b4" side={DoubleSide} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} />
            </instancedMesh>
        </>
    );
};