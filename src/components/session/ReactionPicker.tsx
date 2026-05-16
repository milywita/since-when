import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import RNModal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemeToggle } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/themes';
import {
  PARTNER_REACTION_TEMPLATES,
  type PartnerReactionTemplate,
  type PartnerReactionTone,
} from '../../constants/partnerReactionTemplates';

// ─── Tone metadata ────────────────────────────────────────────────────────────

/** Visual identity for each reaction tone — icon + short label shown on each reply. */
const TONE_META: Record<PartnerReactionTone, { icon: string; label: string }> = {
  formal:    { icon: '🖊️', label: 'Formal'    },
  mystic:    { icon: '🌙',  label: 'Mystic'    },
  cute:      { icon: '🎀',  label: 'Softie'    },
  sarcastic: { icon: '😈',  label: 'Sarcastic' },
};

/** Order in which tones are shown in the reply list. */
const TONE_ORDER: PartnerReactionTone[] = ['formal', 'mystic', 'cute', 'sarcastic'];

type TonedReply = { tone: PartnerReactionTone; text: string };

/** Flattens all replies from all tones into a single ordered list. */
function getAllReplies(cat: PartnerReactionTemplate): TonedReply[] {
  const out: TonedReply[] = [];
  for (const tone of TONE_ORDER) {
    for (const text of cat.replies[tone]) {
      out.push({ tone, text });
    }
  }
  return out;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'category' | 'replies';

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * Called when the user taps a reply.
   * The picker closes itself on success.
   */
  onSelect: (text: string) => Promise<void>;
  /** False when the per-task reaction quota (3) is exhausted. */
  canReact: boolean;
  /** How many reactions the user has already sent for this task. */
  reactionCount: number;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ReactionPicker({
  visible,
  onClose,
  onSelect,
  canReact,
  reactionCount,
}: Props) {
  const { colors: c, spacing: sp, radius: r } = useTheme();
  const { isDark } = useThemeToggle();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('category');
  const [selectedCat, setSelectedCat] = useState<PartnerReactionTemplate | null>(null);
  const [sending, setSending] = useState(false);

  const remaining = 3 - reactionCount;
  const backdropOpacity = isDark ? 0.65 : 0.32;
  const backdropColor = isDark ? '#000000' : '#1c1740';

  // Reset internal state every time the sheet closes
  useEffect(() => {
    if (!visible) {
      setStep('category');
      setSelectedCat(null);
      setSending(false);
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  function handleCategoryPick(cat: PartnerReactionTemplate) {
    setSelectedCat(cat);
    setStep('replies');
  }

  function goBack() {
    setStep('category');
    setSelectedCat(null);
  }

  async function handleReplyPick(text: string) {
    if (sending) { return; }
    setSending(true);
    try {
      await onSelect(text);
      onClose();
    } finally {
      setSending(false);
    }
  }

  // All replies across all tones for the selected category
  const allReplies: TonedReply[] = useMemo(
    () => (selectedCat ? getAllReplies(selectedCat) : []),
    [selectedCat],
  );

  const styles = useMemo(() => buildStyles(c, sp, r, isDark), [c, sp, r, isDark]);

  return (
    <RNModal
      isVisible={visible}
      onBackdropPress={handleClose}
      // Android back: navigate up one step before fully closing
      onBackButtonPress={step === 'replies' ? goBack : handleClose}
      backdropOpacity={backdropOpacity}
      backdropColor={backdropColor}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={260}
      animationOutTiming={220}
      useNativeDriverForBackdrop
      statusBarTranslucent
      style={styles.modalRoot}>

      {/* ── Bottom sheet ──────────────────────────────────────────── */}
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>

        {/* ── Header ────────────────────────────────────────────────── */}
        <View style={styles.header}>

          {step === 'replies' ? (
            // Back button (step 2)
            <TouchableOpacity onPress={goBack} hitSlop={12} style={styles.backBtn}>
              <Text style={[styles.backText, { color: c.accent }]}>← Back</Text>
            </TouchableOpacity>
          ) : (
            // Main title (step 1)
            <Text style={[styles.headerTitle, { color: c.text }]}>Send a reaction</Text>
          )}

          {/* Category context in step 2 header */}
          {step === 'replies' && selectedCat && (
            <View style={styles.catLabel}>
              <Text style={styles.catLabelEmoji}>{selectedCat.emoji}</Text>
              <Text style={[styles.catLabelTitle, { color: c.text }]} numberOfLines={1}>
                {selectedCat.title}
              </Text>
            </View>
          )}

          {/* "X left" badge (step 1 only) */}
          {step === 'category' && canReact && (
            <View style={[styles.badge, { backgroundColor: c.accentSurface, borderColor: c.accentSurfaceBorder }]}>
              <Text style={[styles.badgeText, { color: c.accent }]}>
                {remaining} left
              </Text>
            </View>
          )}

          {/* Close button — always visible */}
          <TouchableOpacity onPress={handleClose} hitSlop={14}>
            <Text style={[styles.closeX, { color: c.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: c.borderInner }]} />

        {/* ── Content area ──────────────────────────────────────────── */}

        {!canReact ? (

          // ── Reaction limit reached ──────────────────────────────────
          <View style={styles.limitWrap}>
            <Text style={[styles.limitTitle, { color: c.text }]}>Reaction limit reached</Text>
            <Text style={[styles.limitBody, { color: c.textSoft }]}>
              3 reactions per task per session.
            </Text>
            <TouchableOpacity
              style={[styles.okBtn, { backgroundColor: c.surface, borderColor: c.border }]}
              onPress={handleClose}>
              <Text style={[styles.okBtnText, { color: c.text }]}>OK</Text>
            </TouchableOpacity>
          </View>

        ) : step === 'category' ? (

          // ── Step 1: Category picker ─────────────────────────────────
          <View style={styles.catList}>
            {PARTNER_REACTION_TEMPLATES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catRow, { backgroundColor: c.surface, borderColor: c.border }]}
                onPress={() => handleCategoryPick(cat)}
                activeOpacity={0.75}>
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
                <View style={styles.catBody}>
                  <Text style={[styles.catTitle, { color: c.text }]}>{cat.title}</Text>
                  <Text style={[styles.catDesc, { color: c.textSoft }]} numberOfLines={1}>
                    {cat.description}
                  </Text>
                </View>
                <Text style={[styles.catChevron, { color: c.textDim }]}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

        ) : (

          // ── Step 2: All replies across all tones ────────────────────
          // Wrapped in ScrollView in case the list is taller than the sheet.
          <ScrollView
            style={styles.replyScroll}
            contentContainerStyle={styles.replyList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {allReplies.map((item, idx) => {
              const meta = TONE_META[item.tone];
              return (
                <TouchableOpacity
                  // idx suffix handles multiple sarcastic replies with identical text keys
                  key={`${item.tone}-${idx}`}
                  style={[
                    styles.replyBtn,
                    { backgroundColor: c.surface, borderColor: c.border },
                    sending && styles.replyBtnDisabled,
                  ]}
                  onPress={() => handleReplyPick(item.text)}
                  disabled={sending}
                  activeOpacity={0.75}>

                  {/* Tone icon — fixed width keeps text aligned across all rows */}
                  <Text style={styles.toneIcon}>{meta.icon}</Text>

                  {/* Reply text */}
                  <Text style={[styles.replyText, { color: c.text }]}>
                    {item.text}
                  </Text>

                  {/* Tone label pill */}
                  <View style={[styles.tonePill, { backgroundColor: c.surfaceSoft, borderColor: c.borderInner }]}>
                    <Text style={[styles.tonePillText, { color: c.textMuted }]}>
                      {meta.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

        )}
      </View>
    </RNModal>
  );
}


// ─── Style factory ────────────────────────────────────────────────────────────

function buildStyles(
  c: AppTheme['colors'],
  sp: AppTheme['spacing'],
  r: AppTheme['radius'],
  isDark: boolean,
) {
  return StyleSheet.create({
    // Sheet slides up from bottom; modal fills full screen width.
    modalRoot: {
      margin: 0,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: c.surfaceRaised,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderBottomWidth: 0,
      paddingTop: sp.lg,
      // Limit height so very long reply lists don't overflow the screen
      maxHeight: '88%',
      shadowColor: isDark ? '#000000' : '#1c1740',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: isDark ? 0.5 : 0.14,
      shadowRadius: 20,
      elevation: 16,
    },

    // ── Header ──────────────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp.xl,
      paddingBottom: sp.md,
      gap: sp.sm,
    },
    headerTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    backBtn: {
      marginRight: 2,
    },
    backText: {
      fontSize: 15,
      fontWeight: '600',
    },
    catLabel: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: 4,
    },
    catLabelEmoji: {
      fontSize: 18,
    },
    catLabelTitle: {
      fontSize: 16,
      fontWeight: '600',
      flexShrink: 1,
    },
    badge: {
      borderRadius: 100,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    closeX: {
      fontSize: 17,
      fontWeight: '400',
      lineHeight: 22,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      marginBottom: sp.sm,
    },

    // ── Category list (step 1) ───────────────────────────────────────
    catList: {
      paddingHorizontal: sp.lg,
      paddingBottom: sp.sm,
      gap: sp.sm,
    },
    catRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sp.md,
      borderRadius: r.md,
      borderWidth: 1,
      paddingVertical: 12,
      paddingHorizontal: sp.md,
    },
    catEmoji: {
      fontSize: 22,
      width: 30,
      textAlign: 'center',
    },
    catBody: {
      flex: 1,
      gap: 2,
    },
    catTitle: {
      fontSize: 15,
      fontWeight: '600',
    },
    catDesc: {
      fontSize: 12,
    },
    catChevron: {
      fontSize: 22,
      fontWeight: '300',
      lineHeight: 26,
    },

    // ── Reply list (step 2) ──────────────────────────────────────────
    replyScroll: {
      // flex: 1 would overflow the sheet; let ScrollView size to content
    },
    replyList: {
      paddingHorizontal: sp.lg,
      paddingBottom: sp.sm,
      gap: sp.sm,
    },
    replyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sp.sm,
      borderRadius: r.md,
      borderWidth: 1,
      paddingVertical: 12,
      paddingHorizontal: sp.md,
    },
    replyBtnDisabled: {
      opacity: 0.55,
    },
    // Fixed-width tone emoji column so reply text aligns across rows
    toneIcon: {
      fontSize: 18,
      width: 28,
      textAlign: 'center',
      flexShrink: 0,
    },
    replyText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 20,
    },
    // Small pill label on the right: "Formal", "Mystic", etc.
    tonePill: {
      borderRadius: 100,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 2,
      flexShrink: 0,
    },
    tonePillText: {
      fontSize: 11,
      fontWeight: '600',
    },

    // ── Limit reached ────────────────────────────────────────────────
    limitWrap: {
      paddingHorizontal: sp.xl,
      paddingVertical: sp.xl,
      alignItems: 'center',
      gap: sp.md,
    },
    limitTitle: {
      fontSize: 16,
      fontWeight: '700',
    },
    limitBody: {
      fontSize: 14,
      textAlign: 'center',
    },
    okBtn: {
      borderRadius: r.md,
      borderWidth: 1,
      paddingVertical: 13,
      paddingHorizontal: sp.xxl,
      marginTop: sp.sm,
    },
    okBtnText: {
      fontSize: 15,
      fontWeight: '600',
    },
  });
}
