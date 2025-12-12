import React, { useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats, Environment } from '@react-three/drei';
import { Simulation } from './components/Simulation';
import { ControlPanel } from './components/ControlPanel';
import { DEFAULT_PARAMS, WORLD_SIZE } from './constants';
import { SimulationParams, ViewMode, Agent } from './types';

export default function App() {
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState({ count: 0, avgSelfishness: 0 });
  const [resetTrigger, setResetTrigger] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('selfishness');
  const [hoveredAgent, setHoveredAgent] = useState<Agent | null>(null);

  const handleStatsUpdate = useCallback((count: number, avgSelfishness: number) => {
    setStats({ count, avgSelfishness });
  }, []);

  const handleReset = () => {
    setResetTrigger(prev => prev + 1);
    setHoveredAgent(null);
  };

  return (
    <div className="relative w-full h-full bg-black">
      
      <ControlPanel 
        params={params} 
        setParams={setParams} 
        populationCount={stats.count}
        avgSelfishness={stats.avgSelfishness}
        paused={paused}
        setPaused={setPaused}
        resetSimulation={handleReset}
        viewMode={viewMode}
        setViewMode={setViewMode}
        hoveredAgent={hoveredAgent}
      />

      <div className="absolute inset-0 z-0">
        <Canvas shadows camera={{ position: [0, 50, 40], fov: 45 }}>
          <color attach="background" args={['#050505']} />
          <fog attach="fog" args={['#050505', 20, 90]} />
          
          <ambientLight intensity={0.4} />
          <directionalLight 
            position={[50, 50, 25]} 
            intensity={1.5} 
            castShadow 
            shadow-mapSize={[1024, 1024]} 
          />
          
          <Simulation 
            params={params} 
            paused={paused} 
            onStatsUpdate={handleStatsUpdate} 
            resetTrigger={resetTrigger}
            viewMode={viewMode}
            onHoverAgent={setHoveredAgent}
            hoveredAgent={hoveredAgent}
          />

          <OrbitControls 
            maxPolarAngle={Math.PI / 2 - 0.1} 
            minDistance={10} 
            maxDistance={120} 
          />
          <Environment preset="night" />
          <Stats className="!left-auto !right-0 !top-auto !bottom-0" />
        </Canvas>
      </div>

       {/* Overlay Hints */}
      <div className="absolute bottom-4 left-4 text-white/30 text-xs pointer-events-none select-none z-10">
        <p>Right Click: Pan • Left Click: Rotate • Scroll: Zoom • Hover Agent to Inspect</p>
      </div>
    </div>
  );
}