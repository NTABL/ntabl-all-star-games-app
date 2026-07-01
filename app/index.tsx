import { router, Stack } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

const SPLASH1_DURATION = 5000;
const SPLASH2_DURATION = 6500;
const FADE_DURATION = 900;
const WEB_SPLASH_DURATION = 2400;

export default function Index() {
  const fade1 = useRef(new Animated.Value(1)).current;
  const fade2 = useRef(new Animated.Value(0)).current;

  if (Platform.OS === "web") {
    useEffect(() => {
      const routeTimer = setTimeout(() => {
        router.replace("/login");
      }, WEB_SPLASH_DURATION);

      return () => clearTimeout(routeTimer);
    }, []);

    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.webContainer}>
          <Image
            source={require("../assets/All-Star Logo.png")}
            style={styles.webLogo}
            resizeMode="contain"
          />

          <Text style={styles.webTitle}>NTABL Charity All-Star Games</Text>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      </>
    );
  }

  const player1 = useVideoPlayer(require("../assets/splash.mp4"), (player) => {
    player.loop = false;
    player.play();
  });

  const player2 = useVideoPlayer(require("../assets/splash2.mp4"), (player) => {
    player.loop = false;
    player.pause();
  });

  useEffect(() => {
    const startSecondVideoTimer = setTimeout(() => {
      try {
        player2.currentTime = 0;
        player2.play();
      } catch (e) {
        console.log(e);
      }

      Animated.parallel([
        Animated.timing(fade1, {
          toValue: 0,
          duration: FADE_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fade2, {
          toValue: 1,
          duration: FADE_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }, SPLASH1_DURATION - FADE_DURATION);

    const routeTimer = setTimeout(() => {
      router.replace("/login");
    }, SPLASH1_DURATION + SPLASH2_DURATION - FADE_DURATION);

    return () => {
      clearTimeout(startSecondVideoTimer);
      clearTimeout(routeTimer);
      try {
        player1.pause();
        player2.pause();
      } catch (e) {
        console.log(e);
      }
    };
  }, [fade1, fade2, player1, player2]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container} pointerEvents="none">
        <Animated.View style={[styles.videoLayer, { opacity: fade1 }]}>
          <VideoView
            style={styles.video}
            player={player1}
            contentFit="cover"
            nativeControls={false}
            allowsPictureInPicture={false}
            surfaceType="textureView"
            useExoShutter={false}
            pointerEvents="none"
          />
        </Animated.View>

        <Animated.View style={[styles.videoLayer, { opacity: fade2 }]}>
          <VideoView
            style={styles.video}
            player={player2}
            contentFit="cover"
            nativeControls={false}
            allowsPictureInPicture={false}
            surfaceType="textureView"
            useExoShutter={false}
            pointerEvents="none"
          />
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  videoLayer: {
    ...StyleSheet.absoluteFillObject,
  },

  video: {
    width: "100%",
    height: "100%",
  },

  webContainer: {
    flex: 1,
    backgroundColor: "#0b1f3a",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  webLogo: {
    width: 300,
    height: 300,
    marginBottom: 12,
  },

  webTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 22,
  },
});
