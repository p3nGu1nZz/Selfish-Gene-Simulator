import React, { useMemo, useRef } from 'react';
import { Play, Save } from 'lucide-react';
import { loadSimulation, SaveState } from '../../core/SaveLoad';

interface Props {
    onStart: (params?: any, data?: SaveState) => void;
}

const BackgroundRabbit = () => {
    // Generate random properties once per rabbit instance
    const params = useMemo(() => {
        const isMovingRight = Math.random() > 0.5;
        const duration = 10 + Math.random() * 20; // 10s to 30s to cross screen
        const delay = Math.random() * -30; // Negative delay so they start scattered across the screen
        const top = Math.random() * 90; // Vertical position (0-90%)
        const size = 1.5 + Math.random() * 3.5; // Size in rem (1.5rem to 5rem)
        const bounceSpeed = 0.6 + Math.random() * 0.6; // Bounce duration
        const opacity = 0.1 + Math.random() * 0.2; // 0.1 to 0.3 opacity

        return { isMovingRight, duration, delay, top, size, bounceSpeed, opacity };
    }, []);

    return (
        <div 
            className="absolute pointer-events-none"
            style={{
                top: `${params.top}%`,
                fontSize: `${params.size}rem`,
                opacity: params.opacity,
                // Use custom keyframes defined in TitleScreen
                animation: `${params.isMovingRight ? 'moveRight' : 'moveLeft'} ${params.duration}s linear infinite`,
                animationDelay: `${params.delay}s`,
            }}
        >
            {/* Flip wrapper: Emojis usually face left. If moving right, flip it. */}
            <div style={{ transform: params.isMovingRight ? 'scaleX(-1)' : 'none' }}>
                {/* Bounce wrapper */}
                <div className="animate-bounce" style={{ animationDuration: `${params.bounceSpeed}s` }}>
                    🐇
                </div>
            </div>
        </div>
    );
};

export const TitleScreen: React.FC<Props> = ({ onStart }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleLoadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = event.target?.result as string;
                const saveData = loadSimulation(json);
                onStart(saveData.params, saveData);
            } catch (err) {
                alert("Failed to load save file.");
                console.error(err);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="absolute inset-0 z-50 bg-gradient-to-b from-[#0f172a] to-[#050505] overflow-hidden font-sans text-white select-none">
            
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".json"
            />

            {/* CSS Keyframes for movement */}
            <style>{`
                @keyframes moveRight {
                    from { left: -15%; }
                    to { left: 115%; }
                }
                @keyframes moveLeft {
                    from { left: 115%; }
                    to { left: -15%; }
                }
            `}</style>

            {/* Background Bouncing Rabbits */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(25)].map((_, i) => (
                    <BackgroundRabbit key={i} />
                ))}
            </div>

            {/* Main Content Flex Wrapper */}
            <div className="relative z-10 flex flex-col items-center justify-between h-full w-full py-12">
                
                {/* Spacer to push content towards center vertically */}
                <div className="flex-none h-16" />

                {/* Center Group: Title and Buttons */}
                <div className="flex flex-col items-center gap-12">
                    
                    {/* Logo / Title */}
                    <div className="text-center space-y-2 animate-pulse">
                        <h1 className="text-7xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 drop-shadow-lg">
                            RABBIT ISLAND
                        </h1>
                        <p className="text-blue-200/60 tracking-widest text-sm font-mono uppercase">
                            Evolutionary Simulation
                        </p>
                    </div>

                    {/* Interactive Area */}
                    <div className="flex flex-col gap-4 w-64">
                        <button 
                            onClick={() => onStart()}
                            className="group relative px-8 py-4 bg-white text-black font-bold rounded-full hover:scale-105 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center gap-3 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-300 to-purple-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Play className="relative z-10 fill-black" size={20} />
                            <span className="relative z-10">START GAME</span>
                        </button>

                        <button 
                            onClick={handleLoadClick}
                            className="px-8 py-4 bg-white/5 text-gray-200 font-bold rounded-full border border-white/10 flex items-center justify-center gap-3 hover:bg-white/10 transition-colors hover:scale-105 active:scale-95"
                        >
                            <Save size={20} />
                            <span>LOAD GAME</span>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col items-center gap-1 text-white/40 text-xs font-mono mt-4">
                    <p className="text-white/70 font-bold mb-1 text-sm">Created by p3nGu1nZz</p>
                    <div className="flex items-center gap-2">
                        <span>🐱</span>
                        <span className="font-bold tracking-wider">CAT GAME RESEARCH</span>
                    </div>
                    <a href="https://catgameresearch.net" className="hover:text-blue-300 transition-colors">catgameresearch.net</a>
                    <span className="opacity-50 mt-1">© 2026 All Rights Reserved</span>
                </div>
            </div>
        </div>
    );
};