import React, { useMemo, useRef } from 'react';
import '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, BackSide, ShaderMaterial, Mesh, MathUtils } from 'three';
import { WORLD_SIZE } from '../../core/constants';

interface Props {
    timeOfDay: number; // 0-24
}

const SkyShaderMaterial = {
    uniforms: {
        topColor: { value: new Color('#0077ff') },
        bottomColor: { value: new Color('#ffffff') },
        offset: { value: 100 }, 
        exponent: { value: 0.6 },
        sunPosition: { value: new Vector3() }
    },
    vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
            vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,
    fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;

        void main() {
            // Gradient based on height
            float h = normalize( vWorldPosition + vec3(0, offset, 0) ).y;
            vec3 skyColor = mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) );
            gl_FragColor = vec4( skyColor, 1.0 );
        }
    `
};

export const SkyLayer: React.FC<Props> = ({ timeOfDay }) => {
    const skyRef = useRef<Mesh>(null);
    const sunRef = useRef<Mesh>(null);
    const moonRef = useRef<Mesh>(null);
    
    // Calculate orbital positions
    const angle = ((timeOfDay - 6) / 24) * Math.PI * 2;
    const radius = 1600; 
    
    const sunPos = new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    const moonPos = new Vector3(Math.cos(angle + Math.PI) * radius, Math.sin(angle + Math.PI) * radius, 0);

    // Stars generation
    const starPositions = useMemo(() => {
        const pos = new Float32Array(1500 * 3);
        for(let i=0; i<1500; i++) {
            const r = 1550; 
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            pos[i*3] = r * Math.sin(phi) * Math.cos(theta);
            pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
            pos[i*3+2] = r * Math.cos(phi);
        }
        return pos;
    }, []);

    useFrame(() => {
        if (skyRef.current) {
            const mat = skyRef.current.material as ShaderMaterial;
            
            // Calculate Elevation (-1 to 1)
            const sinElevation = Math.sin(angle);
            
            // Define Palette
            const nightTop = new Color('#020617'); // Ink Blue
            const nightBot = new Color('#1e1b4b'); // Deep Indigo
            
            const sunriseTop = new Color('#3b82f6'); // Blue
            const sunriseBot = new Color('#fdba74'); // Orange
            
            const dayTop = new Color('#38bdf8'); // Sky Blue
            const dayBot = new Color('#e0f2fe'); // White-Blue

            // Mixing Logic
            let finalTop = new Color();
            let finalBot = new Color();
            
            // Smooth blending using MathUtils.smoothstep for cleaner transitions
            // Map elevation to 0-1 range for day cycle
            
            if (sinElevation > -0.2) {
                // Twilight to Day
                // Blend factor: 0 at -0.2 (start of dawn), 1 at 0.4 (fully day)
                const t = MathUtils.smoothstep(sinElevation, -0.2, 0.4);
                
                // First blend Night -> Sunrise
                const tSunrise = MathUtils.smoothstep(sinElevation, -0.2, 0.1);
                const tempTop = new Color().lerpColors(nightTop, sunriseTop, tSunrise);
                const tempBot = new Color().lerpColors(nightBot, sunriseBot, tSunrise);
                
                // Then blend Sunrise -> Day
                const tDay = MathUtils.smoothstep(sinElevation, 0.0, 0.5);
                finalTop.lerpColors(tempTop, dayTop, tDay);
                finalBot.lerpColors(tempBot, dayBot, tDay);
                
            } else {
                // Night
                finalTop.copy(nightTop);
                finalBot.copy(nightBot);
            }

            mat.uniforms.topColor.value.copy(finalTop);
            mat.uniforms.bottomColor.value.copy(finalBot);
            mat.uniforms.sunPosition.value.copy(sunPos);
        }
    });

    // Calculate star opacity: 1.0 when sun is down (-0.15), 0.0 when sun is up (0.15)
    const starOpacity = 1.0 - MathUtils.smoothstep(Math.sin(angle), -0.15, 0.15);

    return (
        <group>
            {/* Sky Sphere */}
            <mesh ref={skyRef} scale={[1, 1, 1]}>
                <sphereGeometry args={[1600, 32, 15]} />
                <shaderMaterial 
                    attach="material" 
                    args={[SkyShaderMaterial]} 
                    side={BackSide} 
                    depthWrite={false}
                />
            </mesh>

            {/* Sun Sphere */}
            <mesh ref={sunRef} position={sunPos} visible={sunPos.y > -100}>
                <sphereGeometry args={[80, 32, 32]} />
                <meshBasicMaterial color="#FDB813" toneMapped={false} />
            </mesh>

            {/* Moon Sphere */}
            <mesh ref={moonRef} position={moonPos} visible={moonPos.y > -100}>
                <sphereGeometry args={[50, 32, 32]} />
                <meshBasicMaterial color="#F4F6F0" toneMapped={false} />
            </mesh>
            
            {/* Stars - visible when sun is low */}
            <points rotation={[0, 0, timeOfDay * 0.02]}>
                <bufferGeometry>
                    <bufferAttribute 
                        attach="attributes-position" 
                        count={1500} 
                        array={starPositions} 
                        itemSize={3} 
                    />
                </bufferGeometry>
                <pointsMaterial 
                    size={5} 
                    color="white" 
                    sizeAttenuation={false} 
                    transparent 
                    opacity={starOpacity} 
                />
            </points>
        </group>
    );
};