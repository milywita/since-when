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
  TaskEstimatePresetsEditor,
} from '../components/settings';
import { useTheme } from '../theme/ThemeContext';
import type { AppTheme } from '../theme/themes';
import type { AppScreenProps } from '../navigation/types';
import type { ReminderPreset, SarcasmLevel } from '../types/settingsPreferences';

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
  { id: 'partnerOnly', title: 'Partner Only', description: 'Only partner nudges and reactions.' },
];

export default function SettingsScreen({ navigation }: Props) {
  const thm = useTheme();
  const { colors: c, spacing: sp } = thm;
  const s = useMemo(() => buildStyles(thm), [thm]);

  // TODO: Replace all useState below with user settings store (Firestore / AsyncStorage).
  const [phoneNotifications, setPhoneNotifications] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [importantTaskReminders, setImportantTaskReminders] = useState(true);
  const [partnerReactions, setPartnerReactions] = useState(true);

  const [sarcasmLevel, setSarcasmLevel] = useState<SarcasmLevel>('sarcastic');
  const [reminderPreset, setReminderPreset] = useState<ReminderPreset>('silent');

  const [manualTimerStart, setManualTimerStart] = useState(false);
  const [askBeforeOverdue, setAskBeforeOverdue] = useState(true);
  const [countWaitingSeparately, setCountWaitingSeparately] = useState(true);
  const [completeWithoutTimer, setCompleteWithoutTimer] = useState(true);

  const [allowPartnerReactions, setAllowPartnerReactions] = useState(true);
  const [allowPartnerNudges, setAllowPartnerNudges] = useState(true);
  const [showActiveTaskToPartner, setShowActiveTaskToPartner] = useState(true);
  const [showOverdueToPartner, setShowOverdueToPartner] = useState(true);
  const [appBackupNudges, setAppBackupNudges] = useState(false);

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
            Tune nudges, tone, and Together visibility. Task time presets save on this device; other
            sections are still preview-only.
          </Text>

          <SettingsSection
            title="Notifications"
            description="Control how Since When gets your attention.">
            <SettingsToggleRow
              title="Phone notifications"
              description="Only for important reminders and partner activity."
              value={phoneNotifications}
              onValueChange={setPhoneNotifications}
            />
            <SettingsToggleRow
              title="In-app notifications"
              description="Show updates inside the app feed."
              value={inAppNotifications}
              onValueChange={setInAppNotifications}
            />
            <SettingsToggleRow
              title="Important task reminders"
              description="Due soon, overdue, and other time-sensitive alerts."
              value={importantTaskReminders}
              onValueChange={setImportantTaskReminders}
            />
            <SettingsToggleRow
              title="Partner reactions & nudges"
              description="When someone reacts to your task or pokes you."
              value={partnerReactions}
              onValueChange={setPartnerReactions}
              showDivider={false}
            />
          </SettingsSection>

          <SettingsSection
            title="Sarcasm & reminder tone"
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
            <View style={[s.toneSectionFooter, { borderTopColor: c.border, padding: sp.lg }]}>
              <Text style={[s.toneSectionFooterText, { color: c.textSoft }]}>
                Later, reminder tone can be customized per task type.
              </Text>
            </View>
          </SettingsSection>

          {/* TODO: Allow each task to override the global reminder default. */}
          <SettingsSection
            title="Reminder defaults"
            description="Default reminder style for new tasks. You can override this per task later.">
            {REMINDER_META.map((row, index) => {
              const showDivider = index < REMINDER_META.length - 1;
              const rowProps = {
                title: row.title,
                description: row.description,
                selected: reminderPreset === row.id,
                onPress: () => setReminderPreset(row.id),
                showDivider,
              };
              if (row.id === 'partnerOnly') {
                return (
                  <React.Fragment key={row.id}>
                    {/* TODO: Partner Only disables fallback app reminders for this preset. */}
                    <SettingsOptionRow {...rowProps} />
                  </React.Fragment>
                );
              }
              return <SettingsOptionRow key={row.id} {...rowProps} />;
            })}
            <View style={[s.reminderSectionFooter, { borderTopColor: c.border, padding: sp.lg }]}>
              <Text style={[s.reminderSectionFooterText, { color: c.textSoft }]}>
                Note: each task will later be able to use its own reminder type.
              </Text>
            </View>
          </SettingsSection>

          <SettingsSection
            title="Timer behavior"
            titleNote="Work in progress"
            description="How the clock behaves on your tasks.">
            <SettingsToggleRow
              title="Manual timer start"
              description="Tasks do not start tracking until you press Start."
              value={manualTimerStart}
              onValueChange={setManualTimerStart}
            />
            <SettingsToggleRow
              title="Ask before marking overdue"
              description="Confirm before a planned task becomes overdue."
              value={askBeforeOverdue}
              onValueChange={setAskBeforeOverdue}
            />
            <SettingsToggleRow
              title="Count waiting separately"
              description="Separate procrastination time from active work time."
              value={countWaitingSeparately}
              onValueChange={setCountWaitingSeparately}
            />
            <SettingsToggleRow
              title="Allow complete without timer"
              description="Useful for tiny tasks finished quickly."
              value={completeWithoutTimer}
              onValueChange={setCompleteWithoutTimer}
              showDivider={false}
            />
          </SettingsSection>

          <SettingsSection
            title="Task time presets"
            description="Customize the time chips shown when creating tasks.">
            <TaskEstimatePresetsEditor />
          </SettingsSection>

          <SettingsSection
            title="Partner / shared mode"
            titleNote="Work in progress"
            description="What your partner can see and send.">
            <SettingsToggleRow
              title="Allow partner reactions"
              description="Let your partner send quick reactions."
              value={allowPartnerReactions}
              onValueChange={setAllowPartnerReactions}
            />
            <SettingsToggleRow
              title="Allow partner nudges"
              description="Let your partner poke you when you are avoiding tasks."
              value={allowPartnerNudges}
              onValueChange={setAllowPartnerNudges}
            />
            <SettingsToggleRow
              title="Show active task to partner"
              description="Share what you are currently working on."
              value={showActiveTaskToPartner}
              onValueChange={setShowActiveTaskToPartner}
            />
            <SettingsToggleRow
              title="Show overdue status to partner"
              description="Let your partner see when tasks are late."
              value={showOverdueToPartner}
              onValueChange={setShowOverdueToPartner}
            />
            <SettingsToggleRow
              title="App backup nudges"
              description="If your partner is inactive, the app can step in."
              value={appBackupNudges}
              onValueChange={setAppBackupNudges}
              showDivider={false}
            />
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
            Other sections above are preview-only (not saved). Task presets use this device only.
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
    toneSectionFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    toneSectionFooterText: { fontSize: 12, lineHeight: 17 },
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
