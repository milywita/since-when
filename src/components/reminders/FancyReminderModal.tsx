import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import Modal from 'react-native-modal';
import { ContinuousConfetti } from 'react-native-fast-confetti';
import { useTheme, useThemeToggle } from '../../theme/ThemeContext';

const SCREEN = Dimensions.get('window');

export type FancyReminderModalProps = {
  visible: boolean;
  emoji: string;
  message: string;
  /** Truncated task title (no leading "Task:"). */
  contextTaskTitle: string;
  /** From `buildFancyReminderTimingLabel` (e.g. `Overdue by 16m`). */
  contextTimingLabel: string;
  /** When true, renders a confetti burst — only for task completion events. */
  isCompletion?: boolean;
  onDismiss: () => void;
};

/** Matches `buildFancyReminderTimingLabel` when focus exceeds estimate. */
function isOverdueTimingLabel(timingLabel: string): boolean {
  return timingLabel.startsWith('Overdue by ');
}

export function FancyReminderModal({
  visible,
  emoji,
  message,
  contextTaskTitle,
  contextTimingLabel,
  isCompletion = false,
  onDismiss,
}: FancyReminderModalProps) {
  const { colors: c, spacing: sp, radius: r } = useTheme();
  const { isDark } = useThemeToggle();

  const timingIsOverdue = isOverdueTimingLabel(contextTimingLabel);
  const contextA11yLabel = `Task: ${contextTaskTitle} · ${contextTimingLabel}`;

  const backdropOpacity = isDark ? 0.72 : 0.36;
  const backdropColor = isDark ? '#000000' : '#1c1740';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // The Modal style just resets margins; layout is handled by contentWrapper.
        modalRoot: {
          margin: 0,
        },
        // Full-screen wrapper so the Skia canvas has a concrete layout parent.
        // All children (confetti layer + card) share this coordinate space.
        contentWrapper: {
          width: SCREEN.width,
          height: SCREEN.height,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: sp.gutter,
        },
        // Confetti renders here — absolutely positioned over the whole wrapper,
        // sitting behind the card (rendered first in tree = lower z-order).
        confettiLayer: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: SCREEN.width,
          height: SCREEN.height,
        },
        card: {
          width: '100%',
          maxWidth: 340,
          borderRadius: r.xl,
          paddingVertical: sp.xl + sp.sm,
          paddingHorizontal: sp.xl,
          backgroundColor: c.surfaceRaised,
          borderWidth: 1.5,
          borderColor: c.accentSurfaceBorder,
          shadowColor: c.shadow,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: isDark ? 0.45 : 0.18,
          shadowRadius: 28,
          elevation: 14,
        },
        emoji: {
          fontSize: 56,
          lineHeight: 64,
          textAlign: 'center',
          marginBottom: sp.md,
        },
        message: {
          fontSize: 17,
          lineHeight: 26,
          fontWeight: '600',
          letterSpacing: -0.2,
          color: c.text,
          textAlign: 'center',
          marginBottom: sp.md,
        },
        contextLineWrap: {
          fontSize: 13,
          lineHeight: 19,
          fontWeight: '500',
          textAlign: 'center',
          marginBottom: sp.xl,
        },
        contextPrefix: {
          color: c.textMuted,
        },
        contextTaskTitle: {
          color: c.text,
        },
        contextSep: {
          color: c.textMuted,
        },
        contextTimingDefault: {
          color: c.textMuted,
        },
        contextTimingOverdue: {
          color: c.danger,
          fontWeight: '700',
        },
        dismissBtn: {
          alignSelf: 'stretch',
          borderRadius: r.md,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.accent,
          borderWidth: 1,
          borderColor: c.accentLight,
        },
        dismissLabel: {
          fontSize: 16,
          fontWeight: '700',
          letterSpacing: 0.2,
          color: c.onAccent,
        },
      }),
    [c, sp, r, isDark],
  );

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onDismiss}
      onBackButtonPress={onDismiss}
      backdropOpacity={backdropOpacity}
      backdropColor={backdropColor}
      animationIn="fadeInUp"
      animationOut="fadeOutDown"
      animationInTiming={280}
      animationOutTiming={240}
      backdropTransitionOutTiming={280}
      useNativeDriverForBackdrop
      avoidKeyboard
      statusBarTranslucent
      style={styles.modalRoot}>
      {/*
        Full-screen wrapper gives the Skia canvas a concrete layout context so
        it can compute its pixel dimensions on Android (without this, the canvas
        may collapse to 0×0 and render nothing).
      */}
      <View style={styles.contentWrapper}>
        {/* Confetti — only rendered for completion/done events, never for overdue reminders */}
        {isCompletion && (
          <View style={styles.confettiLayer} pointerEvents="none">
            <ContinuousConfetti
              width={SCREEN.width}
              height={SCREEN.height}
              // Higher count + tight vertical spacing → no visible gaps between rows
              count={120}
              fallDuration={3200}
              // verticalSpacing controls how far apart confetti rows are.
              // Low value (30) keeps the stream dense and gapless.
              verticalSpacing={30}
              colors={['#FFD700', '#FF69B4', '#00CED1', '#32CD32', '#FF6347', '#A78BFA']}
              fadeOutOnEnd={false}
              autoplay
            />
          </View>
        )}
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.emoji} accessibilityLabel="Reminder emoji">
            {emoji}
          </Text>
          <Text style={styles.message}>{message}</Text>
          <Text
            style={styles.contextLineWrap}
            numberOfLines={2}
            accessibilityLabel={contextA11yLabel}>
            <Text style={styles.contextPrefix}>Task: </Text>
            <Text style={styles.contextTaskTitle}>{contextTaskTitle}</Text>
            <Text style={styles.contextSep}> · </Text>
            <Text
              style={timingIsOverdue ? styles.contextTimingOverdue : styles.contextTimingDefault}>
              {contextTimingLabel}
            </Text>
          </Text>
          <Pressable
            style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.92 }]}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss reminder">
            <Text style={styles.dismissLabel}>Understood</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
