import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import type { AuthScreenProps } from '../../navigation/types';
import { Screen } from '../../components/ui/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { theme } from '../../theme/themes';

type Props = AuthScreenProps<'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await auth().sendPasswordResetEmail(email.trim());
      setSent(true);
    } catch (error: any) {
      const message = friendlyError(error.code);
      Alert.alert('Reset failed', message);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Screen>
        <View style={styles.inner}>
          <Text style={theme.typography.title}>Check your inbox</Text>
          <Text style={[theme.typography.body, styles.bodySpacing]}>
            We sent a reset link to{' '}
            <Text style={styles.emailHighlight}>{email}</Text>. Follow the link
            in that email to set a new password.
          </Text>
          <AppButton
            title="Back to Sign In"
            onPress={() => navigation.goBack()}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inner}>
          <Text style={theme.typography.title}>Reset password</Text>
          <Text style={[theme.typography.subtitle, styles.subtitleSpacing]}>
            Enter your email and we'll send you a reset link.
          </Text>

          <AppInput
            placeholder="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <AppButton
            title="Send Reset Link"
            onPress={handleReset}
            loading={loading}
          />

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.link}>
            <Text style={theme.typography.small}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function friendlyError(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/user-not-found':
      return 'No account found with that email.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
  },
  subtitleSpacing: {
    marginBottom: theme.spacing.xl + theme.spacing.lg,
  },
  bodySpacing: {
    marginBottom: theme.spacing.xl + theme.spacing.lg,
  },
  emailHighlight: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  link: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
});
