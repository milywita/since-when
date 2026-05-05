import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import auth from '@react-native-firebase/auth';

export default function HomeScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.hello}>Hello World!</Text>
      <TouchableOpacity style={styles.signOutButton} onPress={() => auth().signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hello: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f5f5f5',
    marginBottom: 40,
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  signOutText: {
    color: '#888',
    fontSize: 15,
  },
});
