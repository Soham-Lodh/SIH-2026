import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';
import { apiUrl } from '../../lib/api';
import { translate } from '../../types/language';

function mimeToExt(mime: string): string {
  const base = mime.split(';')[0].trim().toLowerCase();
  const map: Record<string, string> = {
    'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
    'audio/flac': 'flac', 'audio/m4a': 'm4a',
  };
  return map[base] || 'webm';
}

interface AudioRecorderButtonProps {
  onTranscribed: (text: string) => void;
  language?: string;
  targetLanguage?: string;
  className?: string;
  buttonText?: string;
  tooltip?: string;
}

export const AudioRecorderButton: React.FC<AudioRecorderButtonProps> = ({
  onTranscribed,
  language = 'en',
  targetLanguage,
  className = '',
  buttonText,
  tooltip,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const startRecording = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      // Determine supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/wav';

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size < 100) {
          setIsTranscribing(false);
          return;
        }

        await handleTranscribe(audioBlob, mimeType);
      };

      recorder.start(250); // Collect slice every 250ms
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      setErrorMessage(translate(language, 'voice.microphoneDenied'));
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      setIsTranscribing(true);
      setIsRecording(false);
      mediaRecorderRef.current.stop();
    }
  };

  const handleTranscribe = async (blob: Blob, mimeType: string) => {
    try {
      const formData = new FormData();
      formData.append('file', blob, `audio.${mimeToExt(mimeType)}`);
      formData.append('mimeType', mimeType);
      formData.append('targetLanguage', targetLanguage || language);
      const res = await fetch(apiUrl('/api/transcribe'), {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data.text) {
        onTranscribed(data.text);
      } else {
        setErrorMessage(translate(language, 'voice.noSpeech'));
      }
    } catch (err) {
      console.error('Transcription API error:', err);
      setErrorMessage(translate(language, 'voice.transcriptionError'));
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      {isRecording ? (
        <button
          type="button"
          onClick={stopRecording}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-200 animate-pulse transition-all ${className}`}
          title={translate(language, 'voice.stop', { seconds: recordingDuration })}
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>{translate(language, 'voice.stop', { seconds: recordingDuration })}</span>
        </button>
      ) : isTranscribing ? (
        <button
          type="button"
          disabled
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold text-xs transition-all ${className}`}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{translate(language, 'voice.transcribing')}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          className={`flex items-center justify-center p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-200 transition-all ${className}`}
          title={tooltip || translate(language, 'voice.record')}
        >
          <Mic className="w-4 h-4" />
          {buttonText && <span className="ml-1 text-xs font-semibold">{buttonText}</span>}
        </button>
      )}

      {errorMessage && (
        <div className="absolute top-full left-0 mt-1.5 z-30 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-medium whitespace-nowrap shadow-sm">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="ml-1 text-rose-500 hover:text-rose-800 font-bold"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};
