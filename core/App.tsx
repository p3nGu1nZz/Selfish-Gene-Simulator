import React, { useState, useCallback, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import { Simulation } from '../components/Simulation';
import { ControlPanel } from '../systems/ui/ControlPanel';
import { TitleScreen } from '../systems/ui/TitleScreen';
import { ErrorScreen } from '../systems/ui/ErrorScreen';
import { DEFAULT_PARAMS } from './constants';
import { SimulationParams, ViewMode, AgentData } from './types';
import { DayNightCycle } from '../systems/render/LightingSystem';
import { CameraFollower, KeyboardControls } from '../systems/camera/CameraControls';
import { SaveState } from './SaveLoad';

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

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState({ count: 0, avgSelfishness: 0 });
  
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [selectedAgentData, setSelectedAgentData] = useState<AgentData | null>(null);

  const [resetTrigger, setResetTrigger] = useState(0);
  const [loadedData, setLoadedData] = useState<SaveState | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('selfishness');
  
  const [fogDistance, setFogDistance] = useState(2000); 
  const [showEnergyBars, setShowEnergyBars] = useState(false); // Default OFF
  const [showTrails, setShowTrails] = useState(false); // Default OFF
  const [enableFog, setEnableFog] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showFPS, setShowFPS] = useState(false);

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
    setLoadedData(null); // Clear loaded data so reset acts as random start
  };

  const handleStart = (loadedParams?: SimulationParams, data?: SaveState) => {
      if (loadedParams && data) {
          setParams(loadedParams);
          setLoadedData(data);
          // Trigger a reset which will now use loadedData
          setResetTrigger(prev => prev + 1);
      }
      setGameStarted(true);
  };

  const handleResetCamera = () => {
      if (controlsRef.current) {
          const ctrl = controlsRef.current;
          ctrl.reset();
          ctrl.target.set(0, 0, 0);
          ctrl.object.position.set(0, 20, 25);
          ctrl.update();
      }
  };

  const handleLoadComplete = () => {
      setLoadedData(null);
  };

  const commonProps = {
    params, setParams, paused, onStatsUpdate: handleStatsUpdate, onAgentUpdate: handleAgentUpdate,
    selectedAgentId, onSelectAgent: setSelectedAgentId, resetTrigger, viewMode,
    showEnergyBars, showTrails, showGrid, loadedData, onLoadComplete: handleLoadComplete
  };

  if (!gameStarted) {
      return <TitleScreen onStart={handleStart} />;
  }

  return (
    <div className="relative w-full h-full bg-black">
      <ControlPanel 
        params={params} setParams={setParams} populationCount={stats.count} avgSelfishness={stats.avgSelfishness}
        paused={paused} setPaused={setPaused} resetSimulation={handleReset} viewMode={viewMode} setViewMode={setViewMode}
        fogDistance={fogDistance} setFogDistance={setFogDistance} showEnergyBars={showEnergyBars} setShowEnergyBars={setShowEnergyBars}
        showTrails={showTrails} setShowTrails={setShowTrails} enableFog={enableFog} setEnableFog={setEnableFog}
        showGrid={showGrid} setShowGrid={setShowGrid} resetCamera={handleResetCamera} selectedAgent={selectedAgentData}
        showFPS={showFPS} setShowFPS={setShowFPS}
      />

      <div className="absolute inset-0 z-0">
        <Canvas 
            shadows 
            camera={{ position: [0, 15, 25], fov: 45, far: 5000 }}
            gl={{ logarithmicDepthBuffer: true }}
        >
          <color attach="background" args={['#050505']} />
          {enableFog ? <fog attach="fog" args={['#101015', 10, fogDistance]} /> : null}
          
          <DayNightCycle time={params.timeOfDay} />
          
          <SimulationErrorBoundary fallback={(err) => (
            <ErrorScreen 
                error={err} 
                onRetry={() => window.location.reload()} 
            />
          )}>
            <Suspense fallback={null}>
                <Simulation key="model" {...commonProps} fallbackMode={false} />
            </Suspense>
          </SimulationErrorBoundary>

          <CameraFollower selectedAgentId={selectedAgentId} controlsRef={controlsRef} />
          <KeyboardControls controlsRef={controlsRef} />

          <OrbitControls 
            ref={controlsRef}
            makeDefault 
            enableDamping={true}
            enablePan={selectedAgentId === null}
            dampingFactor={0.1} 
            maxPolarAngle={Math.PI / 2 - 0.05} 
            minDistance={2} 
            maxDistance={300} 
            target={[0, 0, 0]}
          />
          {showFPS ? <Stats className="!left-auto !right-0 !top-auto !bottom-0" /> : null}
        </Canvas>
      </div>

      <div className="absolute bottom-4 left-4 text-white/30 text-xs pointer-events-none select-none z-10">
        <p>Left Click: Rotate • Right Click: Pan • Scroll: Zoom • Click Agent: Select</p>
      </div>
    </div>
  );
}