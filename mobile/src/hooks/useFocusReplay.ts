/**
 * useFocusReplay.ts — a number that goes up each time this screen comes back into view.
 *
 * Tabs stay alive in the background, so their entrance animations used to play only once, the first
 * time you opened them. Using this number as a React `key` on a screen's content re-creates that
 * content when you come back, so the entrance plays again (modules rise in, the water fills, charts
 * draw). The data itself is kept in memory, so nothing is downloaded again.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

export function useFocusReplay(): number {
  const [visit, setVisit] = useState(0);
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      // The first focus is the first mount, which already plays the entrance.
      if (first.current) first.current = false;
      else setVisit((v) => v + 1);
    }, []),
  );
  return visit;
}
