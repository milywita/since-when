import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import type { TaskEstimatePreset } from '../../types/TaskEstimatePreset';
import type { ReminderPreset, TogetherVisibility } from '../../types/settingsPreferences';
import { SETTINGS_DEFAULTS } from '../../types/settingsPreferences';
import { presetSpokenLabelFromMs } from '../../utils/taskEstimatePresetLabel';

const REMINDER_PRESET_OPTIONS: { id: ReminderPreset; label: string }[] = [
  { id: 'silent', label: 'Silent' },
  { id: 'normal', label: 'Normal' },
  { id: 'annoyMe', label: 'Annoy Me' },
  { id: 'partnerOnly', label: 'Partner Only' },
];

const TOGETHER_VISIBILITY_OPTIONS: { id: TogetherVisibility; label: string }[] = [
  { id: 'visible', label: 'Visible in Together' },
  { id: 'hidden', label: 'Hidden in Together' },
];

function stashAdvancedDraftForLater(draft: {
  reminderPreset: ReminderPreset;
  reminderPresetOverride: ReminderPreset | null;
  togetherVisibility: TogetherVisibility;
  togetherVisibilityOverride: TogetherVisibility | null;
}) {
  // TODO: Persist advanced task fields with task payload once task schema/backing service are ready.
  return draft;
}

function VisibilityEyeIcon({ color, crossed }: { color: string; crossed: boolean }) {
  return (
    <View style={eyeStyles.wrap}>
      <View style={[eyeStyles.outline, { borderColor: color }]} />
      <View style={[eyeStyles.pupil, { backgroundColor: color }]} />
      {crossed ? (
        <View style={[eyeStyles.crossLine, { backgroundColor: color, transform: [{ rotate: '-28deg' }] }]} />
      ) : null}
    </View>
  );
}

const eyeStyles = StyleSheet.create({
  wrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  outline: { position: 'absolute', width: 12, height: 8, borderWidth: 1.4, borderRadius: 6 },
  pupil: { width: 3.5, height: 3.5, borderRadius: 1.75 },
  crossLine: { position: 'absolute', width: 14, height: 1.5, borderRadius: 1 },
});

export type TaskFormCommitPayload = {
  title: string;
  estimatedMs: number | null;
  reminderPreset: ReminderPreset;
  reminderPresetOverride: ReminderPreset | null;
  togetherVisibility: TogetherVisibility;
  togetherVisibilityOverride: TogetherVisibility | null;
};

export type TaskFormBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  /** When set (e.g. task id), re-sync initial fields when opening or switching task. */
  syncKey?: string | null;
  sheetTitle: string;
  titlePlaceholder: string;
  estimatePrompt: string;
  submitLabel: string;
  timePresets: TaskEstimatePreset[];
  /** Pre-fill for edit mode (and optional create defaults). */
  initial?: Partial<{
    title: string;
    estimatedMs: number | null;
    reminderPreset: ReminderPreset;
    reminderPresetOverride: ReminderPreset | null;
    togetherVisibility: TogetherVisibility;
    togetherVisibilityOverride: TogetherVisibility | null;
  }>;
  /** When set, show this message instead of the form (e.g. session task limit). */
  lockedBody?: string | null;
  onCommit: (payload: TaskFormCommitPayload) => Promise<void>;
};

export function TaskFormBottomSheet({
  visible,
  onClose,
  mode,
  syncKey,
  sheetTitle,
  titlePlaceholder,
  estimatePrompt,
  submitLabel,
  timePresets,
  initial,
  lockedBody,
  onCommit,
}: TaskFormBottomSheetProps) {
  const thm = useTheme();
  const { colors: c, spacing: sp, radius: r } = thm;
  const insets = useSafeAreaInsets();
  const s = styles;

  const [text, setText] = useState('');
  const [selectedMs, setSelectedMs] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [reminderPresetOverride, setReminderPresetOverride] = useState<ReminderPreset | null>(null);
  const [togetherVisibilityOverride, setTogetherVisibilityOverride] = useState<TogetherVisibility | null>(null);

  const selectedReminderPreset = reminderPresetOverride ?? initial?.reminderPreset ?? SETTINGS_DEFAULTS.reminderPreset;
  const selectedTogetherVisibility =
    togetherVisibilityOverride ?? initial?.togetherVisibility ?? SETTINGS_DEFAULTS.togetherVisibility;

  useEffect(() => {
    if (!visible) { return; }
    setText(initial?.title ?? '');
    setSelectedMs(initial?.estimatedMs ?? null);
    setReminderPresetOverride(initial?.reminderPresetOverride ?? null);
    setTogetherVisibilityOverride(initial?.togetherVisibilityOverride ?? null);
    setAdvancedOpen(false);
  }, [
    visible,
    syncKey,
    initial?.title,
    initial?.estimatedMs,
    initial?.reminderPreset,
    initial?.togetherVisibility,
    initial?.reminderPresetOverride,
    initial?.togetherVisibilityOverride,
  ]);

  function resetDraft() {
    setText('');
    setSelectedMs(null);
    setAdvancedOpen(false);
    setReminderPresetOverride(null);
    setTogetherVisibilityOverride(null);
  }

  function handleClose() {
    resetDraft();
    onClose();
  }

  async function handleSubmit() {
    if (lockedBody) { return; }
    const trimmed = text.trim();
    if (!trimmed) { return; }
    const payload: TaskFormCommitPayload = {
      title: trimmed,
      estimatedMs: selectedMs,
      reminderPreset: selectedReminderPreset,
      reminderPresetOverride,
      togetherVisibility: selectedTogetherVisibility,
      togetherVisibilityOverride,
    };
    stashAdvancedDraftForLater({
      reminderPreset: payload.reminderPreset,
      reminderPresetOverride: payload.reminderPresetOverride,
      togetherVisibility: payload.togetherVisibility,
      togetherVisibilityOverride: payload.togetherVisibilityOverride,
    });
    setSaving(true);
    try {
      await onCommit(payload);
      if (mode === 'create') {
        resetDraft();
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const cardBottom = insets.bottom + 100;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={s.host}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={[s.card, { marginBottom: cardBottom, backgroundColor: c.surfaceRaised, borderColor: c.border }]}>
          <View style={[s.handle, { backgroundColor: c.borderStrong }]} />
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[s.scroll, { padding: sp.xl, gap: 14 }]}>
            {lockedBody ? (
              <>
                <Text style={[s.title, { color: c.text }]}>{sheetTitle}</Text>
                <Text style={[s.lockedText, { color: c.textSoft }]}>{lockedBody}</Text>
                <TouchableOpacity style={[s.primaryBtn, { backgroundColor: c.primary }]} onPress={handleClose}>
                  <Text style={[s.primaryBtnText, { color: c.primaryText }]}>Got it</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[s.title, { color: c.text }]}>{sheetTitle}</Text>
                <TextInput
                  style={[
                    s.input,
                    {
                      backgroundColor: c.surface,
                      color: c.text,
                      borderColor: c.border,
                      borderRadius: r.sm,
                    },
                  ]}
                  placeholder={titlePlaceholder}
                  placeholderTextColor={c.textSoft}
                  value={text}
                  onChangeText={setText}
                  autoFocus={mode === 'create'}
                  multiline
                  maxLength={120}
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={handleSubmit}
                />
                <Text style={[s.estimateLabel, { color: c.textSoft }]}>{estimatePrompt}</Text>
                <View style={s.presetRow}>
                  {timePresets.map((p, idx) => (
                    <TouchableOpacity
                      key={`${idx}-${p.ms}`}
                      style={[
                        s.presetChip,
                        { borderColor: c.border },
                        selectedMs === p.ms && { backgroundColor: c.primary, borderColor: c.primary },
                      ]}
                      onPress={() => setSelectedMs(prev => (prev === p.ms ? null : p.ms))}
                      accessibilityRole="button"
                      accessibilityState={{ selected: selectedMs === p.ms }}
                      accessibilityLabel={presetSpokenLabelFromMs(p.ms)}>
                      <Text
                        style={[
                          s.presetChipText,
                          { color: c.textMuted },
                          selectedMs === p.ms && { color: c.primaryText },
                        ]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[
                    s.advancedToggle,
                    { borderColor: c.border, backgroundColor: c.surface },
                    { borderRadius: r.sm },
                  ]}
                  onPress={() => setAdvancedOpen(prev => !prev)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: advancedOpen }}>
                  <Text style={[s.advancedToggleLabel, { color: c.textSoft }]}>Advanced options</Text>
                  <Text style={[s.advancedChevron, { color: c.textDim }]}>{advancedOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {advancedOpen && (
                  <View style={[s.advancedCard, { borderColor: c.border, backgroundColor: c.surface, borderRadius: r.sm }]}>
                    <Text style={[s.advancedGroupTitle, { color: c.textSoft }]}>Reminder preset</Text>
                    <View style={s.advancedChipRow}>
                      {REMINDER_PRESET_OPTIONS.map(opt => (
                        <TouchableOpacity
                          key={opt.id}
                          style={[
                            s.advancedChip,
                            { borderColor: c.border, backgroundColor: c.surfaceRaised },
                            selectedReminderPreset === opt.id && {
                              backgroundColor: c.primary,
                              borderColor: c.primary,
                            },
                          ]}
                          onPress={() => setReminderPresetOverride(opt.id)}>
                          <Text
                            style={[
                              s.advancedChipText,
                              { color: c.textMuted },
                              selectedReminderPreset === opt.id && { color: c.primaryText },
                            ]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={[s.advancedGroupTitle, { color: c.textSoft }]}>Together Mode visibility</Text>
                    <View style={s.advancedChipRow}>
                      {TOGETHER_VISIBILITY_OPTIONS.map(opt => (
                        <TouchableOpacity
                          key={opt.id}
                          style={[
                            s.advancedChip,
                            { borderColor: c.border, backgroundColor: c.surfaceRaised },
                            selectedTogetherVisibility === opt.id && {
                              backgroundColor: c.primary,
                              borderColor: c.primary,
                            },
                          ]}
                          onPress={() => setTogetherVisibilityOverride(opt.id)}>
                          <View style={s.advancedChipRowInner}>
                            <VisibilityEyeIcon
                              color={selectedTogetherVisibility === opt.id ? c.primaryText : c.textMuted}
                              crossed={opt.id === 'hidden'}
                            />
                            <Text
                              style={[
                                s.advancedChipText,
                                { color: c.textMuted },
                                selectedTogetherVisibility === opt.id && { color: c.primaryText },
                              ]}>
                              {opt.label}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    s.primaryBtn,
                    { backgroundColor: c.primary },
                    (!text.trim() || saving) && { opacity: 0.45 },
                  ]}
                  onPress={handleSubmit}
                  disabled={!text.trim() || saving}>
                  {saving ? (
                    <ActivityIndicator color={c.primaryText} />
                  ) : (
                    <Text style={[s.primaryBtnText, { color: c.primaryText }]}>{submitLabel}</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  card: {
    marginHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  scroll: {},
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  lockedText: { fontSize: 14, lineHeight: 20 },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    minHeight: 52,
  },
  estimateLabel: { fontSize: 13 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: { borderRadius: 10, borderWidth: 1, paddingVertical: 7, paddingHorizontal: 13 },
  presetChipText: { fontSize: 13, fontWeight: '500' },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  advancedToggleLabel: { fontSize: 13, fontWeight: '600' },
  advancedChevron: { fontSize: 11, fontWeight: '700' },
  advancedCard: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, gap: 4 },
  advancedGroupTitle: { marginTop: 4, marginBottom: 6, fontSize: 12, fontWeight: '600' },
  advancedChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  advancedChipRowInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  advancedChip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  advancedChipText: { fontSize: 12, fontWeight: '500' },
  primaryBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '600' },
});
