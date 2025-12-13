import React, { useEffect, useState } from 'react';
import { SimulationParams, ViewMode, Entity } from '../systems/types';
import { RefreshCcw, Play, Pause, Activity, Zap, Dna, Eye, Microscope, Scale, Gauge, CloudFog, X, Move, Clock, Target, Battery, Video, Search, Settings, Footprints, Sun, Moon } from 'lucide-react';

interface ControlPanelProps {
  params: SimulationParams;
  setParams: React.Dispatch<React.SetStateAction<SimulationParams>>;
  populationCount: number;
  avgSelfishness: number;
  paused: boolean;
  setPaused: (p: boolean) => void;
  resetSimulation: () => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  hoveredAgent: Entity | null;
  fogDistance: number;
  setFogDistance: (d: number) => void;
  selectedAgent: Entity | null;
  setSelectedAgent: (a: Entity | null) => void;
  showEnergyBars: boolean;
  setShowEnergyBars: (show: boolean) => void;
  showTrails: boolean;
  setShowTrails: (show: boolean) => void;
  enableFog: boolean;
  setEnableFog: (enabled: boolean) => void;
  followZoom: number;
  setFollowZoom: (z: number) => void;
  resetCamera: () => void;
}

const StatBar: React.FC<{ label: string; value: number; max: number; color: string; icon?: React.ReactNode }> = ({ label, value, max, color, icon }) => (
  <div className="mb-2">
    <div className="flex justify-between text-[10px] uppercase tracking-wider text-gray-400 mb-1">
      <span className="flex items-center gap-1">{icon} {label}</span>
      <span>{value.toFixed(2)}</span>
    </div>
    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
      <div 
        className="h-full transition-all duration-300"
        style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

// Inner component that refreshes independently to show live stats
const LiveInspector: React.FC<{ agent: Entity, selectedAgentId: number | undefined, setSelectedAgent: (a: Entity | null) => void }> = ({ agent, selectedAgentId, setSelectedAgent }) => {
    const [, setTick] = useState(0);

    useEffect(() => {
        let frameId: number;
        const loop = () => {
            setTick(t => t + 1);
            frameId = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(frameId);
    }, []);

    // Safety check if agent died/removed
    if (!agent.agent) return null;

    const data = agent.agent;

    return (
        <div className="absolute top-4 right-4 z-30 w-72 bg-black/80 backdrop-blur-md border border-white/10 rounded-xl p-5 text-white shadow-2xl animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-start justify-between gap-3 mb-4 border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-full mt-1">
                        <Microscope size={20} className="text-blue-400" />
                    </div>
                    <div>
                        <h2 className="font-bold text-sm text-white leading-tight">
                            {data.name.first} {data.name.last}
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500 font-mono">#{agent.id}</span>
                            <span className="text-[10px] text-gray-400 capitalize bg-white/5 px-1.5 py-0.5 rounded-sm">{data.state.replace('_', ' ')}</span>
                        </div>
                    </div>
                </div>
                {selectedAgentId === agent.id && (
                    <button 
                        onClick={() => setSelectedAgent(null)}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 border border-red-500/30 px-2 py-1 rounded-md bg-red-500/10"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>

            <div className="space-y-1 mb-4">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Energy</span>
                    <span className={data.energy < 20 ? "text-red-400" : "text-green-400"}>{data.energy.toFixed(0)}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, data.energy)}%` }}></div>
                </div>
            </div>

             {/* Live Stats */}
             <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">
                        <Clock size={10} /> Age
                    </div>
                    <div className="text-sm font-mono">{data.age.toFixed(0)} <span className="text-[10px] text-gray-500">ticks</span></div>
                </div>
                 <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">
                        <Move size={10} /> Velocity
                    </div>
                    <div className="text-sm font-mono">{agent.velocity?.length().toFixed(2)}</div>
                </div>
                 <div className="col-span-2 bg-white/5 p-2 rounded-lg border border-white/5">
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">
                        <Target size={10} /> Target
                    </div>
                    <div className="text-xs font-mono text-gray-300 truncate">
                        {data.target 
                            ? `[${data.target.x.toFixed(1)}, ${data.target.z.toFixed(1)}]` 
                            : 'None'
                        }
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Genetic Profile</h3>
                
                <StatBar 
                    label="Selfishness" 
                    value={data.genes.selfishness} 
                    max={1} 
                    color="#f87171" 
                    icon={<Dna size={10} />}
                />
                <StatBar 
                    label="Speed" 
                    value={data.genes.speed} 
                    max={3} 
                    color="#60a5fa" 
                    icon={<Gauge size={10} />}
                />
                <StatBar 
                    label="Size" 
                    value={data.genes.size} 
                    max={2} 
                    color="#c084fc" 
                    icon={<Scale size={10} />}
                />
                 <StatBar 
                    label="Mutation Rate" 
                    value={data.genes.mutationRate * 100} 
                    max={20} 
                    color="#f472b6" 
                    icon={<Zap size={10} />}
                />
            </div>
            
            {selectedAgentId !== agent.id && (
                 <div className="mt-4 pt-3 border-t border-white/10 text-center">
                    <button 
                        onClick={() => setSelectedAgent(agent)}
                        className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                        Follow this agent
                    </button>
                 </div>
            )}
        </div>
    );
};

// Clock Component
const TimeDisplay: React.FC<{ time: number }> = ({ time }) => {
    const isNight = time >= 20 || time < 5;
    const hour = Math.floor(time);
    const minute = Math.floor((time - hour) * 60);
    const formattedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    return (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            {isNight ? <Moon size={16} className="text-blue-300" /> : <Sun size={16} className="text-yellow-400" />}
            <span className="text-xl font-mono font-bold text-white tracking-widest">{formattedTime}</span>
            <span className="text-xs font-bold text-gray-400 uppercase bg-white/10 px-1.5 py-0.5 rounded">Day {(time / 24).toFixed(0)}</span>
        </div>
    );
};

// HUD Component
const HUD: React.FC<{ population: number, selfishness: number }> = ({ population, selfishness }) => {
    return (
        <div className="absolute top-20 right-4 z-10 flex flex-col items-end gap-2">
             <div className="bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 w-48">
                <div className="text-[10px] text-gray-400 flex items-center gap-1 mb-1 uppercase tracking-wider">
                    <Activity size={10} /> Population
                </div>
                <div className="text-xl font-mono font-semibold text-white">{population}</div>
            </div>
            <div className="bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 w-48">
                <div className="text-[10px] text-gray-400 flex items-center gap-1 mb-1 uppercase tracking-wider">
                    <Dna size={10} /> Avg Selfishness
                </div>
                <div 
                    className="text-xl font-mono font-semibold"
                    style={{ color: `hsl(${360 * selfishness}, 70%, 60%)` }} 
                >
                    {(selfishness * 100).toFixed(1)}%
                </div>
                <div className="w-full h-1 bg-gray-700 mt-2 rounded-full overflow-hidden">
                    <div 
                        className="h-full transition-all duration-500"
                        style={{ 
                            width: `${selfishness * 100}%`,
                            background: `linear-gradient(90deg, #4ade80 0%, #f87171 100%)` 
                        }}
                    />
                </div>
            </div>
        </div>
    );
};


export const ControlPanel: React.FC<ControlPanelProps> = ({
  params,
  setParams,
  populationCount,
  avgSelfishness,
  paused,
  setPaused,
  resetSimulation,
  viewMode,
  setViewMode,
  hoveredAgent,
  fogDistance,
  setFogDistance,
  selectedAgent,
  setSelectedAgent,
  showEnergyBars,
  setShowEnergyBars,
  showTrails,
  setShowTrails,
  enableFog,
  setEnableFog,
  followZoom,
  setFollowZoom,
  resetCamera
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleChange = (key: keyof SimulationParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const preventArrowKeys = (e: React.KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
      }
  };

  return (
    <>
    <TimeDisplay time={params.timeOfDay} />
    <HUD population={populationCount} selfishness={avgSelfishness} />

    {/* Floating Gear Icon to Open */}
    {!isOpen && (
        <button
            onClick={() => setIsOpen(true)}
            className="absolute top-4 left-4 z-20 p-2.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg text-white hover:bg-white/10 hover:text-blue-400 transition-colors shadow-xl"
            title="Open Settings"
        >
            <Settings size={20} />
        </button>
    )}

    {/* Main Control Box */}
    {isOpen && (
    <div className="absolute top-4 left-4 z-10 w-80 bg-black/80 backdrop-blur-md border border-white/10 rounded-xl p-5 text-white shadow-2xl overflow-y-auto max-h-[85vh]">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Rabbit Island
                </h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPaused(!paused)}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
                        title={paused ? "Play" : "Pause"}
                    >
                        {paused ? <Play size={16} /> : <Pause size={16} />}
                    </button>
                    <button
                        onClick={resetSimulation}
                        className="p-2 rounded-lg bg-white/10 hover:bg-red-500/50 transition"
                        title="Reset"
                    >
                        <RefreshCcw size={16} />
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition ml-1"
                        title="Close Settings"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* View Mode */}
            <div className="mb-6">
                <label className="text-xs font-medium text-gray-300 flex items-center gap-2 mb-3">
                <Eye size={14} /> Visualization Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                {[
                    { id: 'selfishness', label: 'Selfishness', color: 'bg-red-500' },
                    { id: 'speed', label: 'Speed', color: 'bg-blue-500' },
                    { id: 'size', label: 'Size', color: 'bg-purple-500' },
                    { id: 'mutation', label: 'Mutation', color: 'bg-pink-500' },
                ].map((mode) => (
                    <button
                    key={mode.id}
                    onClick={() => setViewMode(mode.id as ViewMode)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                        viewMode === mode.id
                        ? 'bg-white/10 border-white/40 text-white'
                        : 'bg-transparent border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300'
                    }`}
                    >
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${mode.color}`} />
                        {mode.label}
                    </div>
                    </button>
                ))}
                </div>
            </div>

            {/* Controls */}
            <div className="space-y-5">
                
                {/* Camera Controls Group */}
                <div className="bg-white/5 p-3 rounded-lg border border-white/5 space-y-3">
                    <label className="text-xs font-medium text-gray-300 flex items-center gap-2">
                        <Video size={14} /> Camera Controls
                    </label>
                    
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-400 flex justify-between">
                            <span className="flex items-center gap-1"><Search size={10} /> Follow Zoom</span>
                            <span>{followZoom}</span>
                        </label>
                        <input
                            type="range"
                            min="5"
                            max="60"
                            step="1"
                            value={followZoom}
                            onKeyDown={preventArrowKeys}
                            onChange={(e) => setFollowZoom(parseFloat(e.target.value))}
                            className="w-full accent-blue-400 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    <button 
                        onClick={resetCamera}
                        className="w-full py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-md text-gray-300 transition-colors"
                    >
                        Reset Camera Position
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-300 flex items-center gap-2">
                            <Battery size={14} /> Show Energy Bars
                        </label>
                        <button 
                            onClick={() => setShowEnergyBars(!showEnergyBars)}
                            className={`w-10 h-5 rounded-full transition-colors relative ${showEnergyBars ? 'bg-blue-500' : 'bg-gray-700'}`}
                        >
                            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${showEnergyBars ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-300 flex items-center gap-2">
                            <Footprints size={14} /> Show Trails
                        </label>
                        <button 
                            onClick={() => setShowTrails(!showTrails)}
                            className={`w-10 h-5 rounded-full transition-colors relative ${showTrails ? 'bg-blue-500' : 'bg-gray-700'}`}
                        >
                            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${showTrails ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                     <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-300 flex items-center gap-2">
                            <CloudFog size={14} /> Enable Fog
                        </label>
                        <button 
                            onClick={() => setEnableFog(!enableFog)}
                            className={`w-10 h-5 rounded-full transition-colors relative ${enableFog ? 'bg-blue-500' : 'bg-gray-700'}`}
                        >
                            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${enableFog ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>

                {enableFog && (
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-300 flex justify-between">
                            <span className="flex items-center gap-1"><CloudFog size={12} /> Fog Distance</span>
                            <span className="text-gray-400">{fogDistance}</span>
                        </label>
                        <input
                            type="range"
                            min="30"
                            max="600"
                            step="10"
                            value={fogDistance}
                            onKeyDown={preventArrowKeys}
                            onChange={(e) => setFogDistance(parseFloat(e.target.value))}
                            className="w-full accent-gray-400 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                )}

                <div className="h-px bg-white/10 my-4" />

                <div className="space-y-2">
                <label className="text-xs font-medium text-gray-300 flex justify-between">
                    <span>Food Spawn Rate</span>
                    <span className="text-blue-400">{params.foodSpawnRate}</span>
                </label>
                <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.5"
                    value={params.foodSpawnRate}
                    onKeyDown={preventArrowKeys}
                    onChange={(e) => handleChange('foodSpawnRate', parseFloat(e.target.value))}
                    className="w-full accent-blue-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-300 flex justify-between">
                    <span>Mutation Magnitude</span>
                    <span className="text-purple-400">{params.mutationMagnitude}</span>
                    </label>
                    <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.01"
                    value={params.mutationMagnitude}
                    onKeyDown={preventArrowKeys}
                    onChange={(e) => handleChange('mutationMagnitude', parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-300 flex justify-between">
                    <span>Sim Speed</span>
                    <span className="text-green-400">{params.simulationSpeed}x</span>
                    </label>
                    <input
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.1"
                    value={params.simulationSpeed}
                    onKeyDown={preventArrowKeys}
                    onChange={(e) => handleChange('simulationSpeed', parseFloat(e.target.value))}
                    className="w-full accent-green-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            </div>
    </div>
    )}

    {/* Right Panel: Agent Inspector */}
    {hoveredAgent && (
        <LiveInspector 
            agent={hoveredAgent} 
            selectedAgentId={selectedAgent?.id} 
            setSelectedAgent={setSelectedAgent} 
        />
    )}
    </>
  );
};