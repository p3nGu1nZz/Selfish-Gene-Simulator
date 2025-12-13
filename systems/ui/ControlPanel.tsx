import React, { useState } from 'react';
import { SimulationParams, ViewMode, AgentData } from '../../core/types';
import { 
    RefreshCcw, Play, Pause, Settings, X, 
    Gamepad2, Video, Volume2, Accessibility, Sliders,
    Activity, Dna, Sun, Moon, CloudFog, Battery, Footprints, Grid, Search
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
}

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

// Selected Agent HUD
const AgentHUD: React.FC<{ agent: AgentData | null }> = ({ agent }) => {
    if (!agent) return null;

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
                 <div className="text-right text-white font-mono">{agent.age.toFixed(0)} ticks</div>

                 <div className="text-gray-400">Energy</div>
                 <div className="text-right text-white font-mono flex justify-end items-center gap-1">
                     <span className={`${agent.energy < 30 ? 'text-red-400' : 'text-green-400'}`}>{agent.energy.toFixed(0)}%</span>
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

type TabId = 'gameplay' | 'video' | 'audio' | 'controls' | 'accessibility';

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
  selectedAgent
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('gameplay');

  const handleChange = (key: keyof SimulationParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const preventArrowKeys = (e: React.KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
      }
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'gameplay', label: 'Gameplay', icon: <Sliders size={16} /> },
    { id: 'video', label: 'Video', icon: <Video size={16} /> },
    { id: 'audio', label: 'Audio', icon: <Volume2 size={16} /> },
    { id: 'controls', label: 'Controls', icon: <Gamepad2 size={16} /> },
    { id: 'accessibility', label: 'Accessibility', icon: <Accessibility size={16} /> },
  ];

  return (
    <>
    <TimeDisplay time={params.timeOfDay} />
    <GlobalHUD population={populationCount} selfishness={avgSelfishness} />
    <AgentHUD agent={selectedAgent} />

    {/* Gear Icon to Open */}
    {!isOpen && (
        <button
            onClick={() => setIsOpen(true)}
            className="absolute top-4 left-4 z-20 p-2.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg text-white hover:bg-white/10 hover:text-blue-400 transition-colors shadow-xl"
            title="Open Settings"
        >
            <Settings size={20} />
        </button>
    )}

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
                            onClick={() => setPaused(!paused)}
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-white"
                            title={paused ? "Resume" : "Pause"}
                        >
                            {paused ? <Play size={18} /> : <Pause size={18} />}
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
                                        max="600"
                                        step="10"
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
                        <div className="space-y-4">
                            <div className="p-4 bg-white/5 rounded-lg">
                                <h3 className="font-bold text-white mb-2">Camera Controls</h3>
                                <ul className="space-y-2 text-sm text-gray-300">
                                    <li className="flex justify-between"><span>Rotate</span> <span className="font-mono bg-white/10 px-2 rounded">Left Click Drag</span></li>
                                    <li className="flex justify-between"><span>Pan</span> <span className="font-mono bg-white/10 px-2 rounded">Right Click Drag / Arrows</span></li>
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

                    {activeTab === 'audio' && (
                        <div className="flex items-center justify-center h-40 text-gray-500">
                            No audio settings available
                        </div>
                    )}

                    {activeTab === 'accessibility' && (
                        <div className="flex items-center justify-center h-40 text-gray-500">
                            No accessibility settings available
                        </div>
                    )}
                </div>
            </div>
        </div>
    )}
    </>
  );
};