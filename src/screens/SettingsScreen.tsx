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
import {
  SETTINGS_DEFAULTS,
  type ReminderPreset,
  type SarcasmLevel,
} from '../types/settingsPreferences';

type Props = AppScreenProps<'Settings'>;

const SARCASM_ORDER: SarcasmLevel[] = ['formal', 'softie', 'sarcastic', 'mystic'];

const SARCASM_LABEL: Record<SarcasmLevel, string> = {
  formal: 'Formal',
  softie: 'Softie',
  sarcastic: 'Sarcastic',
  mystic: 'Mystic',
};

/** Tagline + sample line for the selected tone (placeholder copy for future reminder text). */
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

const REMINDER_META: {
  id: ReminderPreset;
  title: string;
  description: string;
}[] = [
  { id: 'silent', title: 'Silent', description: 'No automatic reminders.' },
  { id: 'normal', title: 'Normal', description: 'Due soon and overdue only.' },
  { id: 'annoyMe', title: 'Annoy Me', description: 'More frequent reminders with sarcasm.' },
  {
    id: 'partnerOnly',
    title: 'Partner Only',
    description: 'Together Mode only — see section info for details.',
  },
];

const NOTIFICATIONS_SECTION_INFO_BODY =
  'App reminders and partner reactions control two different kinds of pop-ups.\n\n' +
  'If pop-ups are off for either option, those updates still appear quietly in the app feed without interrupting you.\n\n' +
  'TODO: Connect to OS notification permissions and in-app feed routing when implemented.';

const APP_REMINDERS_INFO_BODY =
  'Sarcastic task pop-ups when a task is delayed too long or takes much longer than expected.\n\n' +
  'Copy and timing follow your Sarcasm / Reminder Tone setting once scheduling is wired up.\n\n' +
  'TODO: Tie pop-ups to delay and estimate thresholds when notifications ship.';

const PARTNER_REACTIONS_INFO_BODY =
  'Pop-ups when your Together Mode partner reacts or nudges you.\n\n' +
  'When this is off, partner activity still appears in the app feed without interrupting you.\n\n' +
  'TODO: Gate on active Together session and partner permissions when implemented.';

const REMINDER_FREQUENCY_INFO_BODY =
  'Reminder frequency sets how often and how strongly the app nudges you about tasks in general (placeholder until scheduling and notifications are wired up).\n\n' +
  'Partner Only (Together Mode): the app should not send fallback reminders; only partner reactions and nudges can notify you. If partner reaction pop-ups are off, those updates appear quietly in the app feed.\n\n' +
  'TODO: Allow each task to override the global reminder frequency when persistence ships.';

