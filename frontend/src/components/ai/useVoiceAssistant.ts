import { useState, useCallback, useRef, useEffect } from 'react';

type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface UseVoiceAssistantOptions {
  onTranscript: (text: string) => void;
  onStatusChange?: (status: VoiceStatus) => void;
  continuous?: boolean;
  language?: string;
}

export function useVoiceAssistant(options: UseVoiceAssistantOptions) {
  const { 
    onTranscript, 
    onStatusChange,
    continuous = false,
    language = 'en-US'
  } = options;

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        setStatus('listening');
        onStatusChange?.('listening');
      };

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const result = event.results[current];
        const text = result[0].transcript;

        setTranscript(text);

        if (result.isFinal) {
          onTranscript(text);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setStatus('error');
        onStatusChange?.('error');
      };

      recognition.onend = () => {
        if (status === 'listening') {
          setStatus('idle');
          onStatusChange?.('idle');
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, [continuous, language, onTranscript, onStatusChange, status]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && status === 'idle') {
      setTranscript('');
      recognitionRef.current.start();
    }
  }, [status]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && status === 'listening') {
      recognitionRef.current.stop();
    }
  }, [status]);

  const toggleListening = useCallback(() => {
    if (status === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  }, [status, startListening, stopListening]);

  return {
    status,
    transcript,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  };
}

export function speak(text: string, options?: { rate?: number; pitch?: number; volume?: number }) {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  
  utterance.rate = options?.rate ?? 1;
  utterance.pitch = options?.pitch ?? 1;
  utterance.volume = options?.volume ?? 1;

  const voices = speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.lang.startsWith('en-')) || voices[0];
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  return new Promise<void>((resolve) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
}

export default useVoiceAssistant;
