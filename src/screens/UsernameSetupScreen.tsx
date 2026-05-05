import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import { getOrCreateUserProfile, setUsername } from '../services/userService';
import type { AppScreenProps } from '../navigation/types';

type Props = AppScreenProps<'UsernameSetup'>;

export default function UsernameSetupScreen({ navigation }: Props) {
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
      // Ensure the profile doc exists (creates it with personalInviteCode if needed)
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
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.top}>
          <Text style={styles.title}>Pick a username</Text>
          <Text style={styles.subtitle}>
            This is how others will see you in Together sessions. You can't change it later.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. procrastinator42"
            placeholderTextColor="#444"
            value={username}
            onChangeText={setUsernameValue}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />
          <Text style={styles.hint}>
            2–20 characters, letters/numbers/underscores only.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, (!isValid || saving) && styles.btnDisabled]}
          onPress={handleConfirm}
          disabled={!isValid || saving}>
          {saving
            ? <ActivityIndicator color="#0d0d0d" />
            : <Text style={styles.btnText}>Let's go</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  top: {
    gap: 14,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f5f5f5',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 16 : 13,
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginTop: 8,
  },
  hint: {
    fontSize: 12,
    color: '#333',
  },
  btn: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.3,
  },
  btnText: {
    color: '#0d0d0d',
    fontSize: 16,
    fontWeight: '600',
  },
});
