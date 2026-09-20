import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'planbot.pendingInvite';

/**
 * An invite link tapped by someone with no account has to survive the sign-up
 * round trip, so we park the token here and redeem it after authentication.
 */
export const pendingInvite = {
  set: (token: string) => AsyncStorage.setItem(KEY, token),
  get: () => AsyncStorage.getItem(KEY),
  clear: () => AsyncStorage.removeItem(KEY),
};
