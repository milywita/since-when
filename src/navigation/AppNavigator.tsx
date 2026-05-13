import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';
import HomeScreen from '../screens/HomeScreen';
import TogetherLobbyScreen from '../screens/TogetherLobbyScreen';
import SessionScreen from '../screens/SessionScreen';
import SettingsScreen from '../screens/SettingsScreen';
import UsernameSetupScreen from '../screens/UsernameSetupScreen';
import { getOrCreateUserProfile } from '../services/userService';
import { useTheme } from '../theme/ThemeContext';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  const { colors: c } = useTheme();
  const [checking, setChecking] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);

  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) { setChecking(false); return; }
    getOrCreateUserProfile(uid)
      .then(profile => setNeedsUsername(!profile.username || profile.username.trim() === ''))
      .catch(() => {
        setNeedsUsername(true);
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <View style={[styles.loading, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.text} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.background },
      }}
      initialRouteName={needsUsername ? 'UsernameSetup' : 'Home'}>
      <Stack.Screen name="UsernameSetup" component={UsernameSetupScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="TogetherLobby" component={TogetherLobbyScreen} />
      <Stack.Screen name="Session" component={SessionScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
