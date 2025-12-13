import React from 'react';
import { WORLD_SIZE } from '../../core/constants';

interface Props {
    onSelectAgent: (val: null) => void;
    showGrid: boolean;
}

export const EnvironmentLayer: React.FC<Props> = ({ onSelectAgent, showGrid }) => {
    return (
        <>
            <mesh 
                rotation={[-Math.PI / 2, 0, 0]} 
                position={[0, -0.5, 0]} 
                receiveShadow
                onClick={(e) => { e.stopPropagation(); onSelectAgent(null); }}
                onPointerOver={() => document.body.style.cursor = 'default'}
            >
                <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
                <meshStandardMaterial color="#2d5a27" roughness={0.8} metalness={0.2} />
            </mesh>
            {showGrid && <gridHelper args={[WORLD_SIZE, 50, 0x444444, 0x222222]} />}
        </>
    );
};