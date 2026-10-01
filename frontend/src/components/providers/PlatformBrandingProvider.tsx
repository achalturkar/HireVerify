'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getPlatformBranding } from '@/src/lib/api/platform-branding';

export const DEFAULT_PLATFORM_COLOR = '#0D9488';

interface PlatformBrandingContextValue {
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
}

const PlatformBrandingContext = createContext<PlatformBrandingContextValue>({
  primaryColor: DEFAULT_PLATFORM_COLOR,
  setPrimaryColor: () => undefined,
});

function getForegroundColor(hex: string) {
  const channels = hex.match(/[0-9a-f]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) return '#FFFFFF';
  const luminance = channels
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.42 ? '#0B0F26' : '#FFFFFF';
}

export function PlatformBrandingProvider({ children }: { children: React.ReactNode }) {
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PLATFORM_COLOR);

  useEffect(() => {
    let cancelled = false;
    getPlatformBranding()
      .then((branding) => {
        if (!cancelled && /^#[0-9A-F]{6}$/i.test(branding.primaryColor)) setPrimaryColor(branding.primaryColor);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--public-primary', primaryColor);
    root.style.setProperty('--public-primary-foreground', getForegroundColor(primaryColor));
  }, [primaryColor]);

  return (
    <PlatformBrandingContext.Provider value={{ primaryColor, setPrimaryColor }}>
      {children}
    </PlatformBrandingContext.Provider>
  );
}

export function usePlatformBranding() {
  return useContext(PlatformBrandingContext);
}