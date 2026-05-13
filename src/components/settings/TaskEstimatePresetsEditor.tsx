import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/themes';
import { TASK_ESTIMATE_PRESET_COUNT } from '../../constants/defaultTaskEstimatePresets';
import type { TaskEstimatePreset } from '../../types/TaskEstimatePreset';
import { useTaskEstimatePresets } from '../../context/TaskEstimatePresetsContext';
import {
  compactLabelFromAmountAndUnit,
  msToAmountAndUnit,
  presetChipLabelFromMs,
  presetSpokenLabelFromMs,
  totalMinutesFromAmountAndUnit,
  type TaskEstimateTimeUnit,
} from '../../utils/taskEstimatePresetLabel';

const UNITS: TaskEstimateTimeUnit[] = ['minutes', 'hours', 'days'];

function unitButtonLabel(unit: TaskEstimateTimeUnit): string {
  if (unit === 'minutes') {
    return 'Minutes';
  }
  if (unit === 'hours') {
    return 'Hours';
  }
  return 'Days';
}

function validateApply(next: TaskEstimatePreset[]): string | null {
  if (next.length !== TASK_ESTIMATE_PRESET_COUNT) {
    return 'Something went wrong with the preset list.';
  }
  const seen = new Set<number>();
  for (const p of next) {
    const mins = p.ms / 60000;
    if (!Number.isFinite(mins) || mins < 1 || mins > 43200) {
      return 'Use a duration between 1 minute and 30 days.';
    }
    if (seen.has(p.ms)) {
      return 'Each chip needs a different length of time.';
    }
    seen.add(p.ms);
  }
  return null;
}

export function TaskEstimatePresetsEditor() {
  const thm = useTheme();
  const { colors: c, spacing: sp } = thm;
  const { width: windowWidth } = useWindowDimensions();
  const { presets, setPresets, resetToDefaults } = useTaskEstimatePresets();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editAmountStr, setEditAmountStr] = useState('');
  const [editUnit, setEditUnit] = useState<TaskEstimateTimeUnit>('minutes');

  const s = useMemo(() => buildStyles(thm, windowWidth), [thm, windowWidth]);

  const openEdit = useCallback(
    (index: number) => {
      const row = presets[index];
      if (!row) {
        return;
      }
      const { amount, unit } = msToAmountAndUnit(row.ms);
      setEditAmountStr(String(amount));
      setEditUnit(unit);
      setEditingIndex(index);
    },
    [presets],
  );

  const closeEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const applyEdit = useCallback(async () => {
    if (editingIndex === null) {
      return;
    }
    const amount = parseInt(editAmountStr.replace(/\s/g, ''), 10);
    const totalMin = totalMinutesFromAmountAndUnit(amount, editUnit);
    if (!Number.isFinite(totalMin) || totalMin < 1 || totalMin > 43200) {
      Alert.alert('Almost there', 'Enter a whole number so the total time is between 1 minute and 30 days.');
      return;
    }
    const newMs = totalMin * 60 * 1000;
    const newLabel = compactLabelFromAmountAndUnit(amount, editUnit);
    const next = presets.map((p, i) => (i === editingIndex ? { label: newLabel, ms: newMs } : p));
    const err = validateApply(next);
    if (err) {
      Alert.alert('Almost there', err);
      return;
    }
    await setPresets(next);
    closeEdit();
  }, [editingIndex, editAmountStr, editUnit, presets, setPresets, closeEdit]);

  function handleReset() {
    Alert.alert('Reset time chips?', 'Restore the built-in six options.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => resetToDefaults() },
    ]);
  }

  return (
    <View style={s.root}>
      <View style={s.chipWrap}>
        {presets.map((p, index) => (
          <TouchableOpacity
            key={`${index}-${p.ms}`}
            style={s.presetChip}
            onPress={() => openEdit(index)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${presetSpokenLabelFromMs(p.ms)}`}>
            <Text style={s.presetChipText} numberOfLines={1}>
              {presetChipLabelFromMs(p.ms)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity onPress={handleReset} style={s.resetWrap} hitSlop={12}>
        <Text style={[s.resetLink, { color: c.textSoft }]}>Reset to defaults</Text>
      </TouchableOpacity>

      <Modal
        visible={editingIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEdit}>
        <View style={s.modalWrap}>
          <TouchableOpacity
            style={[s.modalBackdrop, { backgroundColor: c.backdrop }]}
            activeOpacity={1}
            onPress={closeEdit}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={s.modalCenter}>
            <View style={[s.modalSheet, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}>
              <Text style={[s.modalTitle, { color: c.text }]}>Edit duration</Text>

              <Text style={[s.modalFieldLabel, { color: c.textSoft }]}>Duration</Text>
              <TextInput
                style={[s.modalInput, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
                value={editAmountStr}
                onChangeText={t => setEditAmountStr(t.replace(/[^\d]/g, ''))}
                placeholder="15"
                placeholderTextColor={c.textSoft}
                keyboardType="number-pad"
                maxLength={5}
              />

              <Text style={[s.modalFieldLabel, { color: c.textSoft, marginTop: sp.xs }]}>Unit</Text>
              <View style={s.unitRow}>
                {UNITS.map(unit => {
                  const on = editUnit === unit;
                  return (
                    <TouchableOpacity
                      key={unit}
                      style={[
                        s.unitPill,
                        {
                          borderColor: on ? c.primary : c.border,
                          backgroundColor: on ? c.primary : c.surface,
                        },
                      ]}
                      onPress={() => setEditUnit(unit)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={unitButtonLabel(unit)}>
                      <Text
                        style={[
                          s.unitPillText,
                          { color: on ? c.primaryText : c.textMuted },
                        ]}>
                        {unitButtonLabel(unit)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={s.modalActions}>
                <TouchableOpacity style={[s.modalGhost, { borderColor: c.border }]} onPress={closeEdit}>
                  <Text style={[s.modalGhostText, { color: c.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.modalPrimary, { backgroundColor: c.primary }]} onPress={applyEdit}>
                  <Text style={[s.modalPrimaryText, { color: c.primaryText }]}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function buildStyles(thm: AppTheme, windowWidth: number) {
  const { spacing: sp, radius: r, colors: c } = thm;
  /** Prefer smaller chips on narrow phones so six presets stay on one row. */
  const narrow = windowWidth < 380;
  const chipGap = narrow ? sp.xs : sp.sm;
  const chipPadH = narrow ? 4 : 6;
  const chipPadV = narrow ? 5 : 6;
  const chipFont = narrow ? 11 : 12;
  return StyleSheet.create({
    root: { width: '100%' },
    chipWrap: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      justifyContent: 'space-between',
      alignItems: 'stretch',
      gap: chipGap,
      paddingVertical: sp.sm,
      paddingHorizontal: sp.md,
      paddingBottom: sp.sm,
    },
    presetChip: {
      flex: 1,
      minWidth: 0,
      borderRadius: sp.sm,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: chipPadV,
      paddingHorizontal: chipPadH,
      alignItems: 'center',
      justifyContent: 'center',
    },
    presetChipText: {
      fontSize: chipFont,
      fontWeight: '500',
      color: c.textMuted,
      textAlign: 'center',
    },
    resetWrap: {
      paddingTop: sp.xs,
      paddingBottom: sp.md,
      paddingHorizontal: sp.md,
      alignItems: 'center',
    },
    resetLink: { fontSize: 14, fontWeight: '500' },
    modalWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: sp.xl },
    modalBackdrop: { ...StyleSheet.absoluteFill },
    modalCenter: { maxWidth: 400, width: '100%', alignSelf: 'center' },
    modalSheet: {
      borderRadius: r.md,
      borderWidth: 1,
      padding: sp.xl,
    },
    modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: sp.lg },
    modalFieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: sp.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    modalInput: {
      borderWidth: 1,
      borderRadius: r.sm,
      paddingVertical: 12,
      paddingHorizontal: sp.md,
      fontSize: 16,
      marginBottom: sp.md,
    },
    unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm, marginBottom: sp.lg },
    unitPill: {
      flexGrow: 1,
      minWidth: '28%',
      borderRadius: r.sm,
      borderWidth: 1,
      paddingVertical: 10,
      paddingHorizontal: sp.sm,
      alignItems: 'center',
    },
    unitPillText: { fontSize: 14, fontWeight: '600' },
    modalActions: { flexDirection: 'row', gap: sp.sm, marginTop: sp.sm },
    modalGhost: {
      flex: 1,
      borderRadius: r.sm,
      borderWidth: 1,
      paddingVertical: 14,
      alignItems: 'center',
    },
    modalGhostText: { fontSize: 15, fontWeight: '600' },
    modalPrimary: {
      flex: 1,
      borderRadius: r.sm,
      paddingVertical: 14,
      alignItems: 'center',
    },
    modalPrimaryText: { fontSize: 15, fontWeight: '600' },
  });
}
