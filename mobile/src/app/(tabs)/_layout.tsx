/**
 * (tabs)/_layout.tsx — the five tabs: Status, Map, Route, Report, More.
 * First-time users are sent to the short onboarding first (shown once).
 */
// SDK 58 doesn't re-export Redirect from 'expo-router/link', so it's imported from its own file.
import { Redirect } from 'expo-router/build/link/Redirect';
import { Tabs } from 'expo-router/js-tabs';
import { platform } from '../../../../shared/platform';
import { TabBar } from '../../components/TabBar';
import { TABS_ON } from '../../features';
import { ONBOARDED_KEY } from '../onboarding';

export default function TabsLayout() {
  if (platform().storage.getItem(ONBOARDED_KEY) !== '1') return <Redirect href="/onboarding" />;
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, animation: 'none' }}>
      <Tabs.Screen name="index" options={{ title: 'Status' }} />
      {/* href: null hides a tab that's switched off in features.ts */}
      <Tabs.Screen name="map" options={{ title: 'Map', href: TABS_ON.map ? undefined : null }} />
      <Tabs.Screen name="route" options={{ title: 'Route', href: TABS_ON.route ? undefined : null }} />
      <Tabs.Screen name="report" options={{ title: 'Report', href: TABS_ON.report ? undefined : null }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
