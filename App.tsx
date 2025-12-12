import React, { useState, useCallback, useRef, Suspense, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stats, Environment } from '@react-three/drei';
import { Simulation } from './components/Simulation';
import { ControlPanel } from './components/ControlPanel';
import { DEFAULT_PARAMS } from './core/constants';
import { SimulationParams, ViewMode, Entity } from './types';
import { Vector3, Spherical, MathUtils, MOUSE } from 'three';

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
const CameraFollower = ({ selectedAgent, zoomDist }: { selectedAgent: Entity | null, zoomDist: number }) => {
  const { camera, controls } = useThree();
  
  useFrame((state, delta) => {
    // @ts-ignore
    const ctrl = controls; 
    if(!ctrl) return;

    if (selectedAgent && selectedAgent.agent) {
       const agentPos = selectedAgent.position;
       // @ts-ignore
       const currentTarget = ctrl.target as Vector3;

       // 1. Smoothly interpolate the target to the agent's position
       const alpha = 5 * delta;
       const oldTarget = currentTarget.clone();
       currentTarget.lerp(agentPos, alpha);
       
       const moveDelta = currentTarget.clone().sub(oldTarget);
       camera.position.add(moveDelta);
       
       // 2. Zoom Effect
       // Calculate offset from current target
       const offset = camera.position.clone().sub(currentTarget);
       const spherical = new Spherical().setFromVector3(offset);

       // Use dynamic zoom distance
       const TARGET_RADIUS = zoomDist;
       
       // Smoothly pull radius towards desired distance
       if (Math.abs(spherical.radius - TARGET_RADIUS) > 0.1) {
            spherical.radius = MathUtils.lerp(spherical.radius, TARGET_RADIUS, 2 * delta);
       }
       
       // Ensure camera doesn't go below ground or too high
       spherical.phi = Math.min(spherical.phi, Math.PI / 2 - 0.2);
       spherical.makeSafe();

       // Apply the modified offset back to camera position
       const newPos = new Vector3().setFromSpherical(spherical).add(currentTarget);
       camera.position.copy(newPos);
       
       // @ts-ignore
       ctrl.update();
    }
  });

  return null;
};

// Component to handle keyboard panning
const KeyboardControls = ({ controlsRef }: { controlsRef: React.MutableRefObject<any> }) => {
    const { camera } = useThree();
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!controlsRef.current) return;
            const speed = 2;
            const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            forward.y = 0;
            forward.normalize();
            const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            right.y = 0;
            right.normalize();

            const offset = new Vector3();
            if (e.key === 'ArrowUp') offset.add(forward.multiplyScalar(speed));
            if (e.key === 'ArrowDown') offset.add(forward.multiplyScalar(-speed));
            if (e.key === 'ArrowLeft') offset.add(right.multiplyScalar(-speed));
            if (e.key === 'ArrowRight') offset.add(right.multiplyScalar(speed));

            if (offset.lengthSq() > 0) {
                controlsRef.current.target.add(offset);
                camera.position.add(offset);
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [camera, controlsRef]);
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
  const [followZoom, setFollowZoom] = useState(12);

  const controlsRef = useRef<any>(null);
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
        hoverTimeout.current = setTimeout(() => {
            setHoveredAgent(null);
        }, 50);
    }
  };

  const handleResetCamera = () => {
      setSelectedAgent(null);
      if (controlsRef.current) {
          const ctrl = controlsRef.current;
          ctrl.reset();
          ctrl.target.set(0, 0, 0);
          ctrl.object.position.set(0, 50, 40);
          ctrl.update();
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
        followZoom={followZoom}
        setFollowZoom={setFollowZoom}
        resetCamera={handleResetCamera}
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
            shadow-mapSize={[2048, 2048]} 
            shadow-bias={-0.0001}
          />
          
          <SimulationErrorBoundary 
            fallback={(err) => {
                console.warn("Falling back to procedural models due to load error:", err);
                return <Simulation key="procedural" {...commonProps} fallbackMode={true} />;
            }}
          >
            <Suspense fallback={null}>
                <Simulation key="model" {...commonProps} />
            </Suspense>
          </SimulationErrorBoundary>

          <CameraFollower selectedAgent={selectedAgent} zoomDist={followZoom} />
          <KeyboardControls controlsRef={controlsRef} />

          <OrbitControls 
            ref={controlsRef}
            makeDefault 
            maxPolarAngle={Math.PI / 2 - 0.1} 
            minDistance={5} 
            maxDistance={200}
            mouseButtons={{
                LEFT: MOUSE.PAN,
                RIGHT: MOUSE.ROTATE,
                MIDDLE: MOUSE.DOLLY
            }}
          />
          <Environment preset="night" />
          <Stats className="!left-auto !right-0 !top-auto !bottom-0" />
        </Canvas>
      </div>

       {/* Overlay Hints */}
      <div className="absolute bottom-4 left-4 text-white/30 text-xs pointer-events-none select-none z-10">
        <p>Right Drag: Rotate • Left Drag: Pan • Arrow Keys: Pan • Scroll: Zoom</p>
      </div>
    </div>
  );
}