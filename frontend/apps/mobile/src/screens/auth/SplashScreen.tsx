import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../../navigation/RootNavigator';
import { selectIsAuthenticated, useAuthStore } from '../../entities/auth/authStore';
import { useGuideModeStore } from '../../entities/guide/guideModeStore';
import { usePreferencesStore } from '../../entities/preferences/preferencesStore';
import { LogoMark } from '../../features/auth/components/LogoMark';
import { useMe } from '../../shared/auth/hooks';
import { colors } from '../../shared/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const MIN_SPLASH_MS = 1200;

export function SplashScreen({ navigation }: Props) {
  const authHydrated = useAuthStore((s) => s._hasHydrated);
  const guideHydrated = useGuideModeStore((s) => s._hasHydrated);
  const guideModeActive = useGuideModeStore((s) => s.hasEnteredGuideMode);
  const prefsHydrated = usePreferencesStore((s) => s._hasHydrated);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const hasSeenWelcome = useAuthStore((s) => s.hasSeenWelcome);
  const onboardingCompleted = usePreferencesStore((s) => s.completed);
  const me = useMe();

  const ready =
    authHydrated &&
    guideHydrated &&
    prefsHydrated &&
    (!isAuthenticated || me.isSuccess || me.isError);

  useEffect(() => {
    if (!ready) return;

    const id = setTimeout(() => {
      if (isAuthenticated) {
        if (onboardingCompleted) {
          navigation.replace('Main', guideModeActive ? { startInGuide: true } : undefined);
        } else {
          navigation.replace('OnboardingInterests');
        }
      } else if (!hasSeenWelcome) {
        navigation.replace('Welcome');
      } else {
        navigation.replace('Login');
      }
    }, MIN_SPLASH_MS);

    return () => clearTimeout(id);
  }, [ready, isAuthenticated, hasSeenWelcome, onboardingCompleted, navigation, guideModeActive]);

  return (
    <View style={styles.root}>
      <LogoMark size={64} />
      <Text style={styles.title}>Местный Взгляд</Text>
      <ActivityIndicator size="large" color={colors.textPrimary} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  loader: {
    marginTop: 48,
  },
});
