import React, { useState, useCallback, useRef, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stats, Environment } from '@react-three/drei';
import { Simulation } from './components/Simulation';
import { ControlPanel } from './components/ControlPanel';
import { DEFAULT_PARAMS, WORLD_SIZE } from './constants';
import { SimulationParams, ViewMode, Entity } from './types';
import { Vector3, Spherical } from 'three';

// Error Boundary to catch 404s on the model loader
class SimulationErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: (error: any) => React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}

// Component to handle camera following logic
const CameraFollower = ({ selectedAgent }: { selectedAgent: Entity | null }) => {
  const { camera, controls } = useThree();
  
  useFrame((state, delta) => {
    if (selectedAgent && controls) {
      // @ts-ignore
      const target = controls.target as Vector3;
      const agentPos = selectedAgent.position;
      
      // 1. Smoothly interpolate the target to the agent's position
      // This keeps the camera looking at the agent
      const lerpSpeed = 4 * delta;
      target.lerp(agentPos, lerpSpeed);
      
      // 2. Adjust camera position for better context (tilt and zoom)
      // Calculate current offset from target
      const offset = camera.position.clone().sub(target);
      const spherical = new Spherical().setFromVector3(offset);

      // Desired configuration:
      // Radius: ~30 units provides good context without being too far
      // Phi: ~50 degrees (PI/3.5) gives a nice top-down diagonal view
      const desiredRadius = 30;
      const desiredPhi = Math.PI / 3.5; 

      // Smoothly pull radius towards desired distance
      spherical.radius += (desiredRadius - spherical.radius) * delta;
      
      // Smoothly pull angle up if we are looking too much from the side (high phi)
      // We allow the user to rotate freely, but provide a gentle guide towards a better angle
      if (spherical.phi > desiredPhi + 0.2) {
         spherical.phi += (desiredPhi - spherical.phi) * delta;
      }
      
      spherical.makeSafe();

      // Apply the modified offset back to camera position
      const newOffset = new Vector3().setFromSpherical(spherical);
      camera.position.copy(target.clone().add(newOffset));
      
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
  const [hoveredAgent, setHoveredAgent] = useState<Entity | null>(null);
  
  // New State
  const [fogDistance, setFogDistance] = useState(180);
  const [selectedAgent, setSelectedAgent] = useState<Entity | null>(null);
  const [showEnergyBars, setShowEnergyBars] = useState(true);

  const hoverTimeout = useRef<any>(null);

  const handleStatsUpdate = useCallback((count: number, avgSelfishness: number) => {
    setStats({ count, avgSelfishness });
  }, []);

  const handleReset = () => {
    setResetTrigger(prev => prev + 1);
    setHoveredAgent(null);
    setSelectedAgent(null);
  };

  const handleAgentSelect = (agent: Entity | null) => {
    setSelectedAgent(agent);
    // Also set as hovered so the inspector shows up immediately
    if (agent) {
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        setHoveredAgent(agent);
    }
  };

  const handleAgentHover = (agent: Entity | null) => {
    if (hoverTimeout.current) {
        clearTimeout(hoverTimeout.current);
        hoverTimeout.current = null;
    }

    if (agent) {
        setHoveredAgent(agent);
    } else {
        // Debounce clearing to prevent flicker when moving between agent sphere and energy bar
        hoverTimeout.current = setTimeout(() => {
            setHoveredAgent(null);
        }, 50);
    }
  };

  const commonProps = {
    params,
    paused,
    onStatsUpdate: handleStatsUpdate,
    resetTrigger,
    viewMode,
    onHoverAgent: handleAgentHover,
    hoveredAgent,
    onSelectAgent: handleAgentSelect,
    selectedAgent,
    showEnergyBars
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
        showEnergyBars={showEnergyBars}
        setShowEnergyBars={setShowEnergyBars}
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
          
          <SimulationErrorBoundary 
            fallback={(err) => {
                console.warn("Falling back to procedural models due to load error:", err);
                // Using key='procedural' forces a remount
                return <Simulation key="procedural" {...commonProps} fallbackMode={true} />;
            }}
          >
            <Suspense fallback={null}>
                {/* Using key='model' ensures this is treated as a distinct tree */}
                <Simulation key="model" {...commonProps} />
            </Suspense>
          </SimulationErrorBoundary>

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