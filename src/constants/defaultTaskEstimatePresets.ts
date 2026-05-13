import type { TaskEstimatePreset } from '../types/TaskEstimatePreset';
import { presetChipLabelFromMs } from '../utils/taskEstimatePresetLabel';

export const TASK_ESTIMATE_PRESET_COUNT = 6 as const;

/** Shipped defaults; user overrides live in AsyncStorage via TaskEstimatePresetsProvider. */
export const DEFAULT_TASK_ESTIMATE_PRESETS: TaskEstimatePreset[] = [
  { label: presetChipLabelFromMs(15 * 60 * 1000), ms: 15 * 60 * 1000 },
  { label: presetChipLabelFromMs(30 * 60 * 1000), ms: 30 * 60 * 1000 },
  { label: presetChipLabelFromMs(60 * 60 * 1000), ms: 60 * 60 * 1000 },
  { label: presetChipLabelFromMs(2 * 60 * 60 * 1000), ms: 2 * 60 * 60 * 1000 },
  { label: presetChipLabelFromMs(4 * 60 * 60 * 1000), ms: 4 * 60 * 60 * 1000 },
  { label: presetChipLabelFromMs(24 * 60 * 60 * 1000), ms: 24 * 60 * 60 * 1000 },
];
