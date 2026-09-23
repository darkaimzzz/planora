import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

/**
 * Where invite links point.
 *
 * `Linking.createURL` gives `planora://join/…` on a device and a localhost URL
 * in development, neither of which is any use pasted into a chat. Set
 * EXPO_PUBLIC_APP_URL to the deployed web address and invites become real
 * https links that open in a browser for anyone, and deep-link into the app
 * for anyone who has it.
 */
const PUBLIC_BASE = process.env.EXPO_PUBLIC_APP_URL?.replace(/\/$/, '');

export function inviteUrl(token: string): string {
  return PUBLIC_BASE ? `${PUBLIC_BASE}/join/${token}` : Linking.createURL(`/join/${token}`);
}

/** True when the link can actually be sent to someone outside this machine. */
export const inviteLinkIsPublic = !!PUBLIC_BASE;

export type ShareResult = 'shared' | 'copied' | 'failed';

/**
 * Hand the invite to the OS share sheet, falling back to the clipboard.
 *
 * The share sheet doesn't exist on desktop web, React Native Web forwards to
 * `navigator.share`, which most desktop browsers don't implement, and the
 * promise simply rejects. Copying is the dependable path, so a failed share
 * becomes a copy rather than nothing happening at all.
 */
export async function shareInvite(title: string, url: string): Promise<ShareResult> {
  const message = `Join my plan "${title}" on Planora: ${url}`;

  const canUseSheet =
    Platform.OS !== 'web' || (typeof navigator !== 'undefined' && !!(navigator as any).share);

  if (canUseSheet) {
    try {
      const result = await Share.share({ message, url });
      if (result.action !== Share.dismissedAction) return 'shared';
    } catch {
      // fall through to the clipboard
    }
  }

  try {
    await Clipboard.setStringAsync(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export async function copyInvite(url: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(url);
    return true;
  } catch {
    return false;
  }
}
