export async function generateDeviceSignature() {
  const components = [
    navigator.userAgent || '',
    `${window.screen.width}x${window.screen.height}`,
    `${window.screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    navigator.language || '',
    navigator.hardwareConcurrency || '',
    navigator.platform || '',
  ];

  const raw = components.join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
