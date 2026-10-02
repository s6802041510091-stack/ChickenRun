import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Game } from './src/screens/game';
export default function App() { return <SafeAreaProvider><Game /></SafeAreaProvider>; }
