import * as LocalAuthentication from 'expo-local-authentication';

export async function canUseLock(): Promise<boolean> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  return level !== LocalAuthentication.SecurityLevel.NONE;
}

/** Face ID / fingerprint, falling back to the device passcode (PIN). */
export async function unlock(): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock DreamPattern',
    disableDeviceFallback: false,
  });
  return r.success;
}
