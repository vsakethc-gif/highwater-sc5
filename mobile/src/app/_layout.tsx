/**
 * _layout.tsx (root) — runs first when the app opens.
 *   1. Keeps the splash screen up while fonts load and the phone's saved data is read.
 *   2. Plugs the phone into the shared code (installNativePlatform, see src/platform.ts).
 *   3. Fades from the splash screen into the app.
 * Then Expo Router shows either the one-time onboarding or the tabs, plus the pushed screens
 * (gauge and alert details) and sheets (place picker, scenario picker, data sources).
 */
// Import only the font weights we use (the packages' main files would pull in all of them).
import { Newsreader_500Medium } from '@expo-google-fonts/newsreader/500Medium';
import { Newsreader_600SemiBold } from '@expo-google-fonts/newsreader/600SemiBold';
// Atkinson Hyperlegible Next (Braille Institute): made to be easy to read for people with low vision.
import { AtkinsonHyperlegibleNext_400Regular } from '@expo-google-fonts/atkinson-hyperlegible-next/400Regular';
import { AtkinsonHyperlegibleNext_500Medium } from '@expo-google-fonts/atkinson-hyperlegible-next/500Medium';
import { AtkinsonHyperlegibleNext_600SemiBold } from '@expo-google-fonts/atkinson-hyperlegible-next/600SemiBold';
import { AtkinsonHyperlegibleNext_700Bold } from '@expo-google-fonts/atkinson-hyperlegible-next/700Bold';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router/stack';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { installNativePlatform } from '../platform';
import { AppStateProvider } from '../state';
import { radius, useTheme } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 400 });

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_500Medium,
    AtkinsonHyperlegibleNext_600SemiBold,
    AtkinsonHyperlegibleNext_700Bold,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
  });
  const [platformReady, setPlatformReady] = useState(false);

  useEffect(() => {
    installNativePlatform().finally(() => setPlatformReady(true));
  }, []);

  // If fonts fail to load, carry on with the system font rather than hanging on the splash screen.
  const ready = (fontsLoaded || fontError) && platformReady;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppStateProvider>
          <RootStack />
        </AppStateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { c } = useTheme();
  const sheet = {
    presentation: 'formSheet' as const,
    sheetGrabberVisible: true,
    sheetCornerRadius: radius.sheet,
    contentStyle: { backgroundColor: c.surface },
  };
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="gauge/[id]" />
      <Stack.Screen name="alert/[id]" />
      <Stack.Screen name="gallery" />
      <Stack.Screen name="county" options={{ ...sheet, sheetAllowedDetents: [0.75, 1] }} />
      <Stack.Screen name="scenario" options={{ ...sheet, sheetAllowedDetents: [0.75, 1] }} />
      <Stack.Screen name="sources" options={{ ...sheet, sheetAllowedDetents: [0.5, 1] }} />
    </Stack>
  );
}
