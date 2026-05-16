import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '../types/Task';
import { pickRandomNotificationLine } from '../utils/pickRandomNotificationLine';
import { buildFancyReminderContextParts } from '../utils/fancyReminderTaskContext';

const FANCY_EMOJI_POOL = ['🔥', '👀', '🙃', '✨', '🎯', '⚡️', '🏆', '😈'] as const;

function pickRandomEmoji(): string {
  const idx = Math.floor(Math.random() * FANCY_EMOJI_POOL.length);
  return FANCY_EMOJI_POOL[idx] ?? '🔥';
}

export type TempFancyReminderDemo = {
  visible: boolean;
  emoji: string;
  message: string;
  contextTaskTitle: string;
  contextTimingLabel: string;
  dismiss: () => void;
};

/**
 * TODO(reminders): Replace this fixed 3-minute interval with real reminder scheduling
 * (Notifee / OS notifications, quiet hours, user tone presets, and task-linked triggers).
 * This hook only demos `FancyReminderModal` during development.
 */
export function useTempFancyReminderDemo(options: {
  enabled: boolean;
  intervalMs: number;
  task: Task | null;
  /** 1-based position of `task` in the active list (first task = 1). */
  queuePosition: number;
}): TempFancyReminderDemo {
  const [visible, setVisible] = useState(false);
  const [emoji, setEmoji] = useState<string>('🔥');
  const [message, setMessage] = useState<string>('');
  const [contextTaskTitle, setContextTaskTitle] = useState<string>('');
  const [contextTimingLabel, setContextTimingLabel] = useState<string>('');

  const visibleRef = useRef(false);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const taskRef = useRef<Task | null>(options.task);
  useEffect(() => {
    taskRef.current = options.task;
  }, [options.task]);

  const queuePositionRef = useRef(options.queuePosition);
  useEffect(() => {
    queuePositionRef.current = options.queuePosition;
  }, [options.queuePosition]);

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const fire = useCallback(() => {
    if (visibleRef.current) {
      return;
    }
    const task = taskRef.current;
    if (!task) {
      return;
    }
    const nowMs = Date.now();
    const parts = buildFancyReminderContextParts(task, {
      nowMs,
      queuePosition: queuePositionRef.current,
    });
    setEmoji(pickRandomEmoji());
    setMessage(pickRandomNotificationLine());
    setContextTaskTitle(parts.taskTitleTruncated);
    setContextTimingLabel(parts.timingLabel);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!options.enabled) {
      return;
    }
    const id = setInterval(fire, options.intervalMs);
    return () => clearInterval(id);
  }, [options.enabled, options.intervalMs, fire]);

  return { visible, emoji, message, contextTaskTitle, contextTimingLabel, dismiss };
}
