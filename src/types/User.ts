export type SessionPartner = {
  userId: string;
  username: string;
  lastSessionAt: number;
};

export type UserProfile = {
  uid: string;
  username: string;
  /** Fixed 6-char code that never changes — others use this to find your active session. */
  personalInviteCode: string;
  /** ID of the session this user is currently hosting/in, or null. */
  activeSessionId: string | null;
  /** Last 20 people this user worked with in Together sessions. */
  partners: SessionPartner[];
};
