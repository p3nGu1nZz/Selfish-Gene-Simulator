import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { DynamicDrawUsage, BufferGeometry, AdditiveBlending } from 'three';
import { ViewMode } from '../../core/types';
import { agents } from '../../core/ecs';
import { MAX_POPULATION, MAX_TRAIL_POINTS } from '../../core/constants';
import { getAgentColorRGB } from '../../core/utils';

interface Props {
    viewMode: ViewMode;
}

export const TrailLayer: React.FC<Props> = ({ viewMode }) => {
    const trailGeoRef = useRef<BufferGeometry>(null);
    
    // Trail Buffers
    const MAX_SEGMENTS = MAX_POPULATION * (MAX_TRAIL_POINTS - 1);
    const [trailPositions, trailColors] = useMemo(() => [
        new Float32Array(MAX_SEGMENTS * 2 * 3),
        new Float32Array(MAX_SEGMENTS * 2 * 3)
    ], []);

    useFrame(() => {
        const allAgents = agents.entities;
        let trailVertexIndex = 0;

        for (let i = 0; i < allAgents.length; i++) {
            const entity = allAgents[i];
            const { agent } = entity;
            if(!agent) continue;

            const { r, g, b } = getAgentColorRGB(agent, viewMode);

            if (agent.trail.length > 1) {
                for (let j = 0; j < agent.trail.length - 1; j++) {
                    const p1 = agent.trail[j];
                    const p2 = agent.trail[j+1];
                    if (trailVertexIndex * 3 < trailPositions.length) {
                        const fade1 = Math.pow(j / (MAX_TRAIL_POINTS - 1), 2);
                        const fade2 = Math.pow((j + 1) / (MAX_TRAIL_POINTS - 1), 2);

                        trailPositions[trailVertexIndex * 3] = p1.x;
                        trailPositions[trailVertexIndex * 3 + 1] = p1.y;
                        trailPositions[trailVertexIndex * 3 + 2] = p1.z;
                        trailColors[trailVertexIndex * 3] = r * fade1;
                        trailColors[trailVertexIndex * 3 + 1] = g * fade1;
                        trailColors[trailVertexIndex * 3 + 2] = b * fade1;

                        trailPositions[(trailVertexIndex + 1) * 3] = p2.x;
                        trailPositions[(trailVertexIndex + 1) * 3 + 1] = p2.y;
                        trailPositions[(trailVertexIndex + 1) * 3 + 2] = p2.z;
                        trailColors[(trailVertexIndex + 1) * 3] = r * fade2;
                        trailColors[(trailVertexIndex + 1) * 3 + 1] = g * fade2;
                        trailColors[(trailVertexIndex + 1) * 3 + 2] = b * fade2;

                        trailVertexIndex += 2;
                    }
                }
            }
        }

        if (trailGeoRef.current) {
            trailGeoRef.current.setDrawRange(0, trailVertexIndex);
            trailGeoRef.current.attributes.position.needsUpdate = true;
            trailGeoRef.current.attributes.color.needsUpdate = true;
        }
    });

    return (
        <lineSegments frustumCulled={false}>
            <bufferGeometry ref={trailGeoRef}>
                <bufferAttribute attach="attributes-position" count={trailPositions.length / 3} array={trailPositions} itemSize={3} usage={DynamicDrawUsage} />
                <bufferAttribute attach="attributes-color" count={trailColors.length / 3} array={trailColors} itemSize={3} usage={DynamicDrawUsage} />
            </bufferGeometry>
            <lineBasicMaterial vertexColors opacity={0.6} transparent blending={AdditiveBlending} />
        </lineSegments>
    );
};