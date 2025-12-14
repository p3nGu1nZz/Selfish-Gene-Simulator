import React, { useState, useEffect } from 'react';
import { SimulationParams, ViewMode, AgentData } from '../../core/types';
import { REAL_SECONDS_PER_GAME_DAY, MATURITY_DAYS, MAX_LITTER_SIZE, MIN_LITTER_SIZE } from '../../core/constants';
import { inputManager, Action } from '../../core/InputManager';
import { saveSimulation } from '../../core/SaveLoad';
import { 
    RefreshCcw, Play, Pause, Settings, X, 
    Gamepad2, Video, Volume2, Accessibility, Sliders,
    Activity, Dna, Sun, Moon, CloudFog, Battery, Footprints, Grid, Search, Keyboard, Save
} from 'lucide-react';

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
  fogDistance: number;
  setFogDistance: (d: number) => void;
  showEnergyBars: boolean;
  setShowEnergyBars: (show: boolean) => void;
  showTrails: boolean;
  setShowTrails: (show: boolean) => void;
  enableFog: boolean;
  setEnableFog: (enabled: boolean) => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  resetCamera: () => void;
  selectedAgent: AgentData | null;
  showFPS: boolean;
  setShowFPS: (show: boolean) => void;
}

// Clock Component
const TimeDisplay: React.FC<{ time: number }> = ({ time }) => {
    // Time loops every 24 hours
    const dayTime = time % 24;
    const isNight = dayTime >= 20 || dayTime < 5;
    const hour = Math.floor(dayTime);
    const minute = Math.floor((dayTime - hour) * 60);
    const formattedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    // Day calculation: Start at Day 1, increment every 24h
    const dayCount = Math.floor(time / 24) + 1;

    return (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            {isNight ? <Moon size={16} className="text-blue-300" /> : <Sun size={16} className="text-yellow-400" />}
            <span className="text-xl font-mono font-bold text-white tracking-widest">{formattedTime}</span>
            <span className="text-xs font-bold text-gray-400 uppercase bg-white/10 px-1.5 py-0.5 rounded">Day {dayCount}</span>
        </div>
    );
};

// Selected Agent HUD
const AgentHUD: React.FC<{ agent: AgentData | null }> = ({ agent }) => {
    if (!agent) return null;

    const ageInDays = agent.age / REAL_SECONDS_PER_GAME_DAY;
    const isMature = ageInDays >= MATURITY_DAYS;
    const maxEnergy = 50 + (agent.genes.energy * 100);
    const potentialLitter = Math.round(MIN_LITTER_SIZE + (MAX_LITTER_SIZE - MIN_LITTER_SIZE) * agent.genes.fertility);
    
    return (
        <div className="absolute top-20 left-4 z-10 w-64 bg-black/60 backdrop-blur-md p-4 rounded-lg border border-white/10 space-y-3 shadow-xl">
             <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                 <Search size={16} className="text-blue-400" />
                 <h3 className="font-bold text-lg text-white">{agent.name.first} {agent.name.last}</h3>
             </div>
             
             <div className="grid grid-cols-2 gap-2 text-xs">
                 <div className="text-gray-400">State</div>
                 <div className="text-right text-white font-mono uppercase">{agent.state.replace('_', ' ')}</div>
                 
                 <div className="text-gray-400">Age</div>
                 <div className="text-right font-mono">
                     {/* Starts at 1 day old */}
                     <span className="text-white">{Math.floor(ageInDays) + 1} days</span>
                 </div>

                 <div className="text-gray-400">Breeding</div>
                 <div className="text-right font-mono">
                     {isMature 
                        ? <span className="text-green-400">Mature (~{potentialLitter} kits)</span> 
                        : <span className="text-red-400">Too Young</span>
                     }
                 </div>

                 <div className="text-gray-400">Energy</div>
                 <div className="text-right text-white font-mono flex justify-end items-center gap-1">
                     <span className={`${agent.energy < (maxEnergy*0.3) ? 'text-red-400' : 'text-green-400'}`}>
                        {agent.energy.toFixed(0)} / {maxEnergy.toFixed(0)}
                     </span>
                 </div>
             </div>

             <div className="space-y-1 pt-2 border-t border-white/10">
                 <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Genome</div>
                 <div className="flex justify-between text-xs">
                     <span className="text-gray-300">Selfishness</span>
                     <span style={{ color: `hsl(${360 * agent.genes.selfishness}, 70%, 60%)` }}>
                        {(agent.genes.selfishness * 100).toFixed(0)}%
                     </span>
                 </div>
                 <div className="flex justify-between text-xs">
                     <span className="text-gray-300">Size</span>
                     <span className="text-blue-300">{agent.genes.size.toFixed(2)}x</span>
                 </div>
                 <div className="flex justify-between text-xs">
                     <span className="text-gray-300">Speed</span>
                     <span className="text-yellow-300">{agent.genes.speed.toFixed(2)}x</span>
                 </div>
                 <div className="flex justify-between text-xs">
                     <span className="text-gray-300">Energy Cap</span>
                     <span className="text-yellow-500">{(agent.genes.energy * 100).toFixed(0)}%</span>
                 </div>
                 <div className="flex justify-between text-xs">
                     <span className="text-gray-300">Fertility</span>
                     <span className="text-pink-400">{(agent.genes.fertility * 100).toFixed(0)}%</span>
                 </div>
             </div>
        </div>
    );
};

