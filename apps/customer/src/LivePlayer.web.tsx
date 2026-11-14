import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "./theme";

export function LivePlayer({ uri }: { uri: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let destroyed = false;
    let hls: { destroy: () => void } | null = null;
    void import("hls.js").then(({ default: Hls }) => {
      if (destroyed || !ref.current) return;
      if (Hls.isSupported()) {
        const instance = new Hls({ enableWorker: false });
        instance.loadSource(uri);
        instance.attachMedia(ref.current);
        hls = instance;
        return;
      }
      ref.current.src = uri;
    });
    return () => {
      destroyed = true;
      hls?.destroy();
    };
  }, [uri]);

  return (
    <View style={styles.frame}>
      <video
        ref={ref}
        controls
        playsInline
        style={{ width: "100%", height: "100%", backgroundColor: "#000", objectFit: "contain" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.black, borderRadius: 16, overflow: "hidden" },
});
