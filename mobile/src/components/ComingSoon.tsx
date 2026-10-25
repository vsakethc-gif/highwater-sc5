/**
 * ComingSoon.tsx — an honest placeholder for a tab still being built: what it will do, and a link to
 * the website version, which already works.
 */
import { Linking, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { Button } from './ui/Button';
import { LargeTitleScroll, Screen } from './ui/Screen';
import { Txt } from './ui/Text';
import { radius, space, useTheme } from '../theme';

export function ComingSoon({ icon, title, body, webPath }: { icon: IconName; title: string; body: string; webPath: string }) {
  const { c } = useTheme();
  return (
    <Screen>
      <LargeTitleScroll title={title}>
        <View style={{ gap: space.xl, marginTop: space.xl }}>
          <View style={{ width: 64, height: 64, borderRadius: radius.lg, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={30} tint={c.accent} />
          </View>
          <Txt tone="muted">{body}</Txt>
          <Button label="Open it on the website" icon="ExternalLink" onPress={() => Linking.openURL(`https://vsakethc-gif.github.io/highwater-sc5/${webPath}`)} style={{ alignSelf: 'flex-start' }} />
        </View>
      </LargeTitleScroll>
    </Screen>
  );
}
