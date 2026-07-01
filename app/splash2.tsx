import { router, Stack } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

export default function SplashTwo() {
  const player = useVideoPlayer(require("../assets/splash2.mp4"), (player) => {
    player.loop = false;
    player.play();
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/login");
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        <VideoView
          style={styles.video}
          player={player}
          contentFit="cover"
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          pointerEvents="none"
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  video: {
    width: "100%",
    height: "100%",
  },
});
