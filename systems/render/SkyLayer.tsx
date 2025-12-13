import React, { useMemo } from 'react';
import { Sky, Stars, Float } from '@react-three/drei';
import { Vector3, Color, MathUtils } from 'three';

interface Props {
    timeOfDay: number; // 0-24
}

// Simple low-poly cloud composed of spheres
const SimpleCloud = ({ position, scale = 1, opacity = 0.8 }: { position: [number, number, number], scale?: number, opacity?: number }) => {
    const parts = useMemo(() => {
        const p: { pos: [number, number, number], scale: number }[] = [];
        const count = 5 + Math.floor(Math.random() * 3);
        for(let i=0; i<count; i++) {
            p.push({
                pos: [
                    (Math.random() - 0.5) * 2.5,
                    (Math.random() - 0.5) * 1.0,
                    (Math.random() - 0.5) * 2.0
                ],
                scale: 0.8 + Math.random() * 0.8
            });
        }
        return p;
    }, []);

    return (
        <group position={position} scale={[scale, scale, scale]}>
            {parts.map((part, i) => (
                <mesh key={i} position={part.pos} scale={part.scale}>
                    <sphereGeometry args={[1, 7, 7]} />
                    <meshStandardMaterial color="white" transparent opacity={opacity} flatShading roughness={1} />
                </mesh>
            ))}
        </group>
    );
};

export const SkyLayer: React.FC<Props> = ({ timeOfDay }) => {
    // Map time (0-24) to an angle (0-2PI). 
    // Noon (12) should be PI/2 (overhead). 6am is 0.
    const angle = ((timeOfDay - 6) / 24) * Math.PI * 2;
    const radius = 100;
    
    const sunPos = new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    const moonPos = new Vector3(Math.cos(angle + Math.PI) * radius, Math.sin(angle + Math.PI) * radius, 0);

    const isNight = timeOfDay > 19 || timeOfDay < 5;

    return (
        <group>
            <Sky 
                distance={4500} 
                sunPosition={sunPos} 
                inclination={0} 
                azimuth={0.25} 
                // Adjusted for bluer sky
                rayleigh={0.5} 
                turbidity={8} 
                mieCoefficient={0.005}
                mieDirectionalG={0.7}
            />
            
            {/* Stars fade in at night */}
            {isNight && (
                <group rotation={[0, 0, Math.PI / 4]}>
                    <Stars 
                        radius={300} 
                        depth={50} 
                        count={5000} 
                        factor={4} 
                        saturation={0} 
                        fade 
                        speed={1} 
                    />
                </group>
            )}

            {/* Clouds - stylized and floating */}
            <Float speed={1} rotationIntensity={0.05} floatIntensity={0.5} floatingRange={[0, 2]}>
                <group position={[0, 40, 0]}>
                   <SimpleCloud position={[-30, 5, -20]} scale={3} opacity={0.6} />
                   <SimpleCloud position={[20, -2, -40]} scale={4} opacity={0.5} />
                   <SimpleCloud position={[10, 8, 30]} scale={3.5} opacity={0.7} />
                   <SimpleCloud position={[-15, 12, 40]} scale={2.5} opacity={0.4} />
                   <SimpleCloud position={[40, 2, 10]} scale={3} opacity={0.6} />
                </group>
            </Float>

            {/* Moon Mesh */}
            {isNight && (
                <mesh position={moonPos} scale={4}>
                    <sphereGeometry args={[1, 16, 16]} />
                    <meshBasicMaterial color="#ffffee" />
                </mesh>
            )}
        </group>
    );
};