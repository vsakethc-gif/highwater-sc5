/**
 * Map tab — the whole district on a native map (Apple Maps on iPhone, Google Maps on Android),
 * laid out like Apple Maps and Citymapper (REDESIGN.md 5.2):
 *
 *   - The map fills the screen. A search pill floats at the top ("Find a county"), and a column of
 *     round glass buttons floats on the right (layers, recenter).
 *   - A sheet is always there at the bottom. Resting low ("peek") it shows a one-line summary of the
 *     district ("2 warnings · 5 rivers rising · 3 reports") and the layer chips. Tap anything on the
 *     map and it rises to half height with that thing's details, crossfading from what was there.
 *   - River gauges are round markers: the water height inside, a ring in the flood color (blue ring =
 *     it has an official flood stage), and a small arrow when it's rising or falling. The one you pick
 *     grows and shows its name; the rest dim so it stands out. Alert areas get a soft fill in their
 *     level's color and a crisp outline.
 *   - The camera flies to whatever you pick, and the markers pop in when the map first loads.
 *   - Everything outside SC-5 is dimmed, and each county is tinted in its status color.
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Dimensions, Platform, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polygon, type LatLng, type Region } from 'react-native-maps';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COUNTIES } from '../../../../shared/config';
import type { CountyCollection } from '../../../../shared/data/static';
import type { Alert, Gauge } from '../../../../shared/data/types';
import { feet, gaugeName } from '../../../../shared/format';
import { classifyAlert } from '../../../../shared/hazards/alertMap';
import { HAZARDS } from '../../../../shared/hazards/hazards';
import { LEVELS, type Level } from '../../../../shared/hazards/levels';
import { districtAverage, scoreBand, type Tract } from '../../../../shared/hazards/vulnerability';
import { categoryInfo } from '../../../../shared/reports/categories';
import type { Report } from '../../../../shared/reports/client';
import { countyName } from '../../../../shared/places';
import { clockTime, relativeTime } from '../../../../shared/time';
import { Sparkline } from '../../components/data/Charts';
import { CATEGORY, stageSentence, TREND } from '../../components/data/Rows';
import { Icon, type IconName } from '../../components/Icon';
import { MapSheet, PEEK, type Detent } from '../../components/map/MapSheet';
import { googleDark, googleLight, RAMP, RAMP_LABELS, RAMP_NONE, rampColor, withAlpha } from '../../components/map/mapStyle';
import { Glass } from '../../components/status/Module';
import { tabBarClearance } from '../../components/TabBar';
import { Button, Pressable } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Chips';
import { Notice, Skeleton } from '../../components/ui/Feedback';
import { ListRow } from '../../components/ui/Layout';
import { SimulationBanner } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Text';
import { useMapData, type MapData } from '../../hooks/useMapData';
import { useAppState } from '../../state';
import district from '../../data/district.json';
import { duration, font, haptic, popIn, radius, sceneInk, SCREEN_PAD, space, tapTarget, useTheme } from '../../theme';

type ScoreLayer = 'vulnerability_score' | 'exposure_score' | 'priority_score' | null;
type Selection =
  | { kind: 'tract'; tract: Tract }
  | { kind: 'gauge'; gauge: Gauge }
  | { kind: 'alert'; alert: Alert }
  | { kind: 'report'; report: Report }
  | { kind: 'county'; fips: string }
  | { kind: 'layers' }
  | null;
type LayerState = { alerts: boolean; gauges: boolean; reports: boolean };

const SCORE_LABEL: Record<Exclude<ScoreLayer, null>, string> = { vulnerability_score: 'Vulnerability', exposure_score: 'Flood zones', priority_score: 'Priority' };
const SCORE_HELP: Record<Exclude<ScoreLayer, null>, string> = {
  vulnerability_score: 'Where more people are 65 or older, have no car, live below the poverty line, or have a disability, compared with the rest of SC-5.',
  exposure_score: 'How much of the neighborhood is inside FEMA’s high-risk flood zone, compared with the rest of SC-5.',
  priority_score: 'Vulnerability and flood exposure together: where people with the fewest resources are most exposed.',
};

/** GeoJSON [lon, lat] rings → map coordinates. */
const toLatLng = (ring: number[][]): LatLng[] => ring.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
function polygonParts(g: GeoJSON.Polygon | GeoJSON.MultiPolygon): number[][][][] {
  return g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
}

function regionFor(features: CountyCollection['features']): Region {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (const f of features) for (const part of polygonParts(f.geometry)) for (const [lon, lat] of part[0]) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }
  return { latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2, latitudeDelta: (maxLat - minLat) * 1.25, longitudeDelta: (maxLon - minLon) * 1.25 };
}

/** A region around one point, nudged so the point sits in the upper half (above the half-height sheet). */
function regionAround(lat: number, lon: number, span = 0.22): Region {
  return { latitude: lat - span * 0.28, longitude: lon, latitudeDelta: span, longitudeDelta: span };
}

/** "Census tract 610.05" from a tract's GEOID. */
const tractName = (geoid: string) => `Census tract ${geoid.slice(5).replace(/^0+/, '').replace(/(\d+)(\d\d)$/, '$1.$2').replace(/\.00$/, '')}`;

export default function MapScreen() {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error, reload } = useMapData();
  const map = useRef<ComponentRef<typeof MapView>>(null);
  const [layers, setLayers] = useState<LayerState>({ alerts: true, gauges: true, reports: true });
  const [score, setScore] = useState<ScoreLayer>(null);
  const [zoomedIn, setZoomedIn] = useState(false);
  const [selected, setSelected] = useState<Selection>(null);
  const [detent, setDetent] = useState<Detent>(0);
  const [moved, setMoved] = useState(false);

  const home = useMemo(() => (data ? regionFor(data.counties.features) : null), [data]);
  const flyTo = (r: Region) => map.current?.animateToRegion(r, 650);

  /** Pick something: the sheet rises to show it and the camera flies to it. */
  const select = (s: Selection) => {
    haptic.select();
    setSelected(s);
    // Half height: enough room for the details, with the map still visible above them.
    setDetent(s?.kind === 'layers' && detent === 2 ? 2 : 1);
    if (!s || !data) return;
    if (s.kind === 'gauge') flyTo(regionAround(s.gauge.lat, s.gauge.lon));
    if (s.kind === 'report') flyTo(regionAround(s.report.lat, s.report.lon, 0.12));
    if (s.kind === 'county') {
      const f = data.counties.features.filter((x) => x.properties.fips === s.fips);
      if (f.length) {
        const r = regionFor(f);
        flyTo({ ...r, latitude: r.latitude - r.latitudeDelta * 0.25 });
      }
    }
  };
  const clear = () => {
    setSelected(null);
    setDetent(0);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {home ? (
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          initialRegion={home}
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          customMapStyle={Platform.OS === 'android' ? (isDark ? googleDark : googleLight) : undefined}
          userInterfaceStyle={isDark ? 'dark' : 'light'}
          showsUserLocation
          showsPointsOfInterests={false}
          showsCompass={false}
          toolbarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          onRegionChangeComplete={(r) => {
            setMoved(true);
            setZoomedIn(r.latitudeDelta < 0.6);
          }}
          onPress={(e) => {
            // A tap on empty map clears the selection (taps on shapes and markers are handled by them).
            if ((e.nativeEvent as { action?: string }).action !== 'marker-press') clear();
          }}
          mapPadding={{ top: insets.top + 72, bottom: tabBarClearance(insets.bottom) + PEEK, left: 0, right: 0 }}
        >
          {data ? <Layers data={data} layers={layers} score={score} zoomedIn={zoomedIn} selected={selected} onSelect={select} /> : null}
        </MapView>
      ) : null}

      {!data && !error ? (
        <View style={[StyleSheet.absoluteFill, s.loading, { backgroundColor: c.bg }]} pointerEvents="none" accessible accessibilityLabel="Loading the district map">
          <Skeleton height={220} width="80%" radius={radius.lg} />
          <Txt variant="callout" tone="muted">
            Drawing the district…
          </Txt>
        </View>
      ) : null}

      {/* Floating controls: the search pill on top, round glass buttons on the right. */}
      <View style={[s.top, { paddingTop: insets.top }]} pointerEvents="box-none">
        <SimulationBanner />
        <View style={s.topRow} pointerEvents="box-none">
          <Pressable
            onPress={() => {
              haptic.select();
              setSelected(null);
              setDetent(2);
            }}
            accessibilityRole="search"
            accessibilityLabel="Find a county"
            style={{ flex: 1 }}
          >
            <Glass floating rounded={radius.pill} style={s.search}>
              <Icon name="Search" size={18} tint={sceneInk.secondary} />
              <Txt variant="callout" color={sceneInk.secondary} style={{ flex: 1 }}>
                Find a county
              </Txt>
              <Icon name="MapPin" size={16} tint={sceneInk.meta} />
            </Glass>
          </Pressable>
        </View>
        <View style={s.controls} pointerEvents="box-none">
          <RoundButton icon="Layers" label="Map layers and key" active={selected?.kind === 'layers'} onPress={() => select(selected?.kind === 'layers' ? null : { kind: 'layers' })} />
          {moved && home ? (
            <Animated.View entering={popIn()} exiting={FadeOut.duration(140)}>
              <RoundButton
                icon="Crosshair"
                label="Show the whole district"
                onPress={() => {
                  haptic.select();
                  flyTo(home);
                  setMoved(false);
                }}
              />
            </Animated.View>
          ) : null}
        </View>
      </View>

      {error ? (
        <View style={{ position: 'absolute', left: SCREEN_PAD, right: SCREEN_PAD, top: insets.top + 130 }}>
          <Notice title={error} detail="The Status tab may still work." onRetry={reload} />
        </View>
      ) : null}

      {data && score ? (
        <Animated.View entering={FadeIn.duration(duration.base)} exiting={FadeOut.duration(duration.fast)} style={[s.legend, { bottom: tabBarClearance(insets.bottom) + PEEK + space.m }]} pointerEvents="none">
          <ScoreKey score={score} />
        </Animated.View>
      ) : null}

      {data ? (
        <MapSheet
          detent={detent}
          onDetent={(d) => {
            setDetent(d);
            if (d === 0 && selected?.kind === 'layers') setSelected(null);
          }}
          header={<SheetHeader data={data} selected={selected} onClear={clear} layers={layers} onLayers={setLayers} score={score} onScore={setScore} />}
        >
          {/* The body crossfades whenever what it shows changes. */}
          <Animated.View key={selectionKey(selected)} entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(120)} style={{ flex: 1 }}>
            <SheetBody selection={selected} data={data} score={score} onSelect={select} />
          </Animated.View>
        </MapSheet>
      ) : null}
    </View>
  );
}

function selectionKey(sel: Selection): string {
  if (!sel) return 'district';
  if (sel.kind === 'tract') return `t-${sel.tract.geoid}`;
  if (sel.kind === 'gauge') return `g-${sel.gauge.site_id}`;
  if (sel.kind === 'alert') return `a-${sel.alert.id}`;
  if (sel.kind === 'report') return `r-${sel.report.id}`;
  if (sel.kind === 'county') return `c-${sel.fips}`;
  return 'layers';
}

function RoundButton({ icon, label, onPress, active }: { icon: IconName; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} scaleTo={0.95}>
      <Glass floating rounded={tapTarget / 2 + 2} style={[s.round, active && { borderColor: sceneInk.primary }]}>
        <Icon name={icon} size={20} tint={sceneInk.primary} filled={active} />
      </Glass>
    </Pressable>
  );
}

/* ----------------------------------------------------------------------------------------------
 * Drawing on the map
 * -------------------------------------------------------------------------------------------- */

// The dimming mask: a box around the Carolinas with the district cut out of it.
const OUTSIDE: LatLng[] = [
  { latitude: 37.5, longitude: -86 },
  { latitude: 37.5, longitude: -76 },
  { latitude: 30.5, longitude: -76 },
  { latitude: 30.5, longitude: -86 },
];
const DISTRICT: LatLng[] = toLatLng(district.outline);

function Layers({ data, layers, score, zoomedIn, selected, onSelect }: { data: MapData; layers: LayerState; score: ScoreLayer; zoomedIn: boolean; selected: Selection; onSelect: (s: Selection) => void }) {
  const { c, isDark } = useTheme();
  const tractShapes = useMemo(
    () => data.tracts.features.flatMap((f) => polygonParts(f.geometry).map((part, i) => ({ key: `${f.properties.geoid}-${i}`, tract: f.properties, outer: toLatLng(part[0]), holes: part.slice(1).map(toLatLng) }))),
    [data.tracts],
  );
  const countyShapes = useMemo(() => data.counties.features.flatMap((f) => polygonParts(f.geometry).map((part, i) => ({ key: `${f.properties.fips}-${i}`, fips: f.properties.fips, outer: toLatLng(part[0]) }))), [data.counties]);
  // Custom marker views are drawn as pictures. While they change (popping in, growing when picked),
  // let them redraw for a moment, then freeze them again so panning stays smooth.
  const [settling, setSettling] = useState(true);
  const selKey = selectionKey(selected);
  useEffect(() => {
    setSettling(true);
    const id = setTimeout(() => setSettling(false), 900);
    return () => clearTimeout(id);
  }, [zoomedIn, data, selKey]);
  const alerts = useMemo(() => {
    if (data.c.alerts instanceof Error) return [];
    const out: { key: string; alert: Alert; level: Level; outer: LatLng[] }[] = [];
    for (const a of data.c.alerts.data) {
      const { level } = classifyAlert(a);
      if (level === 0 || !a.geometry || (a.geometry.type !== 'Polygon' && a.geometry.type !== 'MultiPolygon')) continue;
      polygonParts(a.geometry).forEach((part, i) => out.push({ key: `${a.id}-${i}`, alert: a, level, outer: toLatLng(part[0]) }));
    }
    return out.sort((x, y) => x.level - y.level);
  }, [data.c.alerts]);
  // At district zoom, only gauges with an official flood stage (the ones that can change a status).
  const gauges = (data.c.gauges instanceof Error ? [] : data.c.gauges.data).filter((g) => zoomedIn || g.has_official_stage || g.flood_category);
  const reports = data.reports instanceof Error ? [] : data.reports;
  const focusGauge = selected?.kind === 'gauge' ? selected.gauge.site_id : null;
  const focusAlert = selected?.kind === 'alert' ? selected.alert.id : null;
  const focusCounty = selected?.kind === 'county' ? selected.fips : null;

  return (
    <>
      {score
        ? tractShapes.map((t) => (
            <Polygon
              key={t.key}
              coordinates={t.outer}
              holes={t.holes}
              fillColor={withAlpha(rampColor(t.tract[score]), selected?.kind === 'tract' && selected.tract.geoid !== t.tract.geoid ? 0.3 : 0.55)}
              strokeColor={selected?.kind === 'tract' && selected.tract.geoid === t.tract.geoid ? c.ink : 'transparent'}
              strokeWidth={selected?.kind === 'tract' && selected.tract.geoid === t.tract.geoid ? 2 : 0}
              tappable
              onPress={() => onSelect({ kind: 'tract', tract: t.tract })}
            />
          ))
        : null}
      {/* Dim everything outside the district, like a printed map's inset. */}
      <Polygon coordinates={OUTSIDE} holes={[DISTRICT]} fillColor={withAlpha(c.bg, isDark ? 0.66 : 0.7)} strokeColor="transparent" strokeWidth={0} />
      {countyShapes.map((k) => {
        const level = data.countyStatus[k.fips]?.level ?? 0;
        const focus = focusCounty === k.fips;
        return (
          <Polygon
            key={k.key}
            coordinates={k.outer}
            fillColor={score ? 'transparent' : withAlpha(c.levels[level].fg, focus ? 0.24 : level === 0 ? 0.05 : 0.14)}
            strokeColor={focus ? c.ink : withAlpha(c.ink, 0.35)}
            strokeWidth={focus ? 2.5 : 1}
            tappable={!score}
            onPress={() => onSelect({ kind: 'county', fips: k.fips })}
          />
        );
      })}
      <Polygon coordinates={DISTRICT} fillColor="transparent" strokeColor={c.accent} strokeWidth={2} />
      {district.labels.map((l) => {
        const level = data.countyStatus[l.fips]?.level ?? 0;
        return (
          <Marker key={`label-${l.fips}`} coordinate={{ latitude: l.lat, longitude: l.lon }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={settling} onPress={() => onSelect({ kind: 'county', fips: l.fips })} accessibilityLabel={`${l.name} County, ${LEVELS[level].name}`}>
            <View style={[s.countyLabel, { backgroundColor: withAlpha(c.bg, 0.72) }]}>
              <View style={[s.countyDot, { backgroundColor: level > 0 ? c.levels[level].fg : c.inkFaint }]} />
              <Txt variant="caption" color={c.ink} style={s.countyName}>
                {l.name}
              </Txt>
            </View>
          </Marker>
        );
      })}
      {layers.alerts
        ? alerts.map((a) => {
            const focus = focusAlert === a.alert.id;
            const dim = focusAlert !== null && !focus;
            return (
              <Polygon
                key={a.key}
                coordinates={a.outer}
                fillColor={withAlpha(c.levels[a.level].fg, focus ? 0.32 : dim ? 0.08 : 0.18)}
                strokeColor={withAlpha(c.levels[a.level].fg, dim ? 0.4 : 1)}
                strokeWidth={focus ? 3.5 : 2}
                tappable
                onPress={() => onSelect({ kind: 'alert', alert: a.alert })}
              />
            );
          })
        : null}
      {layers.gauges
        ? gauges.map((g, i) => (
            <Marker
              key={g.site_id}
              coordinate={{ latitude: g.lat, longitude: g.lon }}
              onPress={() => onSelect({ kind: 'gauge', gauge: g })}
              tracksViewChanges={settling}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={focusGauge === g.site_id ? 10 : g.flood_category ? 5 : 1}
              accessibilityLabel={`${gaugeName(g.name)} gauge: ${g.latest ? feet(g.latest.value) : 'no recent reading'}${g.flood_category ? `, ${CATEGORY[g.flood_category].label}` : ''}`}
            >
              <GaugeMarker g={g} index={i} focus={focusGauge === g.site_id} dim={focusGauge !== null && focusGauge !== g.site_id} />
            </Marker>
          ))
        : null}
      {layers.reports
        ? reports.map((r) => (
            <Marker key={r.id} coordinate={{ latitude: r.lat, longitude: r.lon }} onPress={() => onSelect({ kind: 'report', report: r })} tracksViewChanges={settling} accessibilityLabel={`${categoryInfo(r.category).label}, unverified report`}>
              <View style={[s.reportDot, { backgroundColor: c.levels[1].bg, borderColor: c.levels[1].fg }, selected?.kind === 'report' && selected.report.id !== r.id && { opacity: 0.4 }]}>
                <Icon name={categoryInfo(r.category).icon} size={12} tint={c.levels[1].fg} />
              </View>
            </Marker>
          ))
        : null}
    </>
  );
}

/**
 * A river gauge on the map: a round marker with the water height inside and a ring in its flood color
 * (none: a blue ring when it has an official flood stage, a faint ring when it doesn't). A small arrow
 * badge shows rising or falling. Picked: it grows and shows its name. Others dim while one is picked.
 */
function GaugeMarker({ g, index, focus, dim }: { g: Gauge; index: number; focus: boolean; dim: boolean }) {
  const { c } = useTheme();
  const cat = g.flood_category ? CATEGORY[g.flood_category] : null;
  const ring = cat ? c.levels[cat.level].fg : g.has_official_stage ? c.accent : c.inkFaint;
  const trend = TREND[g.trend];
  const size = focus ? 52 : 40;
  const entering = useMemo(() => popIn(Math.min(index, 12) * 25), [index]);
  return (
    <Animated.View entering={entering} style={{ alignItems: 'center', opacity: dim ? 0.4 : 1, padding: 4 }}>
      <View style={[s.gauge, { width: size, height: size, borderRadius: size / 2, borderColor: ring, backgroundColor: cat ? c.levels[cat.level].bg : c.surface }]}>
        <Txt variant="caption" color={cat ? c.levels[cat.level].fg : c.ink} style={[s.gaugeValue, focus && { fontSize: 14 }]}>
          {g.latest ? g.latest.value.toFixed(1) : '–'}
        </Txt>
        {focus ? (
          <Txt variant="caption" color={c.inkMuted} style={s.gaugeUnit}>
            ft
          </Txt>
        ) : null}
      </View>
      {trend.icon && g.latest && g.trend !== 'steady' ? (
        <View style={[s.trendBadge, { backgroundColor: ring, right: focus ? 0 : 2 }]}>
          <Icon name={trend.icon} size={10} tint={c.bg} />
        </View>
      ) : null}
      {focus ? (
        <View style={[s.gaugeName, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <Txt variant="footnote" color={c.ink} numberOfLines={1} style={{ fontFamily: font.semibold }}>
            {gaugeName(g.name)}
          </Txt>
        </View>
      ) : null}
    </Animated.View>
  );
}

/* ----------------------------------------------------------------------------------------------
 * The sheet
 * -------------------------------------------------------------------------------------------- */

/** One-line summary of the whole district, for the sheet at rest. */
function summary(data: MapData): { level: Level; line: string } {
  const inDistrict = (a: Alert) => a.county_fips.some((f) => COUNTIES.some((k) => k.fips === f));
  const alerts = data.c.alerts instanceof Error ? null : data.c.alerts.data.filter(inDistrict);
  const warnings = alerts ? alerts.filter((a) => classifyAlert(a).level >= 2).length : 0;
  const watches = alerts ? alerts.filter((a) => classifyAlert(a).level === 1).length : 0;
  const gauges = data.c.gauges instanceof Error ? null : data.c.gauges.data;
  const rising = gauges ? gauges.filter((g) => g.trend === 'rising').length : 0;
  const flooding = gauges ? gauges.filter((g) => g.flood_category && g.flood_category !== 'action').length : 0;
  const reports = data.reports instanceof Error ? 0 : data.reports.length;
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const parts = [
    alerts === null ? 'Alerts didn’t load' : warnings ? plural(warnings, 'warning') : watches ? plural(watches, 'watch', 'watches') : 'No warnings',
    flooding ? `${plural(flooding, 'river')} in flood` : null,
    gauges === null ? 'Rivers didn’t load' : rising ? `${plural(rising, 'river')} rising` : 'No rivers rising',
    reports ? plural(reports, 'report') : null,
  ].filter(Boolean);
  const level = Math.max(...COUNTIES.map((k) => data.countyStatus[k.fips]?.level ?? 0)) as Level;
  return { level, line: parts.join(' · ') };
}

function SheetHeader({ data, selected, onClear, layers, onLayers, score, onScore }: { data: MapData; selected: Selection; onClear: () => void; layers: LayerState; onLayers: (l: LayerState) => void; score: ScoreLayer; onScore: (s: ScoreLayer) => void }) {
  const { c } = useTheme();
  const sum = summary(data);
  const title = !selected || selected.kind === 'layers' ? (selected ? 'Layers and key' : 'SC-5 district') : selected.kind === 'tract' ? tractName(selected.tract.geoid) : selected.kind === 'gauge' ? gaugeName(selected.gauge.name) : selected.kind === 'alert' ? selected.alert.event : selected.kind === 'report' ? categoryInfo(selected.report.category).label : `${countyName(selected.fips)} County`;
  const sub = !selected ? sum.line : selected.kind === 'gauge' ? `River gauge · ${countyName(selected.gauge.county_fips)} County` : selected.kind === 'alert' ? 'Official National Weather Service alert' : selected.kind === 'report' ? 'Community report · unverified' : selected.kind === 'tract' ? `Neighborhood · ${countyName(selected.tract.county_fips)} County` : selected.kind === 'county' ? 'From official alerts and river gauges' : 'Choose what the map shows';
  const toggle = (k: keyof LayerState) => onLayers({ ...layers, [k]: !layers[k] });
  const pickScore = (v: Exclude<ScoreLayer, null>) => onScore(score === v ? null : v);
  return (
    <View style={{ gap: space.m, paddingBottom: space.m }}>
      <View style={s.headRow}>
        <Animated.View key={title} entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <Txt variant="title3" numberOfLines={1} style={{ flexShrink: 1 }} accessibilityRole="header">
              {title}
            </Txt>
            {!selected && sum.level > 0 ? <StatusBadge level={sum.level} size="s" /> : null}
          </View>
          <Txt variant="footnote" numberOfLines={1}>
            {sub}
          </Txt>
        </Animated.View>
        {selected ? (
          <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="Close details" scaleTo={0.95} hitSlop={6}>
            <View style={[s.close, { backgroundColor: c.surfaceRaised }]}>
              <Icon name="X" size={18} tint={c.inkMuted} />
            </View>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} accessibilityLabel="Map layers">
        <MapChip icon="TriangleAlert" label="Alerts" on={layers.alerts} onPress={() => toggle('alerts')} />
        <MapChip icon="Waves" label="Rivers" on={layers.gauges} onPress={() => toggle('gauges')} />
        <MapChip icon="Megaphone" label="Reports" on={layers.reports} onPress={() => toggle('reports')} />
        <View style={[s.chipDivider, { backgroundColor: c.hairline }]} />
        <MapChip icon="House" label="Vulnerable" on={score === 'vulnerability_score'} onPress={() => pickScore('vulnerability_score')} />
        <MapChip icon="Waves" label="Flood zones" on={score === 'exposure_score'} onPress={() => pickScore('exposure_score')} />
        <MapChip icon="Grid2x2" label="Priority" on={score === 'priority_score'} onPress={() => pickScore('priority_score')} />
      </ScrollView>
    </View>
  );
}

function MapChip({ icon, label, on, onPress }: { icon: IconName; label: string; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      scaleTo={0.96}
    >
      <View style={[s.chip, { backgroundColor: on ? c.accentSoft : c.surfaceRaised, borderColor: on ? c.accent : c.hairline }]}>
        <Icon name={on ? 'Check' : icon} size={15} tint={on ? c.accent : c.inkMuted} />
        <Txt variant="footnote" color={on ? c.ink : c.inkMuted} style={{ fontFamily: font.semibold }}>
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}

/** The neighborhood color key, floating above the sheet while a neighborhood layer is on. */
function ScoreKey({ score }: { score: Exclude<ScoreLayer, null> }) {
  return (
    <Glass floating rounded={radius.md} style={s.keyCard}>
      <Txt variant="footnote" color={sceneInk.primary} style={{ fontFamily: font.semibold }}>
        {`${SCORE_LABEL[score]}, 0–100`}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 2, marginTop: space.xs }}>
        {RAMP.map((col) => (
          <View key={col} style={{ flex: 1, height: 8, borderRadius: 2, backgroundColor: col }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Txt variant="caption" color={sceneInk.meta} style={{ fontSize: 11 }}>
          Lower
        </Txt>
        <Txt variant="caption" color={sceneInk.meta} style={{ fontSize: 11 }}>
          Higher
        </Txt>
      </View>
    </Glass>
  );
}

/** A comparison bar: here vs. the SC-5 average. */
function CompareRow({ label, here, avg }: { label: string; here: number | null; avg: number }) {
  const { c } = useTheme();
  const max = Math.max(here ?? 0, avg, 1);
  return (
    <View style={{ gap: 4, marginBottom: space.m }} accessible accessibilityLabel={`${label}: ${here === null ? 'unknown' : `${here.toFixed(1)} percent`}, SC-5 average ${avg.toFixed(1)} percent`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Txt variant="callout">{label}</Txt>
        <Txt variant="callout" style={{ fontVariant: ['tabular-nums'] }}>{here === null ? '—' : `${here.toFixed(1)}%`}</Txt>
      </View>
      <View style={[s.bar, { backgroundColor: c.surfaceRaised }]}>
        {here !== null ? <Animated.View entering={FadeIn.duration(300)} style={{ width: `${(here / max) * 100}%`, height: 8, borderRadius: 4, backgroundColor: c.accent }} /> : null}
        <View style={[s.avgMark, { left: `${(avg / max) * 100}%`, backgroundColor: c.ink }]} />
      </View>
      <Txt variant="footnote">{`SC-5 average ${avg.toFixed(1)}% (white mark)`}</Txt>
    </View>
  );
}

function SheetBody({ selection, data, score, onSelect }: { selection: Selection; data: MapData; score: ScoreLayer; onSelect: (s: Selection) => void }) {
  const { c } = useTheme();
  const pad = { paddingHorizontal: SCREEN_PAD, paddingBottom: space.x4 };
  if (!selection) {
    // The district at a glance: every county with its status. Tap one to fly there.
    const gauges = data.c.gauges instanceof Error ? [] : data.c.gauges.data;
    const order = [...COUNTIES].sort((a, b) => (data.countyStatus[b.fips]?.level ?? 0) - (data.countyStatus[a.fips]?.level ?? 0) || a.name.localeCompare(b.name));
    return (
      <ScrollView contentContainerStyle={pad}>
        {order.map((k, i) => {
          const st = data.countyStatus[k.fips];
          const raised = gauges.filter((g) => g.county_fips === k.fips && g.flood_category).length;
          return (
            <ListRow
              key={k.fips}
              title={`${k.name} County`}
              subtitle={st.active.length ? st.active.map((h) => HAZARDS[h.hazard].label).join(', ') + (raised ? ` · ${raised} gauge${raised > 1 ? 's' : ''} raised` : '') : 'No active alerts'}
              trailing={<StatusBadge level={st.level} size="s" />}
              onPress={() => onSelect({ kind: 'county', fips: k.fips })}
              last={i === order.length - 1}
            />
          );
        })}
        <Txt variant="footnote" style={{ marginTop: space.m }}>
          From alerts and river gauges (not rain). Status has the full picture.
        </Txt>
      </ScrollView>
    );
  }
  if (selection.kind === 'county') return <CountyDetail fips={selection.fips} data={data} />;
  if (selection.kind === 'layers') {
    return (
      <ScrollView contentContainerStyle={[pad, { gap: space.m }]}>
        <KeyRow swatch={<View style={[s.swatch, { borderWidth: 2, borderColor: c.levels[2].fg, backgroundColor: withAlpha(c.levels[2].fg, 0.18) }]} />} text="Alert area (color = level)" />
        <KeyRow swatch={<View style={[s.keyGauge, { borderColor: c.accent, backgroundColor: c.surface }]} />} text="River gauge · height in feet" />
        <KeyRow swatch={<View style={[s.keyGauge, { borderColor: c.levels[2].fg, backgroundColor: c.levels[2].bg }]} />} text="River in flood (ring = how high)" />
        <KeyRow swatch={<View style={[s.keyGauge, { borderColor: c.inkFaint, backgroundColor: c.surface }]} />} text="No flood stage (zoom in to see)" />
        <KeyRow swatch={<View style={[s.reportDot, { backgroundColor: c.levels[1].bg, borderColor: c.levels[1].fg }]} />} text="Report (unverified)" />
        <Txt variant="headline" style={{ marginTop: space.s }}>
          Neighborhood colors
        </Txt>
        <Txt variant="callout" tone="muted">
          {score ? SCORE_HELP[score] : 'Off. Tap Vulnerable, Flood zones, or Priority above.'}
        </Txt>
        {score
          ? RAMP.map((col, i) => <KeyRow key={col} swatch={<View style={[s.swatch, { backgroundColor: col }]} />} text={RAMP_LABELS[i]} />)
          : null}
        {score ? <KeyRow swatch={<View style={[s.swatch, { backgroundColor: RAMP_NONE }]} />} text="Insufficient data" /> : null}
      </ScrollView>
    );
  }
  if (selection.kind === 'tract') {
    const all = data.tracts.features.map((f) => f.properties);
    const t = selection.tract;
    const scoreBlock = (label: string, v: number | null) => (
      <View style={[s.scoreBlock, { backgroundColor: c.surfaceRaised }]}>
        <Txt variant="footnote">{label}</Txt>
        <Txt variant="numberL">{v === null ? '—' : String(v)}</Txt>
        <Txt variant="footnote">{scoreBand(v)}</Txt>
      </View>
    );
    return (
      <ScrollView contentContainerStyle={pad}>
        <Txt variant="callout" tone="muted">{`About ${t.population.toLocaleString()} people`}</Txt>
        {t.data_quality !== 'ok' ? (
          <Txt variant="callout" style={{ marginTop: space.m }}>Insufficient data: too few people or households here (for example a college dorm or a prison) for the percentages to mean much.</Txt>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.s, marginVertical: space.l }}>
            {scoreBlock('Vulnerability', t.vulnerability_score)}
            {scoreBlock('Flood exposure', t.exposure_score)}
            {scoreBlock('Priority', t.priority_score)}
          </View>
        )}
        <CompareRow label="Age 65 and older" here={t.pct_65plus} avg={districtAverage(all, 'pct_65plus')} />
        <CompareRow label="Households without a car" here={t.pct_no_vehicle} avg={districtAverage(all, 'pct_no_vehicle', 'households')} />
        <CompareRow label="Below the poverty line" here={t.pct_poverty} avg={districtAverage(all, 'pct_poverty')} />
        <CompareRow label="With a disability" here={t.pct_disability} avg={districtAverage(all, 'pct_disability')} />
        <CompareRow label="Land in FEMA’s high-risk flood zone" here={t.pct_sfha} avg={districtAverage(all, 'pct_sfha')} />
        <Txt variant="footnote">Scores compare this neighborhood with the other SC-5 tracts (higher = more than most). Census ACS 2020–2024 estimates have margins of error, especially in small areas.</Txt>
      </ScrollView>
    );
  }
  if (selection.kind === 'gauge') {
    const g = selection.gauge;
    const width = Dimensions.get('window').width;
    const cat = g.flood_category ? CATEGORY[g.flood_category] : null;
    const trend = TREND[g.trend];
    return (
      <ScrollView contentContainerStyle={[pad, { gap: space.m }]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.m }}>
          <Txt variant="numberXL">{g.latest ? feet(g.latest.value) : '—'}</Txt>
          <View style={{ paddingBottom: space.s, gap: space.xs }}>
            {cat ? <StatusBadge level={cat.level} size="s" /> : null}
            {g.latest && trend.icon ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <Icon name={trend.icon} size={16} tint={c.inkMuted} />
                <Txt variant="callout" tone="muted">{trend.label}</Txt>
              </View>
            ) : null}
          </View>
        </View>
        {stageSentence(g) ? null : <Txt variant="callout" tone="muted">{g.has_official_stage ? 'No recent reading' : 'No official flood stage'}</Txt>}
        {g.recent_series.length > 1 ? <Sparkline series={g.recent_series} width={width - SCREEN_PAD * 2 - 8} height={64} reference={g.stages?.minor ?? null} /> : null}
        <Txt variant="footnote">{`${g.latest ? `Read ${clockTime(g.latest.time)} (${relativeTime(g.latest.time)})` : 'No recent reading'} · provisional USGS data`}</Txt>
        <Button label="Open the river gauge" icon="Gauge" kind="primary" onPress={() => router.push({ pathname: '/gauge/[id]', params: { id: g.site_id } })} />
      </ScrollView>
    );
  }
  if (selection.kind === 'alert') {
    const a = selection.alert;
    const { hazard, level } = classifyAlert(a);
    return (
      <ScrollView contentContainerStyle={[pad, { gap: space.m }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <StatusBadge level={level} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Icon name={HAZARDS[hazard].icon} size={18} tint={c.inkMuted} />
            <Txt variant="callout" tone="muted">{HAZARDS[hazard].label}</Txt>
          </View>
        </View>
        <Txt variant="callout">{a.headline}</Txt>
        <Txt variant="footnote">{`${LEVELS[level].meaning}${a.ends ? ` Until ${clockTime(a.ends)}.` : ''}`}</Txt>
        <Button label="Read the official alert" icon="ArrowRight" kind="primary" onPress={() => router.push({ pathname: '/alert/[id]', params: { id: a.id } })} />
      </ScrollView>
    );
  }
  const r = selection.report;
  return (
    <ScrollView contentContainerStyle={[pad, { gap: space.m }]}>
      <Txt variant="callout">{r.description ?? 'No note added.'}</Txt>
      <Txt variant="footnote">{`${countyName(r.county_fips)} County · reported ${relativeTime(r.created_at)}${r.confirm_count ? ` · ${r.confirm_count} said it’s still there` : ''}`}</Txt>
      <Txt variant="footnote">Community reports are unverified and are not sent to any agency.</Txt>
    </ScrollView>
  );
}

function KeyRow({ swatch, text }: { swatch: React.ReactNode; text: string }) {
  return (
    <View style={s.keyRow}>
      <View style={{ width: 28, alignItems: 'center' }}>{swatch}</View>
      <Txt variant="callout" style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

/** A county: its status from alerts and gauges, and a shortcut to its full Status page. */
function CountyDetail({ fips, data }: { fips: string; data: MapData }) {
  const { setPlace } = useAppState();
  const st = data.countyStatus[fips];
  const gauges = data.c.gauges instanceof Error ? [] : data.c.gauges.data.filter((g) => g.county_fips === fips);
  const raised = gauges.filter((g) => g.flood_category).length;
  const rising = gauges.filter((g) => g.trend === 'rising').length;
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN_PAD, paddingBottom: space.x4, gap: space.m }}>
      <StatusBadge level={st.level} />
      <Txt variant="callout">{st.active.length ? `Active: ${st.active.map((h) => HAZARDS[h.hazard].label).join(', ')}.` : 'No active official alerts here right now.'}</Txt>
      <View style={{ flexDirection: 'row', gap: space.s }}>
        <Fact value={String(gauges.length)} label={gauges.length === 1 ? 'river gauge' : 'river gauges'} />
        <Fact value={String(rising)} label="rising" />
        <Fact value={String(raised)} label="at action or above" />
      </View>
      <Button
        label={`See Status for ${countyName(fips)} County`}
        icon="ArrowRight"
        kind="primary"
        onPress={() => {
          setPlace({ kind: 'county', fips });
          router.navigate('/');
        }}
      />
    </ScrollView>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  const { c } = useTheme();
  return (
    <View style={[s.scoreBlock, { backgroundColor: c.surfaceRaised }]}>
      <Txt variant="numberL">{value}</Txt>
      <Txt variant="footnote">{label}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center', gap: space.l },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: { flexDirection: 'row', paddingHorizontal: space.l, paddingTop: space.s },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 48, paddingHorizontal: space.l },
  controls: { alignSelf: 'flex-end', paddingRight: space.l, paddingTop: space.m, gap: space.s },
  round: { width: tapTarget + 4, height: tapTarget + 4, alignItems: 'center', justifyContent: 'center' },
  legend: { position: 'absolute', left: space.l },
  keyCard: { padding: space.m, width: 180 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.m, paddingHorizontal: SCREEN_PAD },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: space.s, paddingHorizontal: SCREEN_PAD, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 36, paddingHorizontal: space.m, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  chipDivider: { width: 1, height: 20, marginHorizontal: space.xs },
  countyLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill },
  countyDot: { width: 7, height: 7, borderRadius: 4 },
  countyName: { fontFamily: font.bold, fontSize: 11, lineHeight: 13, letterSpacing: 0.8 },
  gauge: { borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  gaugeValue: { fontFamily: font.bold, fontSize: 12, lineHeight: 14, fontVariant: ['tabular-nums'], textTransform: 'none', letterSpacing: 0 },
  gaugeUnit: { fontSize: 9, lineHeight: 10, textTransform: 'none' },
  trendBadge: { position: 'absolute', top: 2, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  gaugeName: { marginTop: 4, maxWidth: 180, paddingHorizontal: space.s, paddingVertical: 2, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  reportDot: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  keyGauge: { width: 22, height: 22, borderRadius: 11, borderWidth: 3 },
  swatch: { width: 22, height: 14, borderRadius: 3 },
  scoreBlock: { flex: 1, padding: space.m, borderRadius: radius.md, gap: 2 },
  bar: { height: 8, borderRadius: 4, overflow: 'visible' },
  avgMark: { position: 'absolute', top: -3, width: 2, height: 14, borderRadius: 1 },
});
