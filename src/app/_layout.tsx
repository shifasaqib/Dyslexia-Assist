// import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
// import * as SplashScreen from 'expo-splash-screen';
// import { useColorScheme } from 'react-native';

// import { AnimatedSplashOverlay } from '@/components/animated-icon';
// import AppTabs from '@/components/app-tabs';

// SplashScreen.preventAutoHideAsync();

// export default function TabLayout() {
//   const colorScheme = useColorScheme();
//   return (
//     <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
//       <AnimatedSplashOverlay />
//       <AppTabs />
//     </ThemeProvider>
//   );
// }


import {
  Lexend_400Regular,
  Lexend_600SemiBold,
  Lexend_700Bold,
  useFonts,
} from '@expo-google-fonts/lexend';
import { Stack } from 'expo-router';

export default function RootLayout() {
  const [loaded] = useFonts({
    Lexend_400Regular,
    Lexend_600SemiBold,
    Lexend_700Bold,
    // Reading font (OFL licence), used only for reading text
    OpenDyslexic_Regular: require('open-dyslexic/ttf/OpenDyslexic-Regular.ttf'),
    OpenDyslexic_Bold: require('open-dyslexic/ttf/OpenDyslexic-Bold.ttf'),
  });

  if (!loaded) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}