import React, { useState, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stats, Environment } from '@react-three/drei';
import { Simulation } from './components/Simulation';
import { ControlPanel } from './components/ControlPanel';
import { DEFAULT_PARAMS, WORLD_SIZE } from './constants';
import { SimulationParams, ViewMode, Agent } from './types';
import { Vector3 } from 'three';

// Component to handle camera following logic
const CameraFollower = ({ selectedAgent }: { selectedAgent: Agent | null }) => {
  const { controls } = useThree();
  
  useFrame((state, delta) => {
    if (selectedAgent && controls) {
      // @ts-ignore - OrbitControls type definition often misses 'target' in standard useThree types depending on version
      const target = controls.target as Vector3;
      
      // Smoothly interpolate the orbit controls target to the agent's position
      // Using a faster lerp for responsiveness
      target.lerp(selectedAgent.position, 5 * delta);
      
      // Update controls to apply changes
      // @ts-ignore
      controls.update();
    }
  });

  return null;
};

export default function App() {
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState({ count: 0, avgSelfishness: 0 });
  const [resetTrigger, setResetTrigger] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('selfishness');
  const [hoveredAgent, setHoveredAgent] = useState<Agent | null>(null);
  
  // New State
  const [fogDistance, setFogDistance] = useState(90);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const handleStatsUpdate = useCallback((count: number, avgSelfishness: number) => {
    setStats({ count, avgSelfishness });
  }, []);

  const handleReset = () => {
    setResetTrigger(prev => prev + 1);
    setHoveredAgent(null);
    setSelectedAgent(null);
  };

  const handleAgentSelect = (agent: Agent | null) => {
    setSelectedAgent(agent);
    // Also set as hovered so the inspector shows up immediately
    if (agent) setHoveredAgent(agent);
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
        hoveredAgent={hoveredAgent || selectedAgent} // Show selected if not hovering others
        fogDistance={fogDistance}
        setFogDistance={setFogDistance}
        selectedAgent={selectedAgent}
        setSelectedAgent={handleAgentSelect}
      />

      <div className="absolute inset-0 z-0">
        <Canvas shadows camera={{ position: [0, 50, 40], fov: 45 }}>
          <color attach="background" args={['#050505']} />
          <fog attach="fog" args={['#050505', 10, fogDistance]} />
          
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
            onSelectAgent={handleAgentSelect}
            selectedAgent={selectedAgent}
          />

          <CameraFollower selectedAgent={selectedAgent} />

          <OrbitControls 
            makeDefault 
            maxPolarAngle={Math.PI / 2 - 0.1} 
            minDistance={5} 
            maxDistance={200} 
          />
          <Environment preset="night" />
          <Stats className="!left-auto !right-0 !top-auto !bottom-0" />
        </Canvas>
      </div>

       {/* Overlay Hints */}
      <div className="absolute bottom-4 left-4 text-white/30 text-xs pointer-events-none select-none z-10">
        <p>Right Click: Pan • Left Click: Rotate/Select • Scroll: Zoom</p>
      </div>
    </div>
  );
}