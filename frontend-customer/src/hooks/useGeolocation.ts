import { useEffect, useState } from 'react';

interface GeoState {
  latitude: number | null;
  longitude: number | null;
  status: 'idle' | 'loading' | 'ready' | 'denied' | 'unsupported';
}

// Bengaluru (Koramangala) fallback so the demo still works without a real GPS fix.
const FALLBACK = { latitude: 12.9352, longitude: 77.6146 };

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ latitude: null, longitude: null, status: 'idle' });

  const request = () => {
    if (!navigator.geolocation) {
      setState({ ...FALLBACK, status: 'unsupported' });
      return;
    }
    setState((s) => ({ ...s, status: 'loading' }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, status: 'ready' });
      },
      () => {
        setState({ ...FALLBACK, status: 'denied' });
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  useEffect(() => {
    request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, refresh: request };
}
