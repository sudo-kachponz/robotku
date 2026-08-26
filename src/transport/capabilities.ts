// src/transport/capabilities.ts
//
// Capabilities detector for Web Serial, Web Bluetooth, platform OS, and secure context.

export interface BrowserCapabilities {
  serial: boolean;
  ble: boolean;
  platform: 'ios' | 'android' | 'desktop';
  secureContext: boolean;
}

export function getCapabilities(): BrowserCapabilities {
  if (typeof window === 'undefined') {
    return { serial: false, ble: false, platform: 'desktop', secureContext: true };
  }

  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const platform = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

  const serial = 'serial' in navigator;
  const ble = 'bluetooth' in navigator;
  const secureContext = Boolean(window.isSecureContext);

  return { serial, ble, platform, secureContext };
}
