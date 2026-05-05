export type Task = {
  id: string;
  userId: string;
  title: string;
  createdAt: number;           // unix timestamp ms — the avoidance counter starts here
  completedAt: number | null;
  estimatedMs: number | null;  // how long the user thought it would take, in ms
  isPublic: boolean;           // false = private/solo, true = visible to invited users
};