// HUD Component
const GlobalHUD: React.FC<{ population: number, selfishness: number }> = ({ population, selfishness }) => {
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

type TabId = 'gameplay' | 'video' | 'controls';

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
  fogDistance,
  setFogDistance,
  showEnergyBars,
  setShowEnergyBars,
  showTrails,
  setShowTrails,
  enableFog,
  setEnableFog,
  showGrid,
  setShowGrid,
  resetCamera,
  selectedAgent,
  showFPS,
  setShowFPS
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('gameplay');
  const [rebinding, setRebinding] = useState<Action | null>(null);
  // Force update to refresh key binding list
  const [, setTick] = useState(0);

  const handleChange = (key: keyof SimulationParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const preventArrowKeys = (e: React.KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
      }
  };

  const handleSave = () => {
      saveSimulation(params);
  };

  // Sync Pause state with Menu Open state
  useEffect(() => {
      if (isOpen) setPaused(true);
      else setPaused(false);
  }, [isOpen, setPaused]);

  // Handle ESC key to toggle menu
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
              setIsOpen(prev => !prev);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
      if (!rebinding) return;

      const handleKeyDown = (e: KeyboardEvent) => {
          e.preventDefault();
          e.stopPropagation();
          inputManager.rebind(rebinding, e.key);
          setRebinding(null);
          setTick(t => t + 1);
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rebinding]);

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'gameplay', label: 'Gameplay', icon: <Sliders size={16} /> },
    { id: 'video', label: 'Video', icon: <Video size={16} /> },
    { id: 'controls', label: 'Inputs', icon: <Gamepad2 size={16} /> },
  ];

  return (
    <>
    <TimeDisplay time={params.timeOfDay} />
    <GlobalHUD population={populationCount} selfishness={avgSelfishness} />
    <AgentHUD agent={selectedAgent} />

    {/* Top Left Controls Container */}
    <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        {/* Settings Button */}
        {!isOpen && (
            <button
                onClick={() => setIsOpen(true)}
                className="p-2.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg text-white hover:bg-white/10 hover:text-blue-400 transition-colors shadow-xl"
                title="Open Settings"
            >
                <Settings size={20} />
            </button>
        )}

        {/* Play/Pause Button */}
        {!isOpen && (
            <button
                onClick={() => setPaused(!paused)}
                className="p-2.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg text-white hover:bg-white/10 hover:text-green-400 transition-colors shadow-xl"
                title={paused ? "Resume Simulation" : "Pause Simulation"}
            >
                {paused ? <Play size={20} className="fill-current" /> : <Pause size={20} className="fill-current" />}
            </button>
        )}
    </div>

    {/* Centered Modal */}
    {isOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-gray-900 border border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Rabbit Island Settings
                    </h1>
                    <div className="flex items-center gap-2">
                         <button
                            onClick={handleSave}
                            className="p-2 rounded-lg bg-white/10 hover:bg-blue-500/50 transition text-white"
                            title="Save Game"
                        >
                            <Save size={18} />
                        </button>
                        <button
                            onClick={resetSimulation}
                            className="p-2 rounded-lg bg-white/10 hover:bg-red-500/50 transition text-white"
                            title="Reset Simulation"
                        >
                            <RefreshCcw size={18} />
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition ml-2 text-white"
                            title="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10 bg-black/20 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                                activeTab === tab.id 
                                    ? 'border-blue-500 text-blue-400 bg-white/5' 
                                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {activeTab === 'gameplay' && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300 flex justify-between">
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
                                <label className="text-sm font-medium text-gray-300 flex justify-between">
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
                                <label className="text-sm font-medium text-gray-300 flex justify-between">
                                    <span>Simulation Speed</span>
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
                    )}

                    {activeTab === 'video' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Visualization Mode</h3>
                                <div className="grid grid-cols-2 gap-3">
                                {[
                                    { id: 'selfishness', label: 'Selfishness', color: 'bg-red-500' },
                                    { id: 'speed', label: 'Speed', color: 'bg-blue-500' },
                                    { id: 'size', label: 'Size', color: 'bg-purple-500' },
                                    { id: 'mutation', label: 'Mutation', color: 'bg-pink-500' },
                                    { id: 'energy', label: 'Energy Cap', color: 'bg-yellow-500' },
                                    { id: 'fertility', label: 'Fertility', color: 'bg-pink-400' },
                                    { id: 'affinity', label: 'Family (Hue)', color: 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500' },
                                ].map((mode) => (
                                    <button
                                    key={mode.id}
                                    onClick={() => setViewMode(mode.id as ViewMode)}
                                    className={`px-4 py-3 text-sm font-medium rounded-lg border transition-all ${
                                        viewMode === mode.id
                                        ? 'bg-white/10 border-white/40 text-white'
                                        : 'bg-transparent border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300'
                                    }`}
                                    >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${mode.color}`} />
                                        {mode.label}
                                    </div>
                                    </button>
                                ))}
                                </div>
                            </div>
                            
                            <div className="h-px bg-white/10 my-4" />
                            
                            <div className="grid grid-cols-1 gap-4">
                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                        <Activity size={16} /> Show FPS
                                    </label>
                                    <button 
                                        onClick={() => setShowFPS(!showFPS)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${showFPS ? 'bg-blue-500' : 'bg-gray-700'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${showFPS ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                        <Battery size={16} /> Show Energy Bars
                                    </label>
                                    <button 
                                        onClick={() => setShowEnergyBars(!showEnergyBars)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${showEnergyBars ? 'bg-blue-500' : 'bg-gray-700'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${showEnergyBars ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                        <Footprints size={16} /> Show Trails
                                    </label>
                                    <button 
                                        onClick={() => setShowTrails(!showTrails)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${showTrails ? 'bg-blue-500' : 'bg-gray-700'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${showTrails ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                        <Grid size={16} /> Show Ground Grid
                                    </label>
                                    <button 
                                        onClick={() => setShowGrid(!showGrid)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${showGrid ? 'bg-blue-500' : 'bg-gray-700'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${showGrid ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                        <CloudFog size={16} /> Enable Fog
                                    </label>
                                    <button 
                                        onClick={() => setEnableFog(!enableFog)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${enableFog ? 'bg-blue-500' : 'bg-gray-700'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${enableFog ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>
                            
                            {enableFog && (
                                <div className="space-y-2 p-3 bg-white/5 rounded-lg">
                                    <label className="text-sm font-medium text-gray-300 flex justify-between">
                                        <span className="flex items-center gap-2"><CloudFog size={16} /> Fog Distance</span>
                                        <span className="text-gray-400">{fogDistance}</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="30"
                                        max="5000"
                                        step="100"
                                        value={fogDistance}
                                        onKeyDown={preventArrowKeys}
                                        onChange={(e) => setFogDistance(parseFloat(e.target.value))}
                                        className="w-full accent-gray-400 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'controls' && (
                        <div className="space-y-6">
                            <div className="p-4 bg-white/5 rounded-lg">
                                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                    <Keyboard size={18} /> Key Bindings
                                </h3>
                                <div className="space-y-2">
                                    {Object.entries(inputManager.bindings).map(([action, key]) => (
                                        <div key={action} className="flex items-center justify-between p-2 hover:bg-white/5 rounded transition-colors">
                                            <span className="text-sm text-gray-300 capitalize">{action.replace('_', ' ').toLowerCase()}</span>
                                            <button 
                                                onClick={() => setRebinding(action as Action)}
                                                className={`px-3 py-1.5 rounded font-mono text-xs border transition-all min-w-[80px] text-center
                                                    ${rebinding === action 
                                                        ? 'bg-blue-500 text-white border-blue-400 animate-pulse' 
                                                        : 'bg-black/50 text-gray-400 border-white/20 hover:border-white/50 hover:text-white'
                                                    }`}
                                            >
                                                {rebinding === action ? 'Press Key...' : key === ' ' ? 'Space' : key}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => { inputManager.resetToDefaults(); setTick(t => t + 1); }}
                                    className="mt-4 text-xs text-blue-400 hover:text-blue-300 underline"
                                >
                                    Reset to Defaults
                                </button>
                            </div>

                            <div className="p-4 bg-white/5 rounded-lg">
                                <h3 className="font-bold text-white mb-2">Instructions</h3>
                                <ul className="space-y-2 text-sm text-gray-300">
                                    <li className="flex justify-between"><span>Pan Camera</span> <span className="font-mono bg-white/10 px-2 rounded">Left Click Drag</span></li>
                                    <li className="flex justify-between"><span>Rotate Camera</span> <span className="font-mono bg-white/10 px-2 rounded">Right Click Drag</span></li>
                                    <li className="flex justify-between"><span>Zoom</span> <span className="font-mono bg-white/10 px-2 rounded">Scroll Wheel</span></li>
                                </ul>
                            </div>
                            
                            <button 
                                onClick={resetCamera}
                                className="w-full py-3 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                            >
                                Reset Camera Position
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )}
    </>
  );
};