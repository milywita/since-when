/** Unit picker in the task estimate preset editor. */
export type TaskEstimateTimeUnit = 'minutes' | 'hours' | 'days';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/** Total minutes from modal amount + unit (integer minutes, ≥ 1). */
export function totalMinutesFromAmountAndUnit(amount: number, unit: TaskEstimateTimeUnit): number {
  const n = Math.floor(amount);
  if (!Number.isFinite(n) || n < 1) {
    return NaN;
  }
  if (unit === 'minutes') {
    return n;
  }
  if (unit === 'hours') {
    return n * MINUTES_PER_HOUR;
  }
  return n * MINUTES_PER_DAY;
}

/** Short chip label: `15m`, `1h`, `2d` (matches add-task / settings chips). */
export function compactLabelFromAmountAndUnit(amount: number, unit: TaskEstimateTimeUnit): string {
  const n = Math.floor(amount);
  if (!Number.isFinite(n) || n < 1) {
    return '';
  }
  if (unit === 'minutes') {
    return `${n}m`;
  }
  if (unit === 'hours') {
    return `${n}h`;
  }
  return `${n}d`;
}

/**
 * Picks days, then hours, then minutes so the modal opens with a sensible default
 * (e.g. 60 minutes → 1 hour, not 60 minutes).
 */
export function msToAmountAndUnit(ms: number): { amount: number; unit: TaskEstimateTimeUnit } {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes % MINUTES_PER_DAY === 0) {
    return { amount: minutes / MINUTES_PER_DAY, unit: 'days' };
  }
  if (minutes % MINUTES_PER_HOUR === 0) {
    return { amount: minutes / MINUTES_PER_HOUR, unit: 'hours' };
  }
  return { amount: minutes, unit: 'minutes' };
}

/** Chip text when only ms is known (canonical compact string). */
export function presetChipLabelFromMs(ms: number): string {
  const { amount, unit } = msToAmountAndUnit(ms);
  return compactLabelFromAmountAndUnit(amount, unit);
}

/** Spoken / accessibility label (full words). */
export function presetSpokenLabelFromMs(ms: number): string {
  const { amount, unit } = msToAmountAndUnit(ms);
  if (unit === 'minutes') {
    return amount === 1 ? '1 minute' : `${amount} minutes`;
  }
  if (unit === 'hours') {
    return amount === 1 ? '1 hour' : `${amount} hours`;
  }
  return amount === 1 ? '1 day' : `${amount} days`;
}
