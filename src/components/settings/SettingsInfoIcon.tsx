import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export type SettingsInfoIconProps = {
  /** Shown as the modal title. */
  hintTitle: string;
  /** Body copy in the modal (can be multiple sentences). */
  hintBody: string;
  accessibilityLabel?: string;
};

/**
 * Small (i) control that opens a read-only helper modal. Use for longer settings explanations.
 */
export function SettingsInfoIcon({ hintTitle, hintBody, accessibilityLabel }: SettingsInfoIconProps) {
  const { colors: c, spacing: sp, radius: r } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `More information: ${hintTitle}`}
        style={[
          styles.iconBtn,
          {
            borderColor: c.borderStrong,
            backgroundColor: c.surface,
          },
        ]}>
        <Text style={[styles.iconLetter, { color: c.accent }]}>i</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: c.backdropModal }]}
            onPress={() => setOpen(false)}
            accessibilityLabel="Dismiss"
          />
          <View style={[styles.cardLayer, { paddingHorizontal: sp.lg }]} pointerEvents="box-none">
            <View
              style={[
                styles.card,
                {
                  backgroundColor: c.surfaceRaised,
                  borderColor: c.border,
                  borderRadius: r.lg,
                  padding: sp.lg,
                },
              ]}>
              <Text style={[styles.cardTitle, { color: c.text }]}>{hintTitle}</Text>
              <ScrollView style={styles.cardScroll} showsVerticalScrollIndicator={false}>
                <Text style={[styles.cardBody, { color: c.textMuted }]}>{hintBody}</Text>
              </ScrollView>
              <TouchableOpacity
                style={[styles.okBtn, { backgroundColor: c.accent }]}
                onPress={() => setOpen(false)}
                activeOpacity={0.85}>
                <Text style={[styles.okBtnText, { color: c.onAccent }]}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLetter: {
    fontSize: 13,
    fontWeight: '700',
    fontStyle: 'italic',
    marginTop: -1,
  },
  modalRoot: {
    flex: 1,
  },
  cardLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  card: {
    maxHeight: '82%',
    borderWidth: 1,
    gap: 14,
  },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  cardScroll: { maxHeight: 320 },
  cardBody: { fontSize: 15, lineHeight: 22 },
  okBtn: {
    alignSelf: 'stretch',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  okBtnText: { fontSize: 16, fontWeight: '600' },
});
