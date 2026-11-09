// /**
//  * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
//  * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
//  */

// import '@/global.css';

// import { Platform } from 'react-native';

// export const Colors = {
//   light: {
//     text: '#000000',
//     background: '#ffffff',
//     backgroundElement: '#F0F0F3',
//     backgroundSelected: '#E0E1E6',
//     textSecondary: '#60646C',
//   },
//   dark: {
//     text: '#ffffff',
//     background: '#000000',
//     backgroundElement: '#212225',
//     backgroundSelected: '#2E3135',
//     textSecondary: '#B0B4BA',
//   },
// } as const;

// export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// export const Fonts = Platform.select({
//   ios: {
//     /** iOS `UIFontDescriptorSystemDesignDefault` */
//     sans: 'system-ui',
//     /** iOS `UIFontDescriptorSystemDesignSerif` */
//     serif: 'ui-serif',
//     /** iOS `UIFontDescriptorSystemDesignRounded` */
//     rounded: 'ui-rounded',
//     /** iOS `UIFontDescriptorSystemDesignMonospaced` */
//     mono: 'ui-monospace',
//   },
//   default: {
//     sans: 'normal',
//     serif: 'serif',
//     rounded: 'normal',
//     mono: 'monospace',
//   },
//   web: {
//     sans: 'var(--font-display)',
//     serif: 'var(--font-serif)',
//     rounded: 'var(--font-rounded)',
//     mono: 'var(--font-mono)',
//   },
// });

// export const Spacing = {
//   half: 2,
//   one: 4,
//   two: 8,
//   three: 16,
//   four: 24,
//   five: 32,
//   six: 64,
// } as const;

// export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
// export const MaxContentWidth = 800;


export const colors = {
  skyTop: '#A9E0FB',
  skyMid: '#6CC5F6',
  mint: '#46D9A0',
  title: '#E8174F',
  navy: '#0B2A4A',
  orange: '#FFAB00',
  orangeDark: '#D98300',
  yellow: '#F5B800',
  brown: '#5C2E00',
  cardBlue: '#EAF4FF',
  cardCream: '#FFFDF3',
  parentIconBg: '#FFF3C4',
  doctorGreen: '#1FA46A',
  muted: '#4A5A6A',
  circle: '#BFEAF3',
  white: '#FFFFFF',
  whiteShadow: '#C9D3DB',
};

export const fonts = {
  regular: 'Lexend_400Regular',
  semiBold: 'Lexend_600SemiBold',
  bold: 'Lexend_700Bold',
};
