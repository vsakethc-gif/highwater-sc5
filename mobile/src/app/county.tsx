/**
 * county.tsx — the place picker, shown as a native sheet (brief sections 7 and 8.2):
 * "Use my location", a ZIP code search, and the 8 SC-5 counties.
 *
 * Privacy: GPS coordinates stay on the phone. They're used to find the county and sent only to
 * the public services that answer for that spot. They're never saved.
 */
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { COUNTIES } from '../../../shared/config';
import { placeFromPoint, placeFromZip } from '../../../shared/places';
import { Icon } from '../components/Icon';
import { Button, Pressable } from '../components/ui/Button';
import { ListRow, SectionHeader } from '../components/ui/Layout';
import { Txt } from '../components/ui/Text';
import { useAppState } from '../state';
import { fadeIn, font, haptic, radius, SCREEN_PAD, space, tapTarget, type, useTheme } from '../theme';

export default function CountyPicker() {
  const { c } = useTheme();
  const { place, setPlace } = useAppState();
  const [zip, setZip] = useState('');
  const [message, setMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);

  const done = () => router.back();

  async function useMyLocation() {
    setLocating(true);
    setMessage('');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setDenied(true);
        setMessage('Location is off. Choose a county instead, or turn location on in Settings.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const result = await placeFromPoint(pos.coords.latitude, pos.coords.longitude, 'Your location');
      if (typeof result === 'string') setMessage(result);
      else {
        setPlace(result);
        haptic.select();
        done();
      }
    } catch {
      setMessage('Couldn’t get your location. Choose a county or enter a ZIP code.');
    } finally {
      setLocating(false);
    }
  }

  async function findZip() {
    const result = await placeFromZip(zip);
    if (typeof result === 'string') setMessage(result);
    else {
      setPlace(result);
      haptic.select();
      done();
    }
  }

  return (
    <ScrollView style={{ backgroundColor: c.surface }} contentContainerStyle={{ padding: SCREEN_PAD, paddingTop: space.xxl, gap: space.l }} keyboardShouldPersistTaps="handled">
      <Txt variant="title2" accessibilityRole="header">
        Choose a place
      </Txt>
      <Button label={locating ? 'Finding your location…' : 'Use my location'} icon="LocateFixed" kind="primary" onPress={useMyLocation} loading={locating} />
      <View style={[s.zip, { backgroundColor: c.surfaceSunken }]}>
        <Icon name="Search" size={18} tint={c.inkFaint} />
        <TextInput
          value={zip}
          onChangeText={(t) => setZip(t.replace(/\D/g, '').slice(0, 5))}
          onSubmitEditing={findZip}
          placeholder="ZIP code"
          placeholderTextColor={c.inkFaint}
          keyboardType="number-pad"
          returnKeyType="search"
          maxLength={5}
          accessibilityLabel="ZIP code"
          style={[type.body, { flex: 1, color: c.ink, minHeight: tapTarget }]}
        />
        {zip.length === 5 ? <Button label="Go" kind="text" onPress={findZip} compact /> : null}
      </View>
      {message ? (
        <Animated.View entering={fadeIn} accessibilityLiveRegion="polite" style={{ gap: space.s }}>
          <Txt variant="callout" tone="muted">
            {message}
          </Txt>
          {denied ? <Button label="Open Settings" kind="text" onPress={() => Linking.openSettings()} style={{ alignSelf: 'flex-start' }} /> : null}
        </Animated.View>
      ) : null}
      <View>
        <SectionHeader title="SC-5 counties" />
        {COUNTIES.map((county, i) => {
          const selected = place.kind === 'county' && place.fips === county.fips;
          return (
            <ListRow
              key={county.fips}
              title={`${county.name} County`}
              subtitle={`County seat: ${county.seat.name}`}
              chevron={false}
              last={i === COUNTIES.length - 1}
              trailing={selected ? <Icon name="Check" tint={c.accent} /> : null}
              onPress={() => {
                haptic.select();
                setPlace({ kind: 'county', fips: county.fips });
                done();
              }}
            />
          );
        })}
      </View>
      <Pressable onPress={done} accessibilityRole="button" accessibilityLabel="Close" style={{ alignSelf: 'center' }}>
        <Txt variant="headline" tone="accent" style={{ padding: space.m, fontFamily: font.semibold }}>
          Close
        </Txt>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  zip: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.l, borderRadius: radius.sm },
});
