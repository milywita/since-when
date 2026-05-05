import firestore from '@react-native-firebase/firestore';
import type { UserProfile, SessionPartner } from '../types/User';

function generatePersonalCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const usersCol = () => firestore().collection('users');

/**
 * Fetch an existing profile or create one. Also patches any missing fields
 * (e.g. personalInviteCode) so old/partial docs are always brought up to date.
 */
export async function getOrCreateUserProfile(uid: string): Promise<UserProfile> {
  const ref = usersCol().doc(uid);
  const doc = await ref.get();

  if (doc.exists) {
    const data = (doc.data() ?? {}) as Partial<UserProfile>;
    // If the profile is complete, return it directly.
    if (data.personalInviteCode) {
      return {
        uid,
        username: data.username ?? '',
        personalInviteCode: data.personalInviteCode,
        activeSessionId: data.activeSessionId ?? null,
        partners: data.partners ?? [],
      };
    }
    // Profile exists but is missing personalInviteCode — patch it in.
    const newCode = generatePersonalCode();
    await ref.set({
      uid,
      personalInviteCode: newCode,
      activeSessionId: data.activeSessionId ?? null,
      partners: data.partners ?? [],
    }, { merge: true });
    return {
      uid,
      username: data.username ?? '',
      personalInviteCode: newCode,
      activeSessionId: data.activeSessionId ?? null,
      partners: data.partners ?? [],
    };
  }

  // No doc at all — create a fresh profile.
  const profile: UserProfile = {
    uid,
    username: '',
    personalInviteCode: generatePersonalCode(),
    activeSessionId: null,
    partners: [],
  };
  await ref.set(profile);
  return profile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const doc = await usersCol().doc(uid).get();
  if (!doc.exists) { return null; }
  return doc.data() as UserProfile;
}

export async function setUsername(uid: string, username: string): Promise<void> {
  await usersCol().doc(uid).set({ username }, { merge: true });
}

/**
 * Find a user profile by their personal invite code.
 * Returns null if no user has that code.
 */
export async function findUserByInviteCode(code: string): Promise<UserProfile | null> {
  const snapshot = await usersCol()
    .where('personalInviteCode', '==', code.toUpperCase().trim())
    .limit(1)
    .get();
  if (snapshot.empty) { return null; }
  return snapshot.docs[0].data() as UserProfile;
}

export async function setActiveSession(uid: string, sessionId: string | null): Promise<void> {
  await usersCol().doc(uid).set({ activeSessionId: sessionId }, { merge: true });
}

/**
 * Record or update a session partner in both users' partner lists.
 * Call this after a Together session ends (or when both sides have been in the same session).
 */
export async function recordSessionPartner(uid: string, partner: SessionPartner): Promise<void> {
  const ref = usersCol().doc(uid);
  const doc = await ref.get();
  if (!doc.exists) { return; }
  const profile = (doc.data() ?? {}) as Partial<UserProfile>;
  const existing = (profile.partners ?? []).find(p => p.userId === partner.userId);
  let partners: SessionPartner[];
  const currentPartners = profile.partners ?? [];
  if (existing) {
    partners = currentPartners.map(p =>
      p.userId === partner.userId
        ? { ...p, username: partner.username, lastSessionAt: partner.lastSessionAt }
        : p,
    );
  } else {
    partners = [partner, ...currentPartners].slice(0, 20);
  }
  await ref.update({ partners });
}

export function subscribeToUserProfile(
  uid: string,
  onUpdate: (profile: UserProfile) => void,
  onError?: (error: Error) => void,
): () => void {
  return usersCol().doc(uid).onSnapshot(
    doc => {
      if (!doc.exists) { return; }
      const data = (doc.data() ?? {}) as Partial<UserProfile>;
      // If the live doc is missing personalInviteCode, patch it in the background.
      if (!data.personalInviteCode) {
        getOrCreateUserProfile(uid).then(onUpdate).catch(() => {});
        return;
      }
      onUpdate({
        uid,
        username: data.username ?? '',
        personalInviteCode: data.personalInviteCode,
        activeSessionId: data.activeSessionId ?? null,
        partners: data.partners ?? [],
      });
    },
    error => {
      console.error('[userService] profile error:', error.message);
      onError?.(error);
    },
  );
}
