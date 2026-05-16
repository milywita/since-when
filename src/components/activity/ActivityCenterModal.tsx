import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemeToggle } from '../../theme/ThemeContext';
import { useActivityCenter, type ActivityItem } from '../../context/ActivityCenterContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(sentAt: number): string {
  const diffMs = Date.now() - sentAt;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) { return 'Just now'; }
  if (diffMin < 60) { return `${diffMin}m ago`; }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) { return `${diffHr}h ago`; }
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// ─── Single activity row ──────────────────────────────────────────────────────

type RowProps = {
  item: ActivityItem;
  isUnread: boolean;
};

function ActivityRow({ item, isUnread }: RowProps) {
  const { colors: c, spacing: sp } = useTheme();

  return (
    <View
      style={[
        rowStyles.row,
        { paddingHorizontal: sp.lg, paddingVertical: 14, borderBottomColor: c.borderInner },
      ]}>
      {isUnread && (
        <View style={[rowStyles.dot, { backgroundColor: c.accent }]} />
      )}
      <View style={rowStyles.body}>
        <Text style={[rowStyles.from, { color: c.text }]} numberOfLines={1}>
          {item.fromDisplayName}
        </Text>
        <Text style={[rowStyles.reaction, { color: c.accent }]} numberOfLines={2}>
          "{item.text}"
        </Text>
        <Text style={[rowStyles.task, { color: c.textSoft }]} numberOfLines={1}>
          on "{item.taskTitle}"
        </Text>
      </View>
      <Text style={[rowStyles.time, { color: c.textDim }]}>
        {formatRelativeTime(item.sentAt)}
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: 7,
    marginRight: 10,
    flexShrink: 0,
  },
  body: { flex: 1, gap: 3 },
  from: { fontSize: 13, fontWeight: '600' },
  reaction: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  task: { fontSize: 12 },
  time: { fontSize: 11, marginLeft: 10, marginTop: 4, flexShrink: 0 },
});

// ─── Modal ────────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ActivityCenterModal({ visible, onClose }: Props) {
  const { colors: c, spacing: sp, radius: r } = useTheme();
  const { isDark } = useThemeToggle();
  const insets = useSafeAreaInsets();
  const { items, unreadCount, markAllRead } = useActivityCenter();

  function handleOpen() {
    if (unreadCount > 0) { markAllRead(); }
  }

  // "unread boundary" timestamp — items above this are still unread when we open
  const unreadBoundaryAt = useMemo(() => {
    if (unreadCount === 0 || items.length === 0) { return 0; }
    const firstUnreadIdx = items.length - unreadCount;
    return items[firstUnreadIdx]?.sentAt ?? 0;
  }, [items, unreadCount]);

  const backdropOpacity = isDark ? 0.65 : 0.32;
  const backdropColor = isDark ? '#000000' : '#1c1740';

  return (
    <Modal
      isVisible={visible}
      onModalShow={handleOpen}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      // Swipe right anywhere on the panel to dismiss
      swipeDirection="right"
      onSwipeComplete={onClose}
      swipeThreshold={80}
      backdropOpacity={backdropOpacity}
      backdropColor={backdropColor}
      animationIn="slideInRight"
      animationOut="slideOutRight"
      animationInTiming={260}
      animationOutTiming={220}
      useNativeDriverForBackdrop
      hideModalContentWhileAnimating
      statusBarTranslucent
      style={modalStyles.root}>
      <View
        style={[
          modalStyles.sheet,
          {
            backgroundColor: c.surfaceRaised,
            borderLeftColor: c.border,
            borderLeftWidth: 1,
            // Ensure content sits below status bar and above home indicator
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <View
          style={[
            modalStyles.header,
            {
              borderBottomColor: c.border,
              paddingHorizontal: sp.lg,
              paddingVertical: 14,
              backgroundColor: c.surfaceRaised,
            },
          ]}>
          <Text style={[modalStyles.title, { color: c.text }]}>Activity</Text>
          {unreadCount > 0 && (
            <View style={[modalStyles.badge, { backgroundColor: c.accent, borderRadius: r.pill }]}>
              <Text style={modalStyles.badgeText}>
                {unreadCount > 9 ? '9+' : String(unreadCount)}
              </Text>
            </View>
          )}
          {/* Large, clearly tappable close button */}
          <Pressable
            onPress={onClose}
            hitSlop={16}
            style={[
              modalStyles.closeBtn,
              { backgroundColor: c.surface, borderColor: c.border, borderRadius: r.pill },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close activity center">
            <Text style={[modalStyles.closeX, { color: c.text }]}>✕</Text>
          </Pressable>
        </View>

        {/* ── Swipe hint ──────────────────────────────────────────── */}
        <View style={modalStyles.swipeHint}>
          <View style={[modalStyles.swipeHandle, { backgroundColor: c.borderStrong }]} />
        </View>

        {/* ── Item list / empty state ──────────────────────────── */}
        {items.length === 0 ? (
          <View style={[modalStyles.empty, { paddingHorizontal: sp.xl }]}>
            <Text style={[modalStyles.emptyTitle, { color: c.text }]}>Nothing here yet.</Text>
            <Text style={[modalStyles.emptyBody, { color: c.textSoft }]}>
              Partner reactions and nudges from Together sessions will appear here.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={modalStyles.list}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={modalStyles.listContent}>
            {items.map(item => (
              <ActivityRow
                key={item.id}
                item={item}
                isUnread={item.sentAt >= unreadBoundaryAt && unreadBoundaryAt > 0}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  // Modal fills the right side of the screen — backdrop on the left is tappable
  root: {
    margin: 0,
    justifyContent: 'flex-end',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  sheet: {
    width: '82%',
    maxWidth: 340,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: '700', flex: 1 },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  // Clearly visible close button — larger hit area, bordered pill
  closeBtn: {
    width: 34,
    height: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  closeX: { fontSize: 15, fontWeight: '600' },
  // Horizontal drag handle so users know the panel is swipeable
  swipeHint: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  swipeHandle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    opacity: 0.4,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
