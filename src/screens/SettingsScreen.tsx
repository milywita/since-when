import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { ScreenHeaderBackButton } from '../components/layout/ScreenHeaderBackButton';
import {
  SettingsSection,
  SettingsToggleRow,
  SettingsOptionRow,
  SettingsPillOption,
  SettingsInfoIcon,
} from '../components/settings';
import { useTheme } from '../theme/ThemeContext';
import type { AppTheme } from '../theme/themes';
import type { AppScreenProps } from '../navigation/types';
import type { ReminderPreset, SarcasmLevel } from '../types/settingsPreferences';
import { useUserSettings } from '../context/UserSettingsContext';

type Props = AppScreenProps<'Settings'>;

// ─── Static metadata ──────────────────────────────────────────────────────────

const SARCASM_ORDER: SarcasmLevel[] = ['formal', 'softie', 'sarcastic', 'mystic'];

const SARCASM_LABEL: Record<SarcasmLevel, string> = {
  formal: 'Formal',
  softie: 'Softie',
  sarcastic: 'Sarcastic',
  mystic: 'Mystic',
};

const SARCASM_DETAIL: Record<SarcasmLevel, { tagline: string; example: string }> = {
  formal: {
    tagline: 'Clear, calm reminders with no jokes.',
    example: 'Your task is overdue.',
  },
  softie: {
    tagline: 'Cute, gentle, encouraging reminders.',
    example: 'Tiny reminder — your task is waiting for you.',
  },
  sarcastic: {
    tagline: 'Classic Since When tone: playful judgment and funny roasts.',
    example: 'You said later. Later brought receipts.',
  },
  mystic: {
    tagline: 'Magical/fairy-style dramatic reminders.',
    example: 'The task has awakened. The prophecy remains unfinished.',
  },
};

const REMINDER_META: { id: ReminderPreset; title: string; description: string }[] = [
  {
    id: 'silent',
    title: 'Silent',
    description: 'No in-app reminders or pop-ups.',
  },
  {
    id: 'normal',
    title: 'Normal',
    description: 'Standard timing based on task rank.',
  },
  {
    id: 'annoyMe',
    title: 'Annoy Me',
    description: 'Reminders fire sooner and more often.',
  },
  {
    id: 'partnerOnly',
    title: 'Partner Only',
    description: 'Only partner reactions notify you.',
  },
];

// ─── Info copy ────────────────────────────────────────────────────────────────

/** Longer explainer for (i) — no “turn off session” language; critical OS alerts are not a setting here. */
const PARTNER_REACTION_POPUPS_INFO =

  'This switch only affects partner reaction and nudge alerts. When off, new items appear quietly in Activity.';

const REMINDER_FREQUENCY_INFO =
  'Controls in-app pop-ups and nudges.\n\n' +
  'Silent: no reminders or celebrations.\n' +
  'Normal: standard timing.\n' +
  'Annoy Me: sooner, more frequent nudges.\n' +
  'Partner Only: no solo reminders; partner reactions still apply.\n\n' +
  'Per-task overrides are ignored while Silent is active.';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen({ navigation }: Props) {
  const thm = useTheme();
  const { colors: c, spacing: sp } = thm;
  const s = useMemo(() => buildStyles(thm), [thm]);

  const {
    settings,
    setSarcasmLevel,
    setReminderPreset,
    setPartnerReactionPushEnabled,
  } = useUserSettings();

  const scrollRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollTopVisibleRef = useRef(false);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y;
    const next = y > 200;
    if (next !== scrollTopVisibleRef.current) {
      scrollTopVisibleRef.current = next;
      setShowScrollTop(next);
    }
  }

  return (
    <Screen safeArea edges={['top', 'bottom']}>
      <>
        <ScreenHeader
          leading={<ScreenHeaderBackButton onPress={() => navigation.goBack()} />}
          title="Settings"
        />

        <ScrollView
          ref={scrollRef}
          style={s.scrollView}
          contentContainerStyle={[s.scrollContent, { paddingBottom: sp.xxl + sp.lg }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={32}>

          {/* ── Partner reaction pop-ups ─────────────────────────────── */}
          <SettingsSection
            title="Push Notifications"
            description="Show pop-ups when your Together Mode partner reacts or nudges you. If off, reactions appear quietly in Activity."
            titleTrailing={
              <SettingsInfoIcon
                hintTitle="Push Notifications"
                hintBody={PARTNER_REACTION_POPUPS_INFO}
              />
            }>
            {settings.reminderPreset !== 'silent' ? (
              <SettingsToggleRow
                title="Partner reactions"
                value={settings.partnerReactionPushEnabled}
                onValueChange={setPartnerReactionPushEnabled}
                showDivider={false}
              />
            ) : null}
          </SettingsSection>

          {/* ── Sarcasm / Reminder Tone section ────────────────────── */}
          <SettingsSection
            title="Sarcasm / Reminder Tone"
            description="Controls in-app task reminder pop-ups.">
            <View style={[s.toneStrip, { paddingHorizontal: sp.lg, paddingTop: sp.lg, paddingBottom: sp.md }]}>
              <View style={[s.toneTwoRows, { gap: sp.sm }]}>
                <View style={[s.toneChipRow, { gap: sp.sm }]}>
                  {SARCASM_ORDER.slice(0, 2).map(level => (
                    <View key={level} style={s.toneChipCellFlex}>
                      <SettingsPillOption
                        label={SARCASM_LABEL[level]}
                        selected={settings.sarcasmLevel === level}
                        fillCell
                        onPress={() => setSarcasmLevel(level)}
                      />
                    </View>
                  ))}
                </View>
                <View style={[s.toneChipRow, { gap: sp.sm }]}>
                  {SARCASM_ORDER.slice(2, 4).map(level => (
                    <View key={level} style={s.toneChipCellFlex}>
                      <SettingsPillOption
                        label={SARCASM_LABEL[level]}
                        selected={settings.sarcasmLevel === level}
                        fillCell
                        onPress={() => setSarcasmLevel(level)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            </View>
            <View style={[s.hintBox, s.toneHintBox, { borderTopColor: c.border, paddingHorizontal: sp.lg }]}>
              <Text style={[s.toneDescTitle, { color: c.text }]}>
                {SARCASM_LABEL[settings.sarcasmLevel]}
              </Text>
              <Text style={[s.toneDescBody, { color: c.textSoft }]}>
                {SARCASM_DETAIL[settings.sarcasmLevel].tagline}
              </Text>
              <Text style={[s.toneDescExample, { color: c.textMuted }]}>
                Example: {SARCASM_DETAIL[settings.sarcasmLevel].example}
              </Text>
            </View>
          </SettingsSection>

          {/* ── Reminder Frequency section ──────────────────────────── */}
          <SettingsSection
            title="Reminder Frequency"
            description="In-app nudges only — not phone push."
            titleTrailing={
              <SettingsInfoIcon
                hintTitle="Reminder Frequency"
                hintBody={REMINDER_FREQUENCY_INFO}
              />
            }>
            {REMINDER_META.map((row, index) => (
              <SettingsOptionRow
                key={row.id}
                title={row.title}
                description={row.description}
                selected={settings.reminderPreset === row.id}
                onPress={() => setReminderPreset(row.id)}
                showDivider={index < REMINDER_META.length - 1}
              />
            ))}
          </SettingsSection>

          {/* ── Sign out ────────────────────────────────────────────── */}
          <View style={[s.accountBlock, { paddingHorizontal: sp.gutter }]}>
            <TouchableOpacity
              style={[s.signOutBtn, { borderColor: c.border, backgroundColor: c.surface }]}
              onPress={() => auth().signOut()}
              accessibilityRole="button"
              accessibilityLabel="Sign out">
              <Text style={[s.signOutLabel, { color: c.danger }]}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {showScrollTop ? (
          <TouchableOpacity
            style={[s.scrollTopFab, { backgroundColor: c.primary, shadowColor: c.shadow, borderColor: c.borderStrong }]}
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Scroll to top">
            <Text style={[s.scrollTopFabIcon, { color: c.primaryText }]}>{'\u2191'}</Text>
          </TouchableOpacity>
        ) : null}
      </>
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function buildStyles(thm: AppTheme) {
  const { spacing: sp } = thm;
  return StyleSheet.create({
    scrollView: { flex: 1 },
    scrollContent: { paddingTop: sp.sm },
    toneStrip: {},
    toneTwoRows: { alignSelf: 'stretch' },
    toneChipRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      alignSelf: 'stretch',
    },
    toneChipCellFlex: { flex: 1, minWidth: 0 },
    hintBox: { borderTopWidth: StyleSheet.hairlineWidth },
    toneHintBox: { paddingTop: sp.lg, paddingBottom: sp.md },
    toneDescTitle: { fontSize: 16, fontWeight: '600', marginBottom: sp.xs },
    toneDescBody: { fontSize: 13, lineHeight: 18, marginBottom: sp.md },
    toneDescExample: { fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
    accountBlock: { marginTop: sp.md, marginBottom: sp.sm },
    signOutBtn: {
      borderRadius: thm.radius.md,
      borderWidth: 1,
      paddingVertical: 14,
      alignItems: 'center',
    },
    signOutLabel: { fontSize: 16, fontWeight: '600' },
    scrollTopFab: {
      position: 'absolute',
      right: sp.gutter,
      bottom: sp.xl,
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 6,
    },
    scrollTopFabIcon: { fontSize: 22, fontWeight: '600', marginTop: -2 },
  });
}
