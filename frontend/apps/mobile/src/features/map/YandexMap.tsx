import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../shared/theme/colors';
import type { YandexMapProps } from './YandexMap.types';

/**
 * Заглушка для нативных платформ. Будет заменена на `react-native-yamap`
 * после `expo prebuild` и подключения MapKit-ключа (этап B).
 */
export function YandexMap({ places, routePath, travelledPath }: YandexMapProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Карта в демо-режиме</Text>
      <Text style={styles.subtitle}>
        Маркеры пока не рисуем в этой сборке. Выбирайте точки из карточек ниже.
      </Text>
      <Text style={styles.count}>Найдено мест: {places.length}</Text>
      {routePath && routePath.length > 1 ? (
        <Text style={styles.count}>Маршрут построен: {routePath.length} точки</Text>
      ) : null}
      {travelledPath && travelledPath.length > 1 ? (
        <Text style={styles.count}>Пройдено точек трека: {travelledPath.length}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 240,
    backgroundColor: '#EFE9DF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  count: {
    marginTop: 8,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
