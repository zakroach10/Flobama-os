import { useVideoPlayer, VideoView } from "expo-video";
import { StyleSheet, View } from "react-native";
import { colors } from "./theme";

export function LivePlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });
  return (
    <View style={styles.frame}>
      <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.black, borderRadius: 16, overflow: "hidden" },
  video: { width: "100%", height: "100%" },
});
