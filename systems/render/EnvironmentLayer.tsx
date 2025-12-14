import React, { useMemo, useRef } from 'react';
import '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, Color, ShaderMaterial, Vector3 } from 'three';
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

// -- Water Shader --
const WaterShaderMaterial = {
    uniforms: {
        uTime: { value: 0 },
        uColorA: { value: new Color('#0ea5e9') }, // Sky blue
        uColorB: { value: new Color('#1e3a8a') }  // Deep ocean blue
    },
    vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vElevation;

        // Simplex Noise (2D)
        vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
        float snoise(vec2 v){
            const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy) );
            vec2 x0 = v -   i + dot(i, C.xx);
            vec2 i1;
            i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod(i, 289.0);
            vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
            m = m*m ;
            m = m*m ;
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
            vec3 g;
            g.x  = a0.x  * x0.x  + h.x  * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }

        void main() {
            vUv = uv;
            vec3 pos = position;
            
            float noiseFreq = 0.02;
            float noiseAmp = 2.0;
            
            float elevation = snoise(vec2(pos.x * noiseFreq + uTime * 0.2, pos.y * noiseFreq + uTime * 0.1));
            elevation += snoise(vec2(pos.x * noiseFreq * 2.0 - uTime * 0.1, pos.y * noiseFreq * 2.0 + uTime * 0.2)) * 0.5;
            
            pos.z += elevation * noiseAmp; // Displace Z because plane is rotated
            vElevation = elevation;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying float vElevation;

        void main() {
            float mixStrength = (vElevation + 1.0) * 0.5;
            vec3 color = mix(uColorB, uColorA, mixStrength);
            
            // Simple specular highlight fake
            if(mixStrength > 0.8) color += 0.1;

            gl_FragColor = vec4(color, 0.9); // Slight Transparency
        }
    `
};

export const EnvironmentLayer: React.FC<Props> = ({ onSelectAgent, showGrid }) => {
    const waterRef = useRef<any>(null);

    useFrame((state) => {
        if (waterRef.current) {
            waterRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    // Custom Shader Logic for the Island Terrain
    const materialLogic = useMemo(() => {
        const onBeforeCompile = (shader: Shader) => {
            shader.uniforms.uColorA = { value: new Color('#22381a') }; // Deep forest green
            shader.uniforms.uColorB = { value: new Color('#527a36') }; // Lighter grass green
            shader.uniforms.uScale = { value: 0.08 }; 
            
            shader.vertexShader = `
                varying vec2 vWorldUv;
                ${shader.vertexShader}
            `.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                vWorldUv = (modelMatrix * vec4(position, 1.0)).xz;
                `
            );

            shader.fragmentShader = `
                uniform vec3 uColorA;
                uniform vec3 uColorB;
                uniform float uScale;
                varying vec2 vWorldUv;

                float hash(vec2 p) {
                    p = fract(p * vec2(123.34, 456.21));
                    p += dot(p, p + 45.32);
                    return fract(p.x * p.y);
                }
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
                float n = fbm(vWorldUv * uScale);
                vec3 groundColor = mix(uColorA, uColorB, n);
                float micro = hash(vWorldUv * 50.0);
                groundColor += (micro - 0.5) * 0.05;
                diffuseColor.rgb = groundColor;
                `
            );
        };
        return { onBeforeCompile };
    }, []);

    // Radius of the Island
    const islandRadius = WORLD_SIZE / 2;

    return (
        <>
            {/* The Island: A Cylinder geometry to create a circular landmass */}
            <mesh 
                position={[0, -2.5, 0]} 
                receiveShadow
                onClick={(e) => { e.stopPropagation(); onSelectAgent(null); }}
                onPointerOver={() => document.body.style.cursor = 'default'}
            >
                {/* Height 5, positioned at -2.5 so top face is at y=0 */}
                <cylinderGeometry args={[islandRadius, islandRadius, 5, 64]} />
                <meshStandardMaterial 
                    roughness={1.0} 
                    metalness={0.0}
                    onBeforeCompile={materialLogic.onBeforeCompile}
                />
            </mesh>
            
            {/* Dark soil bottom for the island so it looks solid from angles */}
            <mesh position={[0, -5, 0]} rotation={[-Math.PI/2, 0, 0]}>
                <circleGeometry args={[islandRadius, 64]} />
                <meshBasicMaterial color="#1a120b" />
            </mesh>

            {/* The Water: Animated Shader Plane surrounding the island */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.0, 0]}>
                <planeGeometry args={[4000, 4000, 128, 128]} />
                <shaderMaterial 
                    ref={waterRef}
                    attach="material" 
                    args={[WaterShaderMaterial]} 
                    transparent
                />
            </mesh>

            {showGrid && <gridHelper args={[WORLD_SIZE, 50, 0x444444, 0x222222]} position={[0, 0.1, 0]} />}
        </>
    );
};