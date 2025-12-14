import React, { useMemo, useRef } from 'react';
import '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, BackSide, ShaderMaterial, Mesh } from 'three';
import { WORLD_SIZE } from '../../core/constants';

interface Props {
    timeOfDay: number; // 0-24
}

const SkyShaderMaterial = {
    uniforms: {
        topColor: { value: new Color('#0077ff') },
        bottomColor: { value: new Color('#ffffff') },
        offset: { value: 120 }, // Scaled up offset for larger radius
        exponent: { value: 0.6 },
        time: { value: 0 },
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
        uniform float time; // Used for night blend
        varying vec3 vWorldPosition;

        void main() {
            float h = normalize( vWorldPosition + vec3(0, offset, 0) ).y;
            vec3 dayGradient = mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) );
            
            // Night Gradient (Dark Blue/Black)
            vec3 nightTop = vec3(0.02, 0.02, 0.1);
            vec3 nightBottom = vec3(0.0, 0.0, 0.02);
            vec3 nightGradient = mix(nightBottom, nightTop, max( pow( max( h, 0.0), exponent), 0.0));
            
            // Blend based on time-derived factor
            
            gl_FragColor = vec4( dayGradient, 1.0 );
        }
    `
};

export const SkyLayer: React.FC<Props> = ({ timeOfDay }) => {
    const skyRef = useRef<Mesh>(null);
    const sunRef = useRef<Mesh>(null);
    const moonRef = useRef<Mesh>(null);
    
    // Time Mapping: 
    // 6.0 = Sunrise, 12.0 = Noon, 18.0 = Sunset, 24.0/0.0 = Midnight
    const angle = ((timeOfDay - 6) / 24) * Math.PI * 2;
    // Radius must be larger than world diagonal to avoid clipping
    // World is 1024, diagonal is ~1450. Using 1600 to be safe.
    const radius = 1600; 
    const sunPos = new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    const moonPos = new Vector3(Math.cos(angle + Math.PI) * radius, Math.sin(angle + Math.PI) * radius, 0);

    // FIX: Lift useMemo out of conditional rendering to satisfy Rules of Hooks
    const starPositions = useMemo(() => {
        const pos = new Float32Array(1500 * 3);
        for(let i=0; i<1500; i++) {
            const r = 1550; // Place stars just inside sky sphere
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
            
            // Interpolate Sky Colors
            // Day: SkyBlue to White
            // Night: DeepBlue to Black
            const isDay = timeOfDay > 5 && timeOfDay < 19;
            const isTransition = (timeOfDay > 5 && timeOfDay < 7) || (timeOfDay > 17 && timeOfDay < 19);
            
            let t = 1.0; // Day strength
            if (timeOfDay < 5 || timeOfDay > 19) t = 0.0;
            else if (timeOfDay >= 5 && timeOfDay < 7) t = (timeOfDay - 5) / 2;
            else if (timeOfDay >= 17 && timeOfDay < 19) t = 1.0 - (timeOfDay - 17) / 2;
            
            const dayTop = new Color('#4CA1FF');
            const dayBot = new Color('#C3E0FF');
            
            const nightTop = new Color('#0B1026');
            const nightBot = new Color('#2B3266');
            
            // Sunset / Sunrise orange tint
            const sunsetColor = new Color('#FF9642');
            
            let finalTop = new Color().lerpColors(nightTop, dayTop, t);
            let finalBot = new Color().lerpColors(nightBot, dayBot, t);
            
            // Add sunset glow to horizon
            if (isTransition) {
                // Peak transition effect at 6 and 18
                const transitionStrength = 1.0 - Math.abs( (timeOfDay < 12 ? 6 : 18) - timeOfDay );
                if (transitionStrength > 0) {
                     finalBot.lerp(sunsetColor, transitionStrength * 0.7);
                }
            }

            mat.uniforms.topColor.value.copy(finalTop);
            mat.uniforms.bottomColor.value.copy(finalBot);
            mat.uniforms.sunPosition.value.copy(sunPos);
        }
    });

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
            <mesh ref={sunRef} position={sunPos} visible={sunPos.y > -50}>
                <sphereGeometry args={[80, 32, 32]} />
                <meshBasicMaterial color="#FFD700" toneMapped={false} />
            </mesh>

            {/* Moon Sphere */}
            <mesh ref={moonRef} position={moonPos} visible={moonPos.y > -50}>
                <sphereGeometry args={[50, 32, 32]} />
                <meshBasicMaterial color="#FEFCD7" toneMapped={false} />
            </mesh>
            
            {/* Simple Stars (Points) */}
            { (timeOfDay < 6 || timeOfDay > 18) && (
                <points rotation={[0,0, timeOfDay * 0.05]}>
                    <bufferGeometry>
                        <bufferAttribute 
                            attach="attributes-position" 
                            count={1500} 
                            array={starPositions} 
                            itemSize={3} 
                        />
                    </bufferGeometry>
                    <pointsMaterial size={4} color="white" sizeAttenuation={false} transparent opacity={Math.max(0, 1 - Math.abs(timeOfDay - 12)/6 * -1 )} />
                </points>
            )}
        </group>
    );
};