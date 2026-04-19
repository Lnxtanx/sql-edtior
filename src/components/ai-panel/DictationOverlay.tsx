/**
 * Dictation Overlay Component
 * 
 * Shows a dark pill-shaped recording UI with animated waveform,
 * cancel and confirm buttons for voice input.
 * Waveform shows ChatGPT-style heartbeat animation with audio history.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Plus } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

interface DictationOverlayProps {
    isRecording: boolean;
    audioLevel: number; // 0-1
    onCancel: () => void;
    onConfirm: () => void;
    onAddContext?: () => void;
}

// Generate heartbeat-style waveform with audio history for trailing effect
function useWaveformBars(audioLevel: number, barCount: number = 80): number[] {
    const [bars, setBars] = useState<number[]>(() => Array(barCount).fill(0.1));
    const historyRef = useRef<number[]>(Array(barCount).fill(0.1));
    const animationFrameRef = useRef<number>();
    const lastUpdateRef = useRef<number>(0);

    useEffect(() => {
        const updateBars = (timestamp: number) => {
            // Update at ~20fps for smooth animation
            if (timestamp - lastUpdateRef.current >= 50) {
                lastUpdateRef.current = timestamp;

                const history = historyRef.current;

                // Shift history left
                for (let i = 0; i < history.length - 1; i++) {
                    history[i] = history[i + 1];
                }

                // Add current audio level at end with amplification and variation
                // If audioLevel is 0 or very low, show animated idle state
                let newLevel: number;
                if (audioLevel < 0.05) {
                    // Idle animation - gentle wave
                    const time = timestamp / 1000;
                    newLevel = 0.15 + Math.sin(time * 2) * 0.1 + Math.random() * 0.05;
                } else {
                    // Active speech - amplify and add variation
                    newLevel = Math.min(1, audioLevel * 2 + Math.random() * 0.3);
                }
                history[history.length - 1] = newLevel;

                // Apply smoothing and create bar heights
                const newBars: number[] = [];
                for (let i = 0; i < barCount; i++) {
                    const level = history[i];
                    // Smooth with neighbors
                    const prev = i > 0 ? history[i - 1] : level;
                    const next = i < barCount - 1 ? history[i + 1] : level;
                    const smoothed = prev * 0.25 + level * 0.5 + next * 0.25;
                    newBars.push(Math.max(0.1, smoothed));
                }

                setBars(newBars);
            }

            animationFrameRef.current = requestAnimationFrame(updateBars);
        };

        animationFrameRef.current = requestAnimationFrame(updateBars);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [audioLevel, barCount]);

    return bars;
}

export function DictationOverlay({
    isRecording,
    audioLevel,
    onCancel,
    onConfirm,
    onAddContext
}: DictationOverlayProps) {
    const waveformBars = useWaveformBars(audioLevel, 80);

    return (
        <AnimatePresence>
            {isRecording && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="absolute inset-x-3 bottom-3 z-50"
                >
                    {/* Always dark theme for this overlay */}
                    <div className="bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl overflow-hidden">
                        {/* Waveform Area */}
                        <div className="flex items-center gap-2 px-3 py-3">
                            {/* Add Context Button */}
                            <button
                                onClick={onAddContext}
                                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors shrink-0"
                            >
                                <Plus className="w-4 h-4 text-zinc-400" />
                            </button>

                            {/* Waveform - Heartbeat style with history */}
                            <div className="flex-1 flex items-end justify-center gap-[1px] h-12 min-w-0 overflow-hidden">
                                {waveformBars.map((height, i) => (
                                    <div
                                        key={i}
                                        className="w-[2px] rounded-full bg-zinc-300 shrink-0"
                                        style={{
                                            height: `${Math.max(4, height * 44)}px`,
                                            opacity: Math.max(0.4, height * 0.6 + 0.4)
                                        }}
                                    />
                                ))}
                            </div>

                            {/* Cancel Button */}
                            <button
                                onClick={onCancel}
                                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-red-900/50 flex items-center justify-center transition-colors shrink-0 group"
                                title="Cancel"
                            >
                                <X className="w-4 h-4 text-zinc-400 group-hover:text-red-400 transition-colors" />
                            </button>

                            {/* Confirm Button */}
                            <button
                                onClick={onConfirm}
                                className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center transition-colors shrink-0"
                                title="Done"
                            >
                                <Check className="w-4 h-4 text-white" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
