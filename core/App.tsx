import React, { useState, useCallback, useRef, Suspense, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import { Simulation } from '../components/Simulation';
import { ControlPanel } from '../systems/ui/ControlPanel';
import { DEFAULT_PARAMS, WORLD_SIZE } from './constants';
import { SimulationParams, ViewMode, AgentData } from './types';
import { Vector3, MathUtils, Color, Vector2 } from 'three';
import { agents } from './ecs';

// Error Boundary
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

// Global Light Control (Sun position synced with SkyLayer)
const DayNightCycle = ({ time }: { time: number }) => {
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

    return (
        <>
            <ambientLight intensity={ambientIntensity} />
            <directionalLight 
                position={[sunX, Math.max(5, sunY), 20]} 
                intensity={intensity} 
                color={sunColor}
                castShadow 
                shadow-mapSize={[2048, 2048]} 
                shadow-bias={-0.0001}
                shadow-camera-left={-120}
                shadow-camera-right={120}
                shadow-camera-top={120}
                shadow-camera-bottom={-120}
                shadow-camera-near={0.1}
                shadow-camera-far={300}
            />
        </>
    )
}

// Improved Camera Follower (Third Person Style)
const CameraFollower = ({ selectedAgentId, controlsRef }: { selectedAgentId: number | null, controlsRef: any }) => {
    const { camera } = useThree();
    const prevId = useRef<number | null>(null);
    const offsetVec = useRef(new Vector3());

    useFrame((state, delta) => {
        if (!controlsRef.current) return;
        
        if (selectedAgentId === null) {
             prevId.current = null;
             return;
        }

        const agent = agents.entities.find(e => e.id === selectedAgentId);
        if (!agent || !agent.agent) return;

        const target = controlsRef.current.target;
        
        // Offset Logic:
        // We want the rabbit to appear on the LEFT side of the screen.
        // This means the camera should look at a point to the RIGHT of the rabbit.
        const cameraDir = new Vector3();
        camera.getWorldDirection(cameraDir);
        cameraDir.y = 0;
        cameraDir.normalize();
        
        const cameraRight = new Vector3();
        cameraRight.crossVectors(cameraDir, new Vector3(0, 1, 0)).normalize();
        
        // Shift target right by 2 units -> Rabbit appears left by 2 units
        const idealTarget = agent.position.clone().add(cameraRight.multiplyScalar(2.0));

        // Smoothly interpolate the controls target to the ideal target
        target.lerp(idealTarget, 10 * delta);

        // Third Person "Behind" Camera Logic
        // If we just switched to this agent, snap camera to behind them
        if (prevId.current !== selectedAgentId) {
            // Calculate a position behind the rabbit based on its heading
            const heading = agent.agent.heading.clone().normalize();
            if (heading.lengthSq() < 0.01) heading.set(0, 0, 1);
            
            // Initial Third Person Offset: CLOSER (8 units behind) and slightly up (5 units up)
            // User requested: "zoomed out" fix -> reduce scalar.
            const offset = heading.clone().multiplyScalar(-8).add(new Vector3(0, 5, 0));
            
            // Apply offset + shift right slightly so camera aligns with the "left-offset" view
            const rightShift = new Vector3().crossVectors(heading, new Vector3(0,1,0)).normalize().multiplyScalar(2.0);
            
            camera.position.copy(agent.position).add(offset).add(rightShift);
            
            prevId.current = selectedAgentId;
        } 

        controlsRef.current.update();
    });
    return null;
}

const KeyboardControls = ({ controlsRef }: { controlsRef: React.MutableRefObject<any> }) => {
    const { camera } = useThree();
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!controlsRef.current) return;
            if ((e.target as HTMLElement).tagName === 'INPUT') return;

            const speed = 2;
            const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            forward.y = 0; forward.normalize();
            const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            right.y = 0; right.normalize();

            const offset = new Vector3();
            if (e.key === 'ArrowUp') offset.add(forward.multiplyScalar(speed));
            if (e.key === 'ArrowDown') offset.add(forward.multiplyScalar(-speed));
            if (e.key === 'ArrowLeft') offset.add(right.multiplyScalar(-speed));
            if (e.key === 'ArrowRight') offset.add(right.multiplyScalar(speed));

            if (offset.lengthSq() > 0) {
                const target = controlsRef.current.target;
                target.add(offset);
                camera.position.add(offset);
                
                // Clamp
                const limit = WORLD_SIZE / 2;
                target.x = MathUtils.clamp(target.x, -limit, limit);
                target.z = MathUtils.clamp(target.z, -limit, limit);
                target.y = Math.max(0, target.y); 
                camera.position.y = Math.max(2, camera.position.y);
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
  
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [selectedAgentData, setSelectedAgentData] = useState<AgentData | null>(null);

  const [resetTrigger, setResetTrigger] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('selfishness');
  
  const [fogDistance, setFogDistance] = useState(600); 
  const [showEnergyBars, setShowEnergyBars] = useState(false); // Default OFF
  const [showTrails, setShowTrails] = useState(true);
  const [enableFog, setEnableFog] = useState(true);
  const [showGrid, setShowGrid] = useState(false);

  const controlsRef = useRef<any>(null);

  const handleStatsUpdate = useCallback((count: number, avgSelfishness: number) => {
    setStats({ count, avgSelfishness });
  }, []);

  const handleAgentUpdate = useCallback((agentData: AgentData | null) => {
     setSelectedAgentData(agentData);
  }, []);

  const handleReset = () => {
    setResetTrigger(prev => prev + 1);
    setSelectedAgentId(null);
    setSelectedAgentData(null);
  };

  const handleResetCamera = () => {
      if (controlsRef.current) {
          const ctrl = controlsRef.current;
          ctrl.reset();
          ctrl.target.set(0, 0, 0);
          ctrl.object.position.set(0, 50, 40);
          ctrl.update();
      }
  };

  const commonProps = {
    params, setParams, paused, onStatsUpdate: handleStatsUpdate, onAgentUpdate: handleAgentUpdate,
    selectedAgentId, onSelectAgent: setSelectedAgentId, resetTrigger, viewMode,
    showEnergyBars, showTrails, showGrid
  };

  return (
    <div className="relative w-full h-full bg-black">
      <ControlPanel 
        params={params} setParams={setParams} populationCount={stats.count} avgSelfishness={stats.avgSelfishness}
        paused={paused} setPaused={setPaused} resetSimulation={handleReset} viewMode={viewMode} setViewMode={setViewMode}
        fogDistance={fogDistance} setFogDistance={setFogDistance} showEnergyBars={showEnergyBars} setShowEnergyBars={setShowEnergyBars}
        showTrails={showTrails} setShowTrails={setShowTrails} enableFog={enableFog} setEnableFog={setEnableFog}
        showGrid={showGrid} setShowGrid={setShowGrid} resetCamera={handleResetCamera} selectedAgent={selectedAgentData}
      />

      <div className="absolute inset-0 z-0">
        {/* Initial camera position closer: [0, 20, 25] instead of [0, 50, 40] */}
        <Canvas shadows camera={{ position: [0, 20, 25], fov: 45 }}>
          <color attach="background" args={['#050505']} />
          {enableFog && <fog attach="fog" args={['#101015', 10, fogDistance]} />}
          
          <DayNightCycle time={params.timeOfDay} />
          
          <SimulationErrorBoundary fallback={(err) => <Simulation key="procedural" {...commonProps} fallbackMode={true} />}>
            <Suspense fallback={null}>
                <Simulation key="model" {...commonProps} fallbackMode={false} />
            </Suspense>
          </SimulationErrorBoundary>

          <CameraFollower selectedAgentId={selectedAgentId} controlsRef={controlsRef} />
          <KeyboardControls controlsRef={controlsRef} />

          <OrbitControls 
            ref={controlsRef}
            makeDefault 
            maxPolarAngle={Math.PI / 2 - 0.05} 
            minDistance={2} 
            maxDistance={200}
            mouseButtons={{ LEFT: 0, RIGHT: 2, MIDDLE: 1 }}
          />
          <Stats className="!left-auto !right-0 !top-auto !bottom-0" />
        </Canvas>
      </div>

      <div className="absolute bottom-4 left-4 text-white/30 text-xs pointer-events-none select-none z-10">
        <p>Left Drag: Rotate • Right Drag: Pan • Arrow Keys: Pan • Scroll: Zoom</p>
      </div>
    </div>
  );
}