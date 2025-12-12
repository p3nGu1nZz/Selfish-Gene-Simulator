import React from 'react';
import { SimulationParams, ViewMode, Agent } from '../types';
import { RefreshCcw, Play, Pause, Activity, Zap, Dna, Eye, Microscope, Scale, Gauge, CloudFog, X } from 'lucide-react';

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
  hoveredAgent: Agent | null;
  fogDistance: number;
  setFogDistance: (d: number) => void;
  selectedAgent: Agent | null;
  setSelectedAgent: (a: Agent | null) => void;
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
  setSelectedAgent
}) => {
  const handleChange = (key: keyof SimulationParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <>
    {/* Left Panel: Global Controls & Stats */}
    <div className="absolute top-4 left-4 z-10 w-80 bg-black/80 backdrop-blur-md border border-white/10 rounded-xl p-5 text-white shadow-2xl overflow-y-auto max-h-[90vh]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Gene Simulator
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
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white/5 p-3 rounded-lg border border-white/5">
          <div className="text-xs text-gray-400 flex items-center gap-1 mb-1">
            <Activity size={12} /> Population
          </div>
          <div className="text-2xl font-mono font-semibold">{populationCount}</div>
        </div>
        <div className="bg-white/5 p-3 rounded-lg border border-white/5">
          <div className="text-xs text-gray-400 flex items-center gap-1 mb-1">
            <Dna size={12} /> Avg Selfishness
          </div>
          <div 
            className="text-2xl font-mono font-semibold"
            style={{ color: `hsl(${360 * avgSelfishness}, 70%, 60%)` }} 
          >
            {(avgSelfishness * 100).toFixed(1)}%
          </div>
          <div className="w-full h-1 bg-gray-700 mt-2 rounded-full overflow-hidden">
            <div 
                className="h-full transition-all duration-500"
                style={{ 
                    width: `${avgSelfishness * 100}%`,
                    background: `linear-gradient(90deg, #4ade80 0%, #f87171 100%)` 
                }}
            />
          </div>
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
        <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300 flex justify-between">
                <span className="flex items-center gap-1"><CloudFog size={12} /> Fog Distance</span>
                <span className="text-gray-400">{fogDistance}</span>
            </label>
            <input
                type="range"
                min="30"
                max="300"
                step="10"
                value={fogDistance}
                onChange={(e) => setFogDistance(parseFloat(e.target.value))}
                className="w-full accent-gray-400 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
        </div>

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
            onChange={(e) => handleChange('mutationMagnitude', parseFloat(e.target.value))}
            className="w-full accent-purple-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
        </div>

        <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300 flex justify-between">
            <span>Energy Cost</span>
            <span className="text-orange-400">{params.energyCostPerTick}</span>
            </label>
            <input
            type="range"
            min="0.01"
            max="1.0"
            step="0.01"
            value={params.energyCostPerTick}
            onChange={(e) => handleChange('energyCostPerTick', parseFloat(e.target.value))}
            className="w-full accent-orange-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
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
            onChange={(e) => handleChange('simulationSpeed', parseFloat(e.target.value))}
            className="w-full accent-green-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
        </div>
      </div>
    </div>

    {/* Right Panel: Agent Inspector */}
    {hoveredAgent && (
        <div className="absolute top-4 right-4 z-10 w-64 bg-black/80 backdrop-blur-md border border-white/10 rounded-xl p-5 text-white shadow-2xl animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between gap-3 mb-4 border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-full">
                        <Microscope size={20} className="text-blue-400" />
                    </div>
                    <div>
                        <h2 className="font-bold text-sm">Agent #{hoveredAgent.id}</h2>
                        <p className="text-[10px] text-gray-400">{hoveredAgent.state}</p>
                    </div>
                </div>
                {selectedAgent?.id === hoveredAgent.id && (
                    <button 
                        onClick={() => setSelectedAgent(null)}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 border border-red-500/30 px-2 py-1 rounded-md bg-red-500/10"
                    >
                        <X size={12} /> Stop
                    </button>
                )}
            </div>

            <div className="space-y-1 mb-4">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Energy</span>
                    <span className={hoveredAgent.energy < 20 ? "text-red-400" : "text-green-400"}>{hoveredAgent.energy.toFixed(0)}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, hoveredAgent.energy)}%` }}></div>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Genetic Profile</h3>
                
                <StatBar 
                    label="Selfishness" 
                    value={hoveredAgent.genes.selfishness} 
                    max={1} 
                    color="#f87171" 
                    icon={<Dna size={10} />}
                />
                <StatBar 
                    label="Speed" 
                    value={hoveredAgent.genes.speed} 
                    max={3} 
                    color="#60a5fa" 
                    icon={<Gauge size={10} />}
                />
                <StatBar 
                    label="Size" 
                    value={hoveredAgent.genes.size} 
                    max={2} 
                    color="#c084fc" 
                    icon={<Scale size={10} />}
                />
                 <StatBar 
                    label="Mutation Rate" 
                    value={hoveredAgent.genes.mutationRate * 100} 
                    max={20} 
                    color="#f472b6" 
                    icon={<Zap size={10} />}
                />
            </div>
            
            {selectedAgent?.id !== hoveredAgent.id && (
                 <div className="mt-4 pt-3 border-t border-white/10 text-center">
                    <button 
                        onClick={() => setSelectedAgent(hoveredAgent)}
                        className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                        Follow this agent
                    </button>
                 </div>
            )}
        </div>
    )}
    </>
  );
};