import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import {
    Image,
    KeyboardAvoidingView,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";

export default function DonateScreen() {
  const { width, height } = useWindowDimensions();
  const isTabletLayout = width >= 700;
  const isShortScreen = height < 760;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isTabletLayout && styles.scrollContentTablet,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.replace("/login")}
            >
              <View style={styles.smallButtonRow}>
                <Ionicons
                  name="chevron-back-outline"
                  size={16}
                  color="#ffffff"
                  style={{ marginRight: 3 }}
                />

                <Text style={styles.backButtonText}>Back</Text>
              </View>
            </Pressable>
          </View>

          <View
            style={[
              styles.card,
              isTabletLayout && styles.cardTablet,
              isShortScreen && styles.cardShort,
            ]}
          >
            <Image
              source={require("../assets/TXScottishRiteLogo.png")}
              style={[
                styles.logo,
                isShortScreen && styles.logoShort,
              ]}
              resizeMode="contain"
            />

            <Text style={styles.title}>
              North Texas Adult Baseball Foundation
            </Text>

            <Text style={styles.subtitle}>
              Benefiting Texas Scottish Rite Hospital for Children
            </Text>

            <Pressable
              style={styles.donateButton}
              onPress={() =>
                Linking.openURL("http://community.tsrhc.org/NTABL_Donation")
              }
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="heart"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.buttonText}>Donate Now</Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.infoButton}
              onPress={() => router.push("/donationinfo")}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="information-circle"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.buttonText}>Donation Information</Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.shareButton}
              onPress={() => router.push("/donatetext")}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="share-social"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.buttonText}>Share Text Message</Text>
              </View>
            </Pressable>

            <Text style={styles.versionFooter}>
              NTABL All-Star App • Version 1.0
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 70,
  },

  scrollContentTablet: {
    paddingTop: 30,
    paddingBottom: 40,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 10,
  },

  backButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },

  backButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },

  smallButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 22,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 8,
  },

  cardTablet: {
    minHeight: "88%",
    justifyContent: "center",
  },

  cardShort: {
    paddingVertical: 18,
  },

  logo: {
    width: 260,
    height: 104,
    alignSelf: "center",
    marginBottom: 18,
  },

  logoShort: {
    width: 230,
    height: 92,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
    color: "#1f4e9e",
  },

  subtitle: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 22,
  },

  donateButton: {
    backgroundColor: "#c62828",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },

  infoButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },

  shareButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  versionFooter: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 22,
  },
});
