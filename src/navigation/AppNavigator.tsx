import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';
import HomeScreen from '../screens/HomeScreen';
import TogetherLobbyScreen from '../screens/TogetherLobbyScreen';
import SessionScreen from '../screens/SessionScreen';
import UsernameSetupScreen from '../screens/UsernameSetupScreen';
import { getOrCreateUserProfile } from '../services/userService';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  const [checking, setChecking] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);

  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) { setChecking(false); return; }
    getOrCreateUserProfile(uid)
      .then(profile => setNeedsUsername(!profile.username || profile.username.trim() === ''))
      .catch(() => {
        // If the profile can't be fetched (e.g. first-ever launch before rules
        // are deployed), default to showing the username setup screen — it is
        // the safer choice and will create the profile doc on save.
        setNeedsUsername(true);
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#f5f5f5" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={needsUsername ? 'UsernameSetup' : 'Home'}>
      <Stack.Screen name="UsernameSetup" component={UsernameSetupScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="TogetherLobby" component={TogetherLobbyScreen} />
      <Stack.Screen name="Session" component={SessionScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
