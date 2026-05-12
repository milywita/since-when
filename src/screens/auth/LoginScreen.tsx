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
import { useTheme } from '../../theme/ThemeContext';

type Props = AuthScreenProps<'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const thm = useTheme();
  const { colors: c, spacing: sp, typography: t } = thm;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await auth().signInWithEmailAndPassword(email.trim(), password);
    } catch (error: any) {
      Alert.alert('Login failed', friendlyError(error.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.inner, { paddingHorizontal: sp.xxl }]}>
          <Text style={t.title}>Since When</Text>
          <Text style={[t.subtitle, { marginBottom: sp.xl + sp.lg }]}>
            Sign in to confront your avoidance.
          </Text>

          <AppInput
            placeholder="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <AppInput
            placeholder="Password"
            secureTextEntry
            autoComplete="current-password"
            value={password}
            onChangeText={setPassword}
          />

          <AppButton title="Sign In" onPress={handleLogin} loading={loading} />

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={[styles.link, { paddingVertical: sp.sm }]}>
            <Text style={t.small}>Forgot password?</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: c.surfaceSoft, marginVertical: sp.sm }]} />

          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            style={[styles.link, { paddingVertical: sp.sm }]}>
            <Text style={t.small}>
              No account yet?{' '}
              <Text style={{ color: c.text, fontWeight: '600' }}>Create one</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function friendlyError(code: string): string {
  switch (code) {
    case 'auth/invalid-email': return 'That email address is not valid.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Incorrect email or password.';
    case 'auth/user-disabled': return 'This account has been disabled.';
    case 'auth/too-many-requests': return 'Too many failed attempts. Try again later.';
    default: return 'Something went wrong. Please try again.';
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center' },
  link: { alignItems: 'center' },
  divider: { height: 1 },
});
