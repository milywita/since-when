import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, AppState } from 'react-native';
import Modal from 'react-native-modal';
import { useTheme, useThemeToggle } from '../../theme/ThemeContext';
import { POPUP_AUTO_DISMISS_REMINDER_MS } from '../../constants/reminderConfig';

const SCREEN = Dimensions.get('window');

export type PartnerReactionModalProps = {
  visible: boolean;
  /** Display name of the partner who sent the reaction (e.g. "Mari"). */
  fromDisplayName: string;
  /** Title of the task the reaction was sent for. */
  taskTitle: string;
  /** The reaction text (e.g. "Killing it!"). */
  message: string;
  onDismiss: () => void;
};

export function PartnerReactionModal({
  visible,
  fromDisplayName,
  taskTitle,
  message,
  onDismiss,
}: PartnerReactionModalProps) {
  const { colors: c, spacing: sp, radius: r } = useTheme();
  const { isDark } = useThemeToggle();

  // Keep a ref so the AppState callback always calls the latest onDismiss without
  // re-subscribing the listener on every render (onDismiss is a stable useCallback
  // in SessionScreen, but the ref pattern guards against any future changes).
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);

  // Auto-dismiss and background-dismiss while the modal is open.
  // - Timer: partner reactions stay visible as long as long solo reminders (6 min) so
  //   the user has time to notice them even if they glance away briefly.
  // - AppState: immediately dismiss if the user backgrounds the app so a stale popup
  //   does not greet them when they return later.
  useEffect(() => {
    if (!visible) { return; }

    const timer = setTimeout(() => onDismissRef.current(), POPUP_AUTO_DISMISS_REMINDER_MS);
    const appStateSub = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') { onDismissRef.current(); }
    });

    return () => {
      clearTimeout(timer);
      appStateSub.remove();
    };
  }, [visible]);

  const backdropOpacity = isDark ? 0.72 : 0.36;
  const backdropColor = isDark ? '#000000' : '#1c1740';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Same zero-margin root as FancyReminderModal so backdrop covers everything.
        modalRoot: {
          margin: 0,
        },
        // Full-screen wrapper centres the card.
        contentWrapper: {
          width: SCREEN.width,
          height: SCREEN.height,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: sp.gutter,
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
          fontSize: 48,
          lineHeight: 58,
          textAlign: 'center',
          marginBottom: sp.sm,
        },
        // "Mari reacted to 'Reply to email'"
        headline: {
          fontSize: 14,
          fontWeight: '500',
          letterSpacing: -0.1,
          color: c.textSoft,
          textAlign: 'center',
          marginBottom: sp.md,
        },
        headlineName: {
          color: c.text,
          fontWeight: '700',
        },
        headlineTask: {
          color: c.text,
          fontWeight: '600',
        },
        // The reaction message itself ("Killing it!")
        message: {
          fontSize: 20,
          lineHeight: 28,
          fontWeight: '700',
          letterSpacing: -0.3,
          color: c.accent,
          textAlign: 'center',
          marginBottom: sp.xl,
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
      <View style={styles.contentWrapper}>
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.emoji} accessibilityLabel="Reaction emoji">
            💬
          </Text>

          {/* Headline: "Mari reacted to 'Reply to email'" */}
          <Text style={styles.headline} numberOfLines={3}>
            <Text style={styles.headlineName}>{fromDisplayName}</Text>
            <Text> reacted to </Text>
            <Text style={styles.headlineTask}>"{taskTitle}"</Text>
          </Text>

          {/* The reaction text itself */}
          <Text style={styles.message} numberOfLines={2}>
            {message}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.92 }]}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss reaction">
            <Text style={styles.dismissLabel}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
