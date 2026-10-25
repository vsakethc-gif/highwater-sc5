/**
 * Layout.tsx — Card, SectionHeader, and ListRow (brief section 6, items 3, 8, 9).
 * Cards are flat with soft depth in light mode and a hairline border in dark mode.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { elevation, radius, sceneInk, space, useTheme } from '../../theme';
import { Icon, type IconName } from '../Icon';
import { Pressable } from './Button';
import { Txt } from './Text';

export function Card({ children, style, onPress, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  const { c, isDark } = useTheme();
  const body = <View style={[s.card, { backgroundColor: c.surface }, elevation(c, isDark, 1), style]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scaleTo={0.985}>
      {body}
    </Pressable>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.header}>
      <Txt variant="caption" tone="muted" accessibilityRole="header">
        {title}
      </Txt>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={action} hitSlop={10}>
          <Txt variant="footnote" tone="accent">
            {action}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  icon,
  leading,
  trailing,
  onPress,
  chevron = !!onPress,
  last,
  hint,
  tile,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  last?: boolean;
  hint?: string;
  /** A solid color for the icon tile (iOS Settings style), with a white icon. */
  tile?: string;
}) {
  const { c } = useTheme();
  const content = (
    <View style={[s.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.hairline }]}>
      {leading ?? (icon ? (
        <View style={[s.leading, { backgroundColor: tile ?? c.accentSoft }]}>
          <Icon name={icon} size={18} tint={tile ? sceneInk.primary : c.accent} />
        </View>
      ) : null)}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="headline">{title}</Txt>
        {subtitle ? <Txt variant="footnote">{subtitle}</Txt> : null}
      </View>
      {trailing}
      {chevron ? <Icon name="ChevronRight" size={18} tint={c.inkFaint} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title} accessibilityHint={hint} scaleTo={0.99}>
      {content}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radius.md, padding: space.l, borderCurve: 'continuous' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.s, minHeight: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 56, paddingVertical: space.m },
  leading: { width: 32, height: 32, borderRadius: 10, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
});
