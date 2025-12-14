import React, { useRef } from 'react';
import '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { Color, DirectionalLight, MathUtils } from 'three';
import { WORLD_SIZE } from '../../core/constants';

// Global Light Control
export const DayNightCycle = ({ time }: { time: number }) => {
    const lightRef = useRef<DirectionalLight>(null);

    // Modulo time so sun orbits correctly regardless of total days passed
    const dayTime = time % 24;

    // Calculate sun angle: 6am = 0 rads (horizon), 12pm = PI/2 (zenith)
    const angle = ((dayTime - 6) / 24) * Math.PI * 2;
    const radius = 100;
    
    const sinAngle = Math.sin(angle);
    const cosAngle = Math.cos(angle);
    
    // Light Position
    const sunPos = { x: cosAngle * radius, y: sinAngle * radius, z: 20 };
    const moonPos = { x: -cosAngle * radius, y: -sinAngle * radius, z: 20 }; // Opposite

    // Colors
    const SUN_COLOR = new Color('#ffffff');
    const SUNSET_COLOR = new Color('#ff9900');
    const MOON_COLOR = new Color('#aaccff');
    
    // Smooth Transitions
    // Day Factor: 1 at Noon, 0 at Horizon/Night.
    
    let targetColor = new Color();
    let intensity = 0;
    let ambientIntensity = 0;
    let ambientColor = new Color();

    // Smooth Blend Logic
    if (sinAngle > 0.1) {
        // --- FULL DAY ---
        const t = MathUtils.smoothstep(sinAngle, 0.1, 0.4);
        targetColor.lerpColors(SUNSET_COLOR, SUN_COLOR, t);
        intensity = MathUtils.lerp(0.5, 1.5, t);
        
        ambientColor.set('#ffffff');
        ambientIntensity = MathUtils.lerp(0.4, 0.7, t);
        
        if (lightRef.current) lightRef.current.position.set(sunPos.x, sunPos.y, sunPos.z);
    } 
    else if (sinAngle < -0.1) {
        // --- FULL NIGHT ---
        const t = MathUtils.smoothstep(-sinAngle, 0.1, 0.5); // 0 at horizon, 1 at midnight
        targetColor.copy(MOON_COLOR);
        
        // Brighter night settings as requested
        intensity = MathUtils.lerp(0.4, 0.8, t); 
        
        ambientColor.set('#2a2a4a'); // Blue-ish grey
        ambientIntensity = MathUtils.lerp(0.3, 0.5, t); // Base 0.3 minimum
        
        if (lightRef.current) lightRef.current.position.set(moonPos.x, moonPos.y, moonPos.z);
    } 
    else {
        // --- TWILIGHT TRANSITION (-0.1 to 0.1) ---
        // Blend from Night(Blue) -> Sunset(Orange)
        const t = MathUtils.smoothstep(sinAngle, -0.1, 0.1); // 0 = Night side, 1 = Day side
        
        if (t < 0.5) {
            // Night to Horizon
             targetColor.copy(MOON_COLOR).lerp(SUNSET_COLOR, t * 2);
             if (lightRef.current) lightRef.current.position.set(moonPos.x, moonPos.y, moonPos.z);
        } else {
            // Horizon to Day
             targetColor.copy(SUNSET_COLOR);
             if (lightRef.current) lightRef.current.position.set(sunPos.x, sunPos.y, sunPos.z);
        }
        
        intensity = 0.5;
        ambientColor.set('#2a2a4a').lerp(new Color('#ffffff'), t);
        ambientIntensity = 0.4;
    }

    const shadowSize = WORLD_SIZE / 2 + 100;

    return (
        <>
            <ambientLight intensity={ambientIntensity} color={ambientColor} />
            <directionalLight 
                ref={lightRef}
                intensity={intensity} 
                color={targetColor}
                castShadow 
                shadow-mapSize={[2048, 2048]} 
                shadow-bias={-0.0005}
                shadow-camera-left={-shadowSize}
                shadow-camera-right={shadowSize}
                shadow-camera-top={shadowSize}
                shadow-camera-bottom={-shadowSize}
                shadow-camera-near={1}
                shadow-camera-far={800}
            />
        </>
    )
};