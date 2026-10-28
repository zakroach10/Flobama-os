import { Image, StyleSheet, View, type ImageStyle, type StyleProp } from "react-native";

type Props = {
  width?: number;
  style?: StyleProp<ImageStyle>;
};

export function BrandLogo({ width = 180, style }: Props) {
  const height = Math.round(width * (488 / 1500));
  return (
    <View accessibilityRole="image" accessibilityLabel="FloBama">
      <Image
        source={require("../../assets/images/flobama-logo.png")}
        style={[{ width, height }, styles.logo, style]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    maxWidth: "100%",
  },
});
