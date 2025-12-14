import React, { useRef, useMemo } from 'react';
import '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Shape, DoubleSide, AdditiveBlending, MeshBasicMaterial, TextureLoader, CanvasTexture } from 'three';
import { particles } from '../../core/ecs';
import { Text } from '@react-three/drei';

const heartShape = new Shape();
const x = 0, y = 0;
heartShape.moveTo(x + 0.25, y + 0.25);
heartShape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.20, y, x, y);
heartShape.bezierCurveTo(x - 0.30, y, x - 0.30, y + 0.35, x - 0.30, y + 0.35);
heartShape.bezierCurveTo(x - 0.30, y + 0.55, x - 0.10, y + 0.77, x + 0.25, y + 0.95);
heartShape.bezierCurveTo(x + 0.60, y + 0.77, x + 0.80, y + 0.55, x + 0.80, y + 0.35);
heartShape.bezierCurveTo(x + 0.80, y + 0.35, x + 0.80, y, x + 0.50, y);
heartShape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);

// Create Zzz Texture
const zzzTexture = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px monospace';
        ctx.fillText('Z', 16, 48);
    }
    return new CanvasTexture(canvas);
})();

export const ParticleLayer: React.FC = () => {
    const particleMeshRef = useRef<InstancedMesh>(null);
    const heartMeshRef = useRef<InstancedMesh>(null);
    const zzzRef = useRef<InstancedMesh>(null);
    const tempObj = useMemo(() => new Object3D(), []);

    useFrame((state) => {
        if (particleMeshRef.current && heartMeshRef.current && zzzRef.current) {
            const pMesh = particleMeshRef.current;
            const hMesh = heartMeshRef.current;
            const zMesh = zzzRef.current;
            
            const allParticles = particles.entities;
            let pCount = 0;
            let hCount = 0;
            let zCount = 0;
            
            for (let i = 0; i < allParticles.length; i++) {
                const ent = allParticles[i];
                const p = ent.particle!;
                tempObj.position.copy(ent.position);
                const normalizedLife = p.life / p.maxLife;
                
                // Fade out logic
                const alpha = normalizedLife; 
                
                if (p.type === 'heart') {
                    // Pulse scale slightly
                    const scale = p.scale * (normalizedLife < 0.2 ? normalizedLife * 5 : 1.0);
                    tempObj.scale.set(scale, scale, scale);
                    tempObj.lookAt(state.camera.position);
                    tempObj.rotateZ(p.rotation || 0);
                    tempObj.updateMatrix();
                    hMesh.setMatrixAt(hCount, tempObj.matrix);
                    hMesh.setColorAt(hCount, p.color);
                    hCount++;
                } else if (p.type === 'zzz') {
                    const scale = p.scale * normalizedLife; // Shrink as they fade
                    tempObj.scale.set(scale, scale, scale);
                    tempObj.lookAt(state.camera.position);
                    
                    // Bobbing visual update (handled in System mostly, but fine tune here)
                    tempObj.updateMatrix();
                    zMesh.setMatrixAt(zCount, tempObj.matrix);
                    zMesh.setColorAt(zCount, p.color);
                    zCount++;
                } else {
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
            
            hMesh.count = hCount;
            hMesh.instanceMatrix.needsUpdate = true;
            if (hMesh.instanceColor) hMesh.instanceColor.needsUpdate = true;

            zMesh.count = zCount;
            zMesh.instanceMatrix.needsUpdate = true;
            if (zMesh.instanceColor) zMesh.instanceColor.needsUpdate = true;
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
                {/* Additive Blending for hearts as requested */}
                <meshBasicMaterial color="#ff69b4" side={DoubleSide} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} />
            </instancedMesh>
             <instancedMesh ref={zzzRef} args={[undefined, undefined, 200]} frustumCulled={false}>
                 <planeGeometry args={[1, 1]} />
                 <meshBasicMaterial map={zzzTexture} transparent opacity={0.8} alphaTest={0.01} depthWrite={false} />
             </instancedMesh>
        </>
    );
};