export default function SettingsScreen({ navigation }: Props) {
  const thm = useTheme();
  const { colors: c, spacing: sp } = thm;
  const s = useMemo(() => buildStyles(thm), [thm]);

  // TODO: Replace useState below with persisted user settings (Firestore / AsyncStorage).
  // TODO: Wire appReminders + partnerReactionPopups to real notification / in-feed routing when implemented.
  const [appReminders, setAppReminders] = useState(true);
  const [partnerReactionPopups, setPartnerReactionPopups] = useState(true);

  const [sarcasmLevel, setSarcasmLevel] = useState<SarcasmLevel>(SETTINGS_DEFAULTS.sarcasmLevel);
  const [reminderPreset, setReminderPreset] = useState<ReminderPreset>(SETTINGS_DEFAULTS.reminderPreset);

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

  function scrollToTop() {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
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
          <Text style={[s.pageIntro, { color: c.textSoft }]}>
            Notification and reminder options below are preview-only until persistence ships. Nothing here
            changes real push behavior yet.
          </Text>

          <SettingsSection
            title="Notifications / Pop-ups"
            description="Choose what may interrupt you versus what stays in the feed."
            titleTrailing={
              <SettingsInfoIcon
                hintTitle="Notifications / Pop-ups"
                hintBody={NOTIFICATIONS_SECTION_INFO_BODY}
              />
            }>
            <View style={[s.notificationsHelper, { borderBottomColor: c.borderInner }]}>
              <Text style={[s.notificationsHelperText, { color: c.textMuted }]}>
                If pop-ups are off, updates should appear quietly in the app feed without interrupting the
                user.
              </Text>
            </View>
            <SettingsToggleRow
              title="App reminders"
              description="Sarcastic task pop-ups when a task is delayed too long or takes much longer than expected."
              value={appReminders}
              onValueChange={setAppReminders}
              infoHint={{ title: 'App reminders', body: APP_REMINDERS_INFO_BODY }}
            />
            <SettingsToggleRow
              title="Partner reactions"
              description="Pop-ups when your Together Mode partner reacts or nudges you."
              value={partnerReactionPopups}
              onValueChange={setPartnerReactionPopups}
              infoHint={{ title: 'Partner reactions', body: PARTNER_REACTIONS_INFO_BODY }}
              showDivider={false}
            />
          </SettingsSection>

          <SettingsSection
            title="Sarcasm / Reminder Tone"
            description="How reminder copy will sound once scheduling is wired up.">
            {/* TODO: Allow tone overrides per task category/type. */}
            <View
              style={[
                s.toneStrip,
                { paddingHorizontal: sp.lg, paddingTop: sp.lg, paddingBottom: sp.md },
              ]}>
              <View style={[s.toneTwoRows, { gap: sp.sm }]}>
                <View style={[s.toneChipRow, { gap: sp.sm }]}>
                  {SARCASM_ORDER.slice(0, 2).map(level => (
                    <View key={level} style={s.toneChipCellFlex}>
                      <SettingsPillOption
                        label={SARCASM_LABEL[level]}
                        selected={sarcasmLevel === level}
                        fillCell
                        onPress={() => {
                          // TODO: Connect sarcasm level to user settings store.
                          setSarcasmLevel(level);
                        }}
                      />
                    </View>
                  ))}
                </View>
                <View style={[s.toneChipRow, { gap: sp.sm }]}>
                  {SARCASM_ORDER.slice(2, 4).map(level => (
                    <View key={level} style={s.toneChipCellFlex}>
                      <SettingsPillOption
                        label={SARCASM_LABEL[level]}
                        selected={sarcasmLevel === level}
                        fillCell
                        onPress={() => {
                          // TODO: Connect sarcasm level to user settings store.
                          setSarcasmLevel(level);
                        }}
                      />
                    </View>
                  ))}
                </View>
              </View>
            </View>
            <View style={[s.hintBox, s.toneHintBox, { borderTopColor: c.border, paddingHorizontal: sp.lg }]}>
              <Text style={[s.toneDescTitle, { color: c.text }]}>{SARCASM_LABEL[sarcasmLevel]}</Text>
              <Text style={[s.toneDescBody, { color: c.textSoft }]}>{SARCASM_DETAIL[sarcasmLevel].tagline}</Text>
              <Text style={[s.toneDescExample, { color: c.textMuted }]}>
                Example: {SARCASM_DETAIL[sarcasmLevel].example}
              </Text>
            </View>
          </SettingsSection>

          {/* TODO: Allow each task to override the global reminder frequency. */}
          {/* TODO: Partner Only — no fallback app reminders in Together Mode; honor Partner reactions pop-up toggle for quiet feed. */}
          <SettingsSection
            title="Reminder Frequency"
            description="How often the app should remind you about tasks (placeholder only)."
            titleTrailing={
              <SettingsInfoIcon hintTitle="Reminder Frequency" hintBody={REMINDER_FREQUENCY_INFO_BODY} />
            }>
            {REMINDER_META.map((row, index) => {
              const showDivider = index < REMINDER_META.length - 1;
              return (
                <SettingsOptionRow
                  key={row.id}
                  title={row.title}
                  description={row.description}
                  selected={reminderPreset === row.id}
                  onPress={() => setReminderPreset(row.id)}
                  showDivider={showDivider}
                />
              );
            })}
            <View style={[s.reminderSectionFooter, { borderTopColor: c.border, padding: sp.lg }]}>
              <Text style={[s.reminderSectionFooterText, { color: c.textSoft }]}>
                Placeholder only — not saved yet.
              </Text>
            </View>
          </SettingsSection>

          <View style={[s.accountBlock, { paddingHorizontal: sp.gutter }]}>
            <TouchableOpacity
              style={[s.signOutBtn, { borderColor: c.border, backgroundColor: c.surface }]}
              onPress={() => auth().signOut()}
              accessibilityRole="button"
              accessibilityLabel="Sign out">
              <Text style={[s.signOutLabel, { color: c.danger }]}>Sign out</Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.devNote, { color: c.textDim }]}>
            Preview-only controls are not saved. TODO: Restore a dedicated entry for task time presets if
            we do not surface them in add-task flows.
          </Text>
        </ScrollView>

        {showScrollTop ? (
          <TouchableOpacity
            style={[
              s.scrollTopFab,
              {
                backgroundColor: c.primary,
                shadowColor: c.shadow,
                borderColor: c.borderStrong,
              },
            ]}
            onPress={scrollToTop}
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

function buildStyles(thm: AppTheme) {
  const { spacing: sp } = thm;
  return StyleSheet.create({
    scrollView: { flex: 1 },
    scrollContent: { paddingTop: sp.sm },
    pageIntro: {
      fontSize: 14,
      lineHeight: 20,
      paddingHorizontal: sp.gutter,
      marginBottom: sp.lg,
    },
    notificationsHelper: {
      paddingHorizontal: sp.lg,
      paddingTop: sp.md,
      paddingBottom: sp.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    notificationsHelperText: {
      fontSize: 13,
      lineHeight: 19,
    },
    toneStrip: {},
    toneTwoRows: {
      alignSelf: 'stretch',
    },
    toneChipRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      alignSelf: 'stretch',
    },
    toneChipCellFlex: {
      flex: 1,
      minWidth: 0,
    },
    hintBox: {
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    toneHintBox: {
      paddingTop: sp.lg,
      paddingBottom: sp.md,
    },
    /** Match SettingsRow title / description rhythm. */
    toneDescTitle: { fontSize: 16, fontWeight: '600', marginBottom: sp.xs },
    toneDescBody: { fontSize: 13, lineHeight: 18, marginBottom: sp.md },
    toneDescExample: { fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
    reminderSectionFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    reminderSectionFooterText: { fontSize: 12, lineHeight: 17 },
    accountBlock: { marginTop: sp.md, marginBottom: sp.sm },
    signOutBtn: {
      borderRadius: thm.radius.md,
      borderWidth: 1,
      paddingVertical: 14,
      alignItems: 'center',
    },
    signOutLabel: { fontSize: 16, fontWeight: '600' },
    devNote: {
      fontSize: 12,
      textAlign: 'center',
      paddingHorizontal: sp.gutter,
      marginTop: sp.sm,
    },
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
