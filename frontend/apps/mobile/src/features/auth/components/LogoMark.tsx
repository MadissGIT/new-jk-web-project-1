import { Image, StyleSheet } from 'react-native';

export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <Image
      source={require('../../../../assets/auth-logo.png')}
      style={[styles.logo, { width: size, height: size }]}
      resizeMode="contain"
      accessibilityLabel="Местный взгляд"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    flexShrink: 0,
  },
});
