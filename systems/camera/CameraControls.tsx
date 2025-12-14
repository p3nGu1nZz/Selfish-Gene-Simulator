import React, { useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, MathUtils } from 'three';
import { agents } from '../../core/ecs';
import { WORLD_SIZE } from '../../core/constants';
import { inputManager } from '../../core/InputManager';

export const CameraFollower = ({ selectedAgentId, controlsRef }: { selectedAgentId: number | null, controlsRef: any }) => {
    const { camera } = useThree();
    const prevId = useRef<number | null>(null);
    const prevTargetPos = useRef<Vector3>(new Vector3());

    useFrame(() => {
        if (!controlsRef.current) return;
        
        if (selectedAgentId === null) {
             prevId.current = null;
             return;
        }

        const agent = agents.entities.find(e => e.id === selectedAgentId);
        // If agent died or vanished, stop following
        if (!agent) return;

        // Clone position and CLAMP Y to be above ground
        // This prevents the camera from diving into the abyss when a rabbit goes to sleep at y=-5
        const currentPos = agent.position.clone();
        if (currentPos.y < 0.5) currentPos.y = 0.5; // Treat ground level as slightly above 0 for camera target

        // Initialization: Snap to agent for the first time
        if (prevId.current !== selectedAgentId) {
            const controls = controlsRef.current;
            
            // 1. Move target to agent
            controls.target.copy(currentPos);
            
            // 2. Position camera nicely behind/above relative to agent's heading
            // INCREASED DISTANCE: Higher and further back
            const offset = new Vector3(0, 12, 18); 
            camera.position.copy(currentPos).add(offset);
            
            prevId.current = selectedAgentId;
            prevTargetPos.current.copy(currentPos);
            
            controls.update();
        } else {
            // Update: Move camera along with the agent
            // We calculate the delta (movement) of the agent and apply it to the camera
            // This maintains the user's manual orbit angle and zoom distance
            const delta = new Vector3().subVectors(currentPos, prevTargetPos.current);
            
            // Only move if there's significant change to avoid micro-jitters
            if (delta.lengthSq() > 0.000001) {
                controlsRef.current.target.add(delta);
                camera.position.add(delta);
                prevTargetPos.current.copy(currentPos);
                
                // CRITICAL: Force camera to stay above ground regardless of target
                // This handles cases where manual rotation might push it down
                // or if target interpolation lags
                if (camera.position.y < 2.0) {
                    camera.position.y = 2.0;
                }
                
                // Also clamp target Y to never look below ground level in auto-follow
                if (controlsRef.current.target.y < 0) {
                    controlsRef.current.target.y = 0;
                }

                controlsRef.current.update();
            }
            
            // Extra safety: Continuously clamp camera height even if not moving
            // This catches cases where the user orbits "down" during follow
            if (camera.position.y < 2.0) camera.position.y = 2.0;
        }
    });
    return null;
}

export const KeyboardControls = ({ controlsRef }: { controlsRef: React.MutableRefObject<any> }) => {
    const { camera } = useThree();
    
    useFrame(() => {
        if (!controlsRef.current) return;
        
        // Input Manager Polling
        const speed = 2;
        const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forward.y = 0; forward.normalize();
        const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        right.y = 0; right.normalize();

        const offset = new Vector3();
        
        if (inputManager.isPressed('FORWARD')) offset.add(forward.multiplyScalar(speed));
        if (inputManager.isPressed('BACKWARD')) offset.add(forward.multiplyScalar(-speed));
        if (inputManager.isPressed('LEFT')) offset.add(right.multiplyScalar(-speed));
        if (inputManager.isPressed('RIGHT')) offset.add(right.multiplyScalar(speed));
        if (inputManager.isPressed('UP')) offset.add(new Vector3(0, speed, 0));
        if (inputManager.isPressed('DOWN')) offset.add(new Vector3(0, -speed, 0));
        
        if (inputManager.isPressed('RESET_CAMERA')) {
             // Handled via App callback usually
        }

        if (offset.lengthSq() > 0) {
            const target = controlsRef.current.target;
            target.add(offset);
            camera.position.add(offset);
            
            // Clamp
            const limit = WORLD_SIZE / 2;
            target.x = MathUtils.clamp(target.x, -limit, limit);
            target.z = MathUtils.clamp(target.z, -limit, limit);
            
            // Prevent target going below ground
            target.y = Math.max(0, target.y); 
            
            // Prevent camera going below ground
            camera.position.y = Math.max(2, camera.position.y);
        }
    });

    return null;
};