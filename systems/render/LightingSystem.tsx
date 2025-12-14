import React from 'react';
import { Color } from 'three';
import { WORLD_SIZE } from '../../core/constants';

// Global Light Control (Sun position synced with SkyLayer)
export const DayNightCycle = ({ time }: { time: number }) => {
    const angle = ((time - 6) / 24) * Math.PI * 2; 
    const radius = 60;
    const sunX = Math.cos(angle) * radius;
    const sunY = Math.sin(angle) * radius;
    
    const isDay = time > 5 && time < 19;
    const isSunrise = time > 5 && time < 7;
    const isSunset = time > 17 && time < 19;
    
    let sunColor = new Color('#ffffff');
    let intensity = 1.5;
    let ambientIntensity = 0.4;
    
    if (isSunrise) {
        sunColor.set('#ff9900');
        intensity = 1.0;
        ambientIntensity = 0.3;
    } else if (isSunset) {
        sunColor.set('#ff5500');
        intensity = 0.8;
        ambientIntensity = 0.2;
    } else if (!isDay) {
        sunColor.set('#0a0a2a'); // Moonlight
        intensity = 0.2;
        ambientIntensity = 0.1;
    }

    const shadowSize = WORLD_SIZE / 2 + 50;

    return (
        <>
            <ambientLight intensity={ambientIntensity} />
            <directionalLight 
                position={[sunX, Math.max(5, sunY), 20]} 
                intensity={intensity} 
                color={sunColor}
                castShadow 
                shadow-mapSize={[4096, 4096]} 
                shadow-bias={-0.0005}
                shadow-camera-left={-shadowSize}
                shadow-camera-right={shadowSize}
                shadow-camera-top={shadowSize}
                shadow-camera-bottom={-shadowSize}
                shadow-camera-near={0.1}
                shadow-camera-far={500}
            />
        </>
    )
};