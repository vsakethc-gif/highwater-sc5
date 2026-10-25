/**
 * ScenarioTimeline.tsx — the storm timeline docked above the tab bar in Scenario Mode
 * (REDESIGN.md 3.4). Drag along it and the whole Status scene follows your finger: the water rises
 * smoothly as you drag, and each time you pass a tick the app switches to that moment of the storm
 * (Normal → Watch → Warning → Danger), with the sky crossfade and the level-change vibration.
 * Play steps through the storm on its own, one moment every 2.4 seconds.
 *
 * How the drag stays smooth: the finger position lives in a shared value on the UI thread and moves
 * the thumb and the water directly. Only when the finger crosses into a new step do we call back to
 * React (once per step, not once per frame) to load that step's simulated data.
 * Screen readers: the bar is one "adjustable" control; swipe up or down to change the step.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { LEVELS, type Level } from '../../../../shared/hazards/levels';
import type { TimelineStep } from '../../../../shared/scenario/scenario';
import { font, radius, sceneInk, space, spring, tapTarget } from '../../theme';
import { Icon } from '../Icon';
import { Pressable } from '../ui/Button';
import { Txt } from '../ui/Text';
import { Glass } from './Module';

const PLAY_STEP_MS = 2400;

export function ScenarioTimeline({
  steps,
  index,
  level,
  onStep,
  waterLevel,
  dragging,
}: {
  steps: TimelineStep[];
  /** The step on screen now. */
  index: number;
  /** The level the engine gave that step (shown under the time). */
  level: Level;
  onStep: (i: number) => void;
  /** The scene's water height (0..3); the drag moves it directly (the storm's steps are levels 0 to 3). */
  waterLevel: SharedValue<number>;
  /** True while a finger is on the bar, so the screen doesn't spring the water away from it. */
  dragging: SharedValue<boolean>;
}) {
  const last = steps.length - 1;
  const [width, setWidth] = useState(0);
  const pos = useSharedValue(index / last); // 0..1 along the track
  const step = useSharedValue(index);
  /** 1 while a finger is on the bar: the thumb grows a little so you can feel you've got hold of it. */
  const held = useSharedValue(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // When the step changes from outside the drag (Play, a screen reader, a new scenario), glide there.
  useEffect(() => {
    if (dragging.get()) return;
    step.set(index);
    pos.set(withSpring(index / last, spring.gentle));
  }, [index, last, pos, step, dragging]);

  // Play: one step forward every 2.4 s, stopping at the end.
  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      const next = step.get() + 1;
      if (next > last) {
        setPlaying(false);
        return;
      }
      onStep(next);
    }, PLAY_STEP_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, last, onStep, step]);

  const stopPlaying = () => setPlaying(false);

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      dragging.set(true);
      held.set(withTiming(1, { duration: 120 }));
      scheduleOnRN(stopPlaying);
      const p = Math.max(0, Math.min(1, e.x / Math.max(1, width)));
      pos.set(p);
      waterLevel.set(p * last);
      const i = Math.round(p * last);
      if (i !== step.get()) {
        step.set(i);
        scheduleOnRN(onStep, i);
      }
    })
    .onUpdate((e) => {
      const p = Math.max(0, Math.min(1, e.x / Math.max(1, width)));
      pos.set(p);
      waterLevel.set(p * last);
      const i = Math.round(p * last);
      if (i !== step.get()) {
        step.set(i);
        scheduleOnRN(onStep, i);
      }
    })
    .onFinalize(() => {
      // Let go: the thumb and the water settle onto the nearest step.
      const i = step.get();
      pos.set(withSpring(i / last, spring.gentle));
      waterLevel.set(withSpring(i, spring.gentle));
      held.set(withTiming(0, { duration: 160 }));
      dragging.set(false);
    });

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: pos.get() * width }, { scale: 1 + 0.18 * held.get() }] }));
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: pos.get() }] }));

  const current = steps[index];
  return (
    <Glass rounded={radius.lg} style={s.bar} floating>
      <Pressable onPress={() => setPlaying((p) => !p)} accessibilityRole="button" accessibilityLabel={playing ? 'Pause the storm replay' : 'Play the storm replay'} scaleTo={0.95}>
        <View style={s.play}>
          <Icon name={playing ? 'Pause' : 'Play'} size={20} tint={sceneInk.primary} filled />
        </View>
      </Pressable>

      <View style={{ flex: 1, gap: space.xs }}>
        <View style={s.labels}>
          <Txt variant="footnote" color={sceneInk.sim} style={{ fontFamily: font.semibold, letterSpacing: 0.5 }}>
            SIMULATED
          </Txt>
          <Txt variant="footnote" color={sceneInk.primary} style={{ fontFamily: font.semibold, fontVariant: ['tabular-nums'] }}>
            {`${current.time} · ${LEVELS[level].name}`}
          </Txt>
        </View>
        <GestureDetector gesture={pan}>
          <View
            style={s.hit}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Storm timeline"
            accessibilityValue={{ text: `${current.time}, ${LEVELS[level].name}. Step ${index + 1} of ${steps.length}` }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'increment' && index < last) onStep(index + 1);
              if (e.nativeEvent.actionName === 'decrement' && index > 0) onStep(index - 1);
            }}
          >
            <View style={s.track}>
              <Animated.View style={[s.trackFill, { width }, fill]} />
            </View>
            {steps.map((st, i) => (
              <View key={st.id} style={[s.tick, { left: (i / last) * width - 1, backgroundColor: i <= index ? sceneInk.primary : sceneInk.meta }]} />
            ))}
            <Animated.View style={[s.thumb, thumb]} />
          </View>
        </GestureDetector>
      </View>
    </Glass>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingLeft: space.s, paddingRight: space.l, paddingVertical: space.s, borderColor: sceneInk.sim },
  play: { width: tapTarget, height: tapTarget, borderRadius: tapTarget / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: sceneInk.control },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s },
  hit: { height: 32, justifyContent: 'center' },
  track: { height: 4, borderRadius: radius.pill, backgroundColor: sceneInk.track, overflow: 'hidden' },
  trackFill: { height: 4, backgroundColor: sceneInk.sim, transformOrigin: 'left center' },
  tick: { position: 'absolute', top: 9, width: 2, height: 14, borderRadius: 1 },
  thumb: { position: 'absolute', top: 5, left: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: sceneInk.primary, borderWidth: 3, borderColor: sceneInk.sim },
});
