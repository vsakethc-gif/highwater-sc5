/**
 * Logo.tsx — the Highwater mark inside the app: a deep water-blue rounded square with water rising
 * in it, a white wave on the surface, and gauge ticks on the side. It's the same drawing as the app
 * icon (scripts/icons.mjs), so the icon on the home screen and the mark inside the app match.
 */
import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { APP_NAME, APP_MOTTO } from '../../../shared/config';
import { font, space, useTheme } from '../theme';
import { Txt } from './ui/Text';

const SURFACE = 'M-4 58 C 12 47, 30 47, 50 58 S 88 69, 104 58';

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2A7AB0" />
          <Stop offset="1" stopColor="#1B5F8E" />
        </LinearGradient>
        <ClipPath id="tile">
          <Rect width="100" height="100" rx="22" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#tile)">
        <Rect width="100" height="100" fill="#0B4F7A" />
        <Path d={`${SURFACE} L 104 104 L -4 104 Z`} fill="url(#water)" />
        <G stroke="#FFFFFF" strokeLinecap="round" strokeWidth={3.2} opacity={0.9}>
          <Line x1="22" y1="22" x2="31" y2="22" />
          <Line x1="22" y1="33" x2="28" y2="33" />
          <Line x1="22" y1="44" x2="31" y2="44" />
        </G>
        <Path d={SURFACE} fill="none" stroke="#FFFFFF" strokeWidth={5.5} strokeLinecap="round" />
        <Path d="M-4 76 C 12 66, 30 66, 50 76 S 88 86, 104 76" fill="none" stroke="#FFFFFF" strokeWidth={3.4} strokeLinecap="round" opacity={0.45} />
      </G>
    </Svg>
  );
}

/** The mark with the name, and optionally the motto, for the intro screen and About. */
export function Wordmark({ size = 36, motto = false }: { size?: number; motto?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }} accessible accessibilityLabel={motto ? `${APP_NAME}. ${APP_MOTTO}` : APP_NAME}>
      <LogoMark size={size} />
      <View>
        <Txt variant="title3" color={c.ink} style={{ fontFamily: font.serif, fontSize: size * 0.62, lineHeight: size * 0.74 }}>
          {APP_NAME}
        </Txt>
        {motto ? <Txt variant="footnote">{APP_MOTTO}</Txt> : null}
      </View>
    </View>
  );
}
