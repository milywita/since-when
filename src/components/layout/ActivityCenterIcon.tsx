import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme, useThemeToggle } from '../../theme/ThemeContext';
import { useActivityCenter } from '../../context/ActivityCenterContext';
import { ActivityCenterModal } from '../activity/ActivityCenterModal';

// ─── Envelope/inbox icon ──────────────────────────────────────────────────────
//
// Shape: a rounded rectangle (envelope body) with a downward-pointing triangle
// overlaid at the top edge to suggest a folded flap — universally readable
// as "mail / inbox / message center".

function InboxIcon({ color }: { color: string }) {
  return (
    <View style={inboxStyles.wrap}>
      {/* Envelope body: rounded rectangle border */}
      <View style={[inboxStyles.body, { borderColor: color }]} />
      {/* Flap fold: downward triangle sitting at the top of the body */}
      <View style={[inboxStyles.flap, { borderTopColor: color }]} />
    </View>
  );
}

const inboxStyles = StyleSheet.create({
  // Slightly compact vs header moon/gear so it doesn’t read oversized
  wrap: { width: 18, height: 12 },
  body: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1.5,
    borderRadius: 2,
  },
  flap: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});

/**
 * Mail-style icon with an unread-count badge.
 * Rendered inline in the HomeScreen header (mail → theme → settings).
 */
export function ActivityCenterIcon() {
  const { colors: c } = useTheme();
  const { isDark } = useThemeToggle();
  const { unreadCount } = useActivityCenter();
  const [open, setOpen] = useState(false);

  /** Same as settings gear: solid accent in light mode, muted in dark. */
  const iconColor = isDark ? c.accentMuted : c.accent;

  return (
    <>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          unreadCount > 0
            ? `Activity center, ${unreadCount} unread`
            : 'Activity center'
        }>
        <InboxIcon color={iconColor} />
        {unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: c.danger }]}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : String(unreadCount)}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <ActivityCenterModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 36,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 11,
  },
});
