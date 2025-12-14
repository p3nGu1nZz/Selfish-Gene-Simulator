import React, { useMemo } from 'react';
import '@react-three/fiber';
import { DoubleSide, Color } from 'three';
import { WORLD_SIZE } from '../../core/constants';

interface Shader {
    uniforms: { [uniform: string]: { value: any } };
    vertexShader: string;
    fragmentShader: string;
}

interface Props {
    onSelectAgent: (val: null) => void;
    showGrid: boolean;
}

export const EnvironmentLayer: React.FC<Props> = ({ onSelectAgent, showGrid }) => {
    
    // Custom Shader Logic to inject into MeshStandardMaterial
    // This allows us to keep Shadows, Fog, and Lighting support from Three.js
    // while procedurally generating the ground pattern.
    const materialLogic = useMemo(() => {
        const onBeforeCompile = (shader: Shader) => {
            // Define uniforms for the noise colors
            shader.uniforms.uColorA = { value: new Color('#22381a') }; // Deep forest green
            shader.uniforms.uColorB = { value: new Color('#527a36') }; // Lighter grass green
            shader.uniforms.uScale = { value: 0.08 }; // Scale of the noise pattern

            // Inject Uniforms and Varyings into Vertex Shader
            shader.vertexShader = `
                varying vec2 vWorldUv;
                ${shader.vertexShader}
            `.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                // Use world position XZ for UVs to ensure consistent sizing regardless of plane UVs
                vWorldUv = (modelMatrix * vec4(position, 1.0)).xz;
                `
            );

            // Inject Noise functions and Color mixing into Fragment Shader
            shader.fragmentShader = `
                uniform vec3 uColorA;
                uniform vec3 uColorB;
                uniform float uScale;
                varying vec2 vWorldUv;

                // 2D Hash Function
                float hash(vec2 p) {
                    p = fract(p * vec2(123.34, 456.21));
                    p += dot(p, p + 45.32);
                    return fract(p.x * p.y);
                }

                // 2D Noise Function
                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    float a = hash(i);
                    float b = hash(i + vec2(1.0, 0.0));
                    float c = hash(i + vec2(0.0, 1.0));
                    float d = hash(i + vec2(1.0, 1.0));
                    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
                }

                // Fractal Brownian Motion for detail
                float fbm(vec2 p) {
                    float v = 0.0;
                    float a = 0.5;
                    for (int i = 0; i < 4; i++) {
                        v += a * noise(p);
                        p *= 2.0;
                        a *= 0.5;
                    }
                    return v;
                }

                ${shader.fragmentShader}
            `.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                
                // Generate noise value based on world coordinates
                float n = fbm(vWorldUv * uScale);
                
                // Mix the two green tones based on noise
                vec3 groundColor = mix(uColorA, uColorB, n);

                // Add a very subtle micro-noise for texture
                float micro = hash(vWorldUv * 50.0);
                groundColor += (micro - 0.5) * 0.05;

                // Apply to diffuse color (which is then lit by the engine)
                diffuseColor.rgb = groundColor;
                `
            );
        };

        return { onBeforeCompile };
    }, []);

    return (
        <>
            {/* Main Game World Terrain */}
            <mesh 
                rotation={[-Math.PI / 2, 0, 0]} 
                position={[0, -0.5, 0]} 
                receiveShadow
                onClick={(e) => { e.stopPropagation(); onSelectAgent(null); }}
                onPointerOver={() => document.body.style.cursor = 'default'}
            >
                <planeGeometry args={[WORLD_SIZE, WORLD_SIZE, 32, 32]} />
                {/* 
                    Using MeshStandardMaterial with onBeforeCompile.
                    Roughness 1.0 for matte ground.
                    Standard lighting will apply on top of our custom color.
                */}
                <meshStandardMaterial 
                    roughness={1.0} 
                    metalness={0.0}
                    onBeforeCompile={materialLogic.onBeforeCompile}
                />
            </mesh>

            {/* The Abyss: A massive dark plane below the world to hide edges and blend with skybox */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4, 0]}>
                <circleGeometry args={[4000, 64]} />
                <meshBasicMaterial color="#111810" side={DoubleSide} />
            </mesh>

            {showGrid && <gridHelper args={[WORLD_SIZE, 50, 0x444444, 0x222222]} />}
        </>
    );
};