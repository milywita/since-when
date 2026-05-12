import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { getOrCreateUserProfile, setUsername } from '../services/userService';
import type { AppScreenProps } from '../navigation/types';
import { Screen } from '../components/ui/Screen';
import { AppButton } from '../components/ui/AppButton';
import { AppInput, usernameInputStyle } from '../components/ui/AppInput';
import { useTheme } from '../theme/ThemeContext';

type Props = AppScreenProps<'UsernameSetup'>;

export default function UsernameSetupScreen({ navigation }: Props) {
  const { colors: c, spacing: sp, radius: r, typography: t } = useTheme();
  const [username, setUsernameValue] = useState('');
  const [saving, setSaving] = useState(false);

  const trimmed = username.trim();
  const isValid = trimmed.length >= 2 && trimmed.length <= 20 && /^[a-zA-Z0-9_]+$/.test(trimmed);

  async function handleConfirm() {
    if (!isValid) {
      Alert.alert(
        'Invalid username',
        'Username must be 2–20 characters and contain only letters, numbers, or underscores.',
      );
      return;
    }
    setSaving(true);
    try {
      const uid = auth().currentUser?.uid;
      if (!uid) { throw new Error('Not signed in.'); }
      await getOrCreateUserProfile(uid);
      await setUsername(uid, trimmed);
      navigation.replace('Home');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save username.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen safeArea edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={[styles.flex, { paddingHorizontal: sp.xl, paddingTop: 60, paddingBottom: 32 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.top}>
          <Text style={t.heading}>Pick a username</Text>
          <Text style={[t.subtitle, { color: c.textSoft, lineHeight: 22 }]}>
            This is how others will see you in Together sessions. You can't change it later.
          </Text>
          <AppInput
            style={usernameInputStyle()}
            placeholder="e.g. procrastinator42"
            placeholderTextColor={c.textDim}
            value={username}
            onChangeText={setUsernameValue}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />
          <Text style={[styles.hint, { color: c.textSoft }]}>
            2–20 characters, letters/numbers/underscores only.
          </Text>
        </View>

        <AppButton
          title="Let's go"
          onPress={handleConfirm}
          loading={saving}
          disabled={!isValid || saving}
          style={[
            { borderRadius: r.md, paddingVertical: sp.lg, marginTop: 0, marginBottom: 0 },
            (!isValid || saving) && styles.ctaDisabled,
          ]}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'space-between' },
  top: { gap: 14 },
  hint: { fontSize: 12 },
  ctaDisabled: { opacity: 0.3 },
});
