/**
 * Text.tsx — all text in the app goes through <Txt>, so it always uses the type scale (tokens.ts)
 * and the theme's colors. It follows the phone's text-size setting (Dynamic Type); layouts wrap
 * instead of clipping.
 */
import { Text, type TextProps } from 'react-native';
import { type, useTheme, type TypeStyle } from '../../theme';

type Tone = 'ink' | 'muted' | 'faint' | 'accent';

export function Txt({ variant = 'body', tone, color, style, ...rest }: TextProps & { variant?: TypeStyle; tone?: Tone; color?: string }) {
  const { c } = useTheme();
  const defaultTone: Tone = variant === 'footnote' || variant === 'caption' ? 'faint' : 'ink';
  const t = tone ?? defaultTone;
  const fill = color ?? (t === 'muted' ? c.inkMuted : t === 'faint' ? c.inkFaint : t === 'accent' ? c.accent : c.ink);
  return <Text maxFontSizeMultiplier={2} {...rest} style={[type[variant], { color: fill }, style]} />;
}
