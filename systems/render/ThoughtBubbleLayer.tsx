import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { InstancedMesh, Object3D, CanvasTexture, Color, Vector3, MeshBasicMaterial, DoubleSide } from 'three';
import { agents } from '../../core/ecs';
import { MAX_POPULATION } from '../../core/constants';

// Helper to generate textures
const createTexture = (emoji: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.font = '48px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, 32, 36);
    }
    return new CanvasTexture(canvas);
};

export const ThoughtBubbleLayer: React.FC = () => {
    // We use multiple InstancedMeshes for different parts of the bubble to allow different textures/colors
    // 1. The main white bubble circle
    // 2. The emoji texture inside
    // 3. The small dot (trail)
    // 4. The smaller dot (trail)
    
    const bubbleMeshRef = useRef<InstancedMesh>(null);
    const emojiMeshRef = useRef<InstancedMesh>(null);
    const dot1Ref = useRef<InstancedMesh>(null);
    const dot2Ref = useRef<InstancedMesh>(null);

    const tempObj = useMemo(() => new Object3D(), []);
    const dummy = useMemo(() => new Object3D(), []); // For billboard rotation
    const { camera } = useThree();

    // Textures
    const texHeart = useMemo(() => createTexture('❤️'), []);
    const texAngry = useMemo(() => createTexture('😠'), []);
    const texZzz = useMemo(() => createTexture('💤'), []);

    // Material references to swap textures? 
    // InstancedMesh supports one material. We need a way to render different emojis.
    // Approach: Use a texture atlas or separate InstancedMeshes for each emoji type.
    // Given the low count of bubble types (3), let's use separate InstancedMeshes for the emojis content.
    // Or simpler: One generic "Content" mesh but we can't change texture per instance easily without a shader or atlas.
    // We will use 3 separate emoji meshes: HeartMesh, AngryMesh, ZzzMesh.
    
    const heartRef = useRef<InstancedMesh>(null);
    const angryRef = useRef<InstancedMesh>(null);
    const zzzRef = useRef<InstancedMesh>(null);

    useFrame((state) => {
        const allAgents = agents.entities;
        
        let bubbleCount = 0;
        let heartCount = 0;
        let angryCount = 0;
        let zzzCount = 0;
        
        // Reset counts
        if (bubbleMeshRef.current) bubbleMeshRef.current.count = 0;
        if (dot1Ref.current) dot1Ref.current.count = 0;
        if (dot2Ref.current) dot2Ref.current.count = 0;
        if (heartRef.current) heartRef.current.count = 0;
        if (angryRef.current) angryRef.current.count = 0;
        if (zzzRef.current) zzzRef.current.count = 0;

        for (const entity of allAgents) {
            const { agent, position } = entity;
            if (!agent || !agent.thoughtBubble) continue;

            const bubble = agent.thoughtBubble;
            
            // Animation: Pop in and Pop out
            // Normalized time: 0 (start) -> 1 (end)
            const progress = 1.0 - (bubble.timer / bubble.maxTime);
            
            // Scale logic:
            // 0.0 - 0.1: Scale 0 -> 1 (Pop in)
            // 0.1 - 0.8: Scale 1.0 + slight pulse
            // 0.8 - 1.0: Scale 1 -> 0 (Pop out)
            
            let scale = 1.0;
            if (progress < 0.1) scale = progress * 10;
            else if (progress > 0.8) scale = (1.0 - progress) * 5;
            else scale = 1.0 + Math.sin(state.clock.elapsedTime * 5) * 0.05;

            // Base position: Above head
            const height = (agent.genes.size * 2.5) + 1.2; 
            const basePos = position.clone().add(new Vector3(0, height, 0));
            
            // Add slight floating movement
            basePos.y += Math.sin(state.clock.elapsedTime * 2 + entity.id) * 0.1;

            // Billboard rotation: Look at camera
            dummy.position.copy(basePos);
            dummy.lookAt(camera.position);

            // 1. Render Main Bubble (White Circle)
            tempObj.position.copy(basePos);
            tempObj.rotation.copy(dummy.rotation);
            tempObj.scale.set(scale, scale, 1);
            tempObj.updateMatrix();
            
            if (bubbleMeshRef.current) {
                bubbleMeshRef.current.setMatrixAt(bubbleCount, tempObj.matrix);
                // Slightly offset trail dots based on camera rotation so they appear "below-left" or "below-right"
                // For simplicity, just below in local Y
            }

            // 2. Render Trail Dots
            // Dot 1
            if (dot1Ref.current) {
                // Local offset (-0.5, -0.6) scaled
                const d1Scale = scale * 0.25;
                tempObj.scale.set(d1Scale, d1Scale, 1);
                // Move down in local space
                tempObj.translateY(-0.6 * scale);
                tempObj.translateX(-0.3 * scale); 
                tempObj.updateMatrix();
                dot1Ref.current.setMatrixAt(bubbleCount, tempObj.matrix);
            }
            
            // Dot 2
            if (dot2Ref.current) {
                const d2Scale = scale * 0.15;
                tempObj.scale.set(d2Scale, d2Scale, 1);
                // Move further down
                tempObj.translateY(-0.3 * scale); // Relative to prev translate? No, tempObj accumulates
                tempObj.translateX(-0.2 * scale);
                tempObj.updateMatrix();
                dot2Ref.current.setMatrixAt(bubbleCount, tempObj.matrix);
            }
            
            bubbleCount++;

            // 3. Render Content Emoji
            // Reset position to center of bubble
            tempObj.position.copy(basePos);
            tempObj.rotation.copy(dummy.rotation);
            // Slightly in front to avoid z-fighting
            tempObj.translateZ(0.05);
            // Emoji slightly smaller than bubble
            const contentScale = scale * 0.7;
            tempObj.scale.set(contentScale, contentScale, 1);
            tempObj.updateMatrix();

            if (bubble.type === 'heart' && heartRef.current) {
                heartRef.current.setMatrixAt(heartCount++, tempObj.matrix);
            } else if (bubble.type === 'angry' && angryRef.current) {
                angryRef.current.setMatrixAt(angryCount++, tempObj.matrix);
            } else if (bubble.type === 'zzz' && zzzRef.current) {
                zzzRef.current.setMatrixAt(zzzCount++, tempObj.matrix);
            }
        }

        // Update all meshes
        if (bubbleMeshRef.current) { bubbleMeshRef.current.count = bubbleCount; bubbleMeshRef.current.instanceMatrix.needsUpdate = true; }
        if (dot1Ref.current) { dot1Ref.current.count = bubbleCount; dot1Ref.current.instanceMatrix.needsUpdate = true; }
        if (dot2Ref.current) { dot2Ref.current.count = bubbleCount; dot2Ref.current.instanceMatrix.needsUpdate = true; }
        if (heartRef.current) { heartRef.current.count = heartCount; heartRef.current.instanceMatrix.needsUpdate = true; }
        if (angryRef.current) { angryRef.current.count = angryCount; angryRef.current.instanceMatrix.needsUpdate = true; }
        if (zzzRef.current) { zzzRef.current.count = zzzCount; zzzRef.current.instanceMatrix.needsUpdate = true; }
    });

    return (
        <group renderOrder={999}> {/* High render order to appear on top if using depthTest/transparent */}
            {/* White Bubble Backgrounds */}
            <instancedMesh ref={bubbleMeshRef} args={[undefined, undefined, MAX_POPULATION]} frustumCulled={false}>
                <circleGeometry args={[0.5, 32]} />
                <meshBasicMaterial color="white" transparent opacity={0.9} />
            </instancedMesh>
            
            <instancedMesh ref={dot1Ref} args={[undefined, undefined, MAX_POPULATION]} frustumCulled={false}>
                <circleGeometry args={[0.5, 16]} />
                <meshBasicMaterial color="white" transparent opacity={0.9} />
            </instancedMesh>
            
            <instancedMesh ref={dot2Ref} args={[undefined, undefined, MAX_POPULATION]} frustumCulled={false}>
                <circleGeometry args={[0.5, 16]} />
                <meshBasicMaterial color="white" transparent opacity={0.9} />
            </instancedMesh>

            {/* Emojis */}
            <instancedMesh ref={heartRef} args={[undefined, undefined, MAX_POPULATION]} frustumCulled={false}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={texHeart} transparent alphaTest={0.5} />
            </instancedMesh>
            
            <instancedMesh ref={angryRef} args={[undefined, undefined, MAX_POPULATION]} frustumCulled={false}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={texAngry} transparent alphaTest={0.5} />
            </instancedMesh>
            
            <instancedMesh ref={zzzRef} args={[undefined, undefined, MAX_POPULATION]} frustumCulled={false}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={texZzz} transparent alphaTest={0.5} />
            </instancedMesh>
        </group>
    );
};