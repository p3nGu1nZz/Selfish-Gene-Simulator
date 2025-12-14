import React from 'react';
import { Html } from '@react-three/drei';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface ErrorScreenProps {
    error: any;
    onRetry: () => void;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ error, onRetry }) => {
    return (
        <Html center className="w-screen h-screen flex items-center justify-center bg-black/80 z-[100]">
            <div className="bg-gray-900 border border-red-500/50 p-8 rounded-xl max-w-md text-center shadow-2xl backdrop-blur-xl">
                <div className="flex justify-center mb-4">
                    <div className="p-4 bg-red-500/10 rounded-full animate-pulse">
                        <AlertTriangle size={48} className="text-red-500" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Simulation Error</h2>
                <p className="text-gray-300 mb-6 text-sm">
                    Vital simulation assets failed to initialize. The simulation cannot proceed without the base models.
                </p>
                <div className="bg-black/60 border border-white/5 p-4 rounded text-left mb-6 overflow-auto max-h-32">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Error Details</p>
                    <code className="text-xs text-red-300 font-mono break-all block">
                        {error?.message || "Unknown error occurred loading GLTF assets."}
                    </code>
                </div>
                <button 
                    onClick={onRetry}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-red-900/20 active:scale-95"
                >
                    <RefreshCcw size={18} />
                    Retry Connection
                </button>
            </div>
        </Html>
    );
};