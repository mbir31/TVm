/**
 * TVm Voice Recognition & Dictation Engine
 * Utilizes Web Speech API with audio visualizer analysis.
 * Supports direct TV text dictation and natural TV voice commands.
 */

export interface VoiceResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

export class VoiceEngine {
  private recognition: any = null;
  private isListening = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private animFrameId: number | null = null;

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public async startListening(
    onResult: (res: VoiceResult) => void,
    onStateChange: (state: VoiceState, errorMsg?: string) => void,
    onAudioLevel?: (level: number) => void
  ): Promise<boolean> {
    if (!this.isSupported()) {
      onStateChange('error', 'Speech recognition is not supported in this browser environment');
      return false;
    }

    try {
      // 1. Initialize microphone visualizer if supported
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            this.audioContext = new AudioContextClass();
            const source = this.audioContext.createMediaStreamSource(this.micStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 64;
            source.connect(this.analyser);

            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateAudioLevel = () => {
              if (!this.isListening || !this.analyser) return;
              this.analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
              }
              const avg = sum / bufferLength;
              const normalized = Math.min(1, avg / 128);
              if (onAudioLevel) onAudioLevel(normalized);
              this.animFrameId = requestAnimationFrame(updateAudioLevel);
            };
            updateAudioLevel();
          }
        } catch {
          // Audio visualizer optional
        }
      }

      // 2. Start SpeechRecognition
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        onStateChange('listening');
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const transcript = finalTranscript || interimTranscript;
        const isFinal = Boolean(finalTranscript);
        const confidence = event.results[0]?.[0]?.confidence || 0.9;

        onResult({ transcript, isFinal, confidence });
      };

      this.recognition.onerror = (event: any) => {
        console.warn('[VoiceEngine] Recognition error:', event.error);
        if (event.error !== 'no-speech') {
          onStateChange('error', `Speech error: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          onStateChange('idle');
          this.stop();
        }
      };

      this.recognition.start();
      return true;
    } catch (err) {
      onStateChange('error', `Failed to start voice: ${String(err)}`);
      return false;
    }
  }

  public stop(): void {
    this.isListening = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
      this.recognition = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {
        // Ignore
      }
      this.audioContext = null;
    }
  }
}

export const voiceEngine = new VoiceEngine();
