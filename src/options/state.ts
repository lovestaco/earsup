import { useCallback, useEffect, useState } from 'react';
import { DEFAULTS, loadSettings, onSettingsChanged, saveSettings, type Settings } from '../shared/settings';

export function useSettings() {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => {
    void loadSettings().then(setS);
    return onSettingsChanged(setS);
  }, []);
  const set = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));
    void saveSettings({ [key]: value } as Partial<Settings>);
  }, []);
  return { s: s ?? DEFAULTS, ready: s !== null, set };
}

export function useLocal<T>(key: string, fallback: T) {
  const [v, setV] = useState<T>(fallback);
  useEffect(() => {
    void chrome.storage.local.get(key).then((r) => setV((r[key] as T) ?? fallback));
    const l = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && key in changes) setV((changes[key].newValue as T) ?? fallback);
    };
    chrome.storage.onChanged.addListener(l);
    return () => chrome.storage.onChanged.removeListener(l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const save = useCallback(
    (next: T) => {
      setV(next);
      void chrome.storage.local.set({ [key]: next });
    },
    [key],
  );
  return [v, save] as const;
}

export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => speechSynthesis.getVoices());
  useEffect(() => {
    const up = () => setVoices(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', up);
    up();
    return () => speechSynthesis.removeEventListener('voiceschanged', up);
  }, []);
  return voices;
}

export type Toast = (msg: string) => void;
