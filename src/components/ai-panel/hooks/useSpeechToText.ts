import { useState, useCallback, useEffect, useRef } from 'react';

interface SpeechToTextState {
    isListening: boolean;
    interimTranscript: string;
    finalTranscript: string;
    audioLevel: number; // 0-1 for waveform visualization
    error: string | null;
}

export function useSpeechToText() {
    const [state, setState] = useState<SpeechToTextState>({
        isListening: false,
        interimTranscript: '',
        finalTranscript: '',
        audioLevel: 0,
        error: null,
    });

    const recognitionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Cleanup audio resources
    const cleanupAudio = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        analyserRef.current = null;
    }, []);

    // Audio level analysis loop
    const startAudioAnalysis = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            source.connect(analyser);
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const updateLevel = () => {
                if (!analyserRef.current) return;

                analyserRef.current.getByteFrequencyData(dataArray);

                // Calculate average level
                const sum = dataArray.reduce((a, b) => a + b, 0);
                const average = sum / dataArray.length;
                const normalizedLevel = Math.min(1, average / 128);

                setState(prev => ({ ...prev, audioLevel: normalizedLevel }));
                animationFrameRef.current = requestAnimationFrame(updateLevel);
            };

            updateLevel();
        } catch (err) {
            console.error('Failed to start audio analysis:', err);
        }
    }, []);

    // Initialize speech recognition
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setState(prev => ({ ...prev, error: 'Speech recognition is not supported in this browser.' }));
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setState(prev => ({
                ...prev,
                isListening: true,
                error: null,
                interimTranscript: '',
                finalTranscript: ''
            }));
        };

        recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';

            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    final += result[0].transcript;
                } else {
                    interim += result[0].transcript;
                }
            }

            setState(prev => ({
                ...prev,
                interimTranscript: interim,
                finalTranscript: final || prev.finalTranscript
            }));
        };

        recognition.onerror = (event: any) => {
            setState(prev => ({ ...prev, error: event.error, isListening: false }));
            cleanupAudio();
        };

        recognition.onend = () => {
            setState(prev => ({ ...prev, isListening: false }));
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            cleanupAudio();
        };
    }, [cleanupAudio]);

    const startListening = useCallback(async () => {
        if (recognitionRef.current && !state.isListening) {
            setState(prev => ({
                ...prev,
                interimTranscript: '',
                finalTranscript: '',
                audioLevel: 0
            }));
            await startAudioAnalysis();
            recognitionRef.current.start();
        }
    }, [state.isListening, startAudioAnalysis]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && state.isListening) {
            recognitionRef.current.stop();
            cleanupAudio();
        }
    }, [state.isListening, cleanupAudio]);

    const cancelListening = useCallback(() => {
        stopListening();
        setState(prev => ({
            ...prev,
            interimTranscript: '',
            finalTranscript: '',
            audioLevel: 0
        }));
    }, [stopListening]);

    const confirmListening = useCallback((): string => {
        const transcript = (state.finalTranscript + ' ' + state.interimTranscript).trim();
        stopListening();
        setState(prev => ({
            ...prev,
            interimTranscript: '',
            finalTranscript: '',
            audioLevel: 0
        }));
        return transcript;
    }, [state.finalTranscript, state.interimTranscript, stopListening]);

    const toggleListening = useCallback(() => {
        if (state.isListening) {
            stopListening();
        } else {
            startListening();
        }
    }, [state.isListening, startListening, stopListening]);

    // Combined transcript for display
    const transcript = (state.finalTranscript + ' ' + state.interimTranscript).trim();

    return {
        isListening: state.isListening,
        transcript,
        interimTranscript: state.interimTranscript,
        finalTranscript: state.finalTranscript,
        audioLevel: state.audioLevel,
        error: state.error,
        startListening,
        stopListening,
        cancelListening,
        confirmListening,
        toggleListening,
    };
}
