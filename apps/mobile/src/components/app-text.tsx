import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts } from '@/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'secondary' | 'label' | 'small';

type Props = TextProps & { variant?: Variant };

export function AppText({ variant = 'body', style, ...rest }: Props) {
  return <Text style={[styles.base, styles[variant], style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: { color: colors.ink, fontFamily: fonts.regular },
  display: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  secondary: { fontSize: 15, lineHeight: 22, color: colors.muted },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  small: { fontSize: 13, lineHeight: 18, color: colors.muted },
});
