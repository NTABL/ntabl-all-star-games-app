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

export default function DonationInfoScreen() {
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
              onPress={() => router.replace("/donate")}
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
              style={[styles.logo, isShortScreen && styles.logoShort]}
              resizeMode="contain"
            />

            <Text style={styles.title}>Donation Information</Text>

            <Text style={styles.bodyText}>
              The North Texas Adult Baseball League Charity All-Star Games help
              support Texas Scottish Rite Hospital for Children.
            </Text>

            <Text style={styles.bodyText}>
              Donations help provide care and resources for children and
              families who benefit from the incredible work of Texas Scottish
              Rite.
            </Text>

            <Text style={styles.bodyText}>
              Players, managers, family members, friends, and supporters are
              encouraged to donate and share the donation link. These donations
              go directly to the Hospital. No money goes to NTABL.
            </Text>

            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsHeader}>
                Follow These Easy Steps to Donate Now:
              </Text>

              <Text style={styles.stepText}>
                1. Tap <Text style={styles.boldText}>Donate Now</Text> to open
                the donation website.
              </Text>

              <Text style={styles.stepText}>
                2. Review the information and{" "}
                <Text style={styles.boldText}>Sponsorship</Text> Levels.
              </Text>

              <Text style={styles.stepText}>
                3. Select your <Text style={styles.boldText}>Team</Text> from
                the <Text style={styles.boldText}>NTABL Teams</Text> dropdown,
                then enter your <Text style={styles.boldText}>Gift Amount</Text>.
              </Text>

              <Text style={styles.stepText}>
                4. Complete your{" "}
                <Text style={styles.boldText}>Billing Information</Text> and
                select Give Securely.
              </Text>
            </View>

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
    marginBottom: 14,
  },

  logoShort: {
    width: 230,
    height: 92,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    color: "#1f4e9e",
    marginBottom: 14,
  },

  bodyText: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
    marginBottom: 14,
    fontWeight: "700",
  },

instructionsCard: {
  backgroundColor: "#FFFBEA",
  borderRadius: 16,
  padding: 14,
  marginTop: 4,
  marginBottom: 14,
  borderWidth: 1,
  borderColor: "#F6E58D",

  shadowColor: "#000",
  shadowOpacity: 0.05,
  shadowRadius: 6,
  shadowOffset: {
    width: 0,
    height: 2,
  },
  elevation: 2,
},

  instructionsHeader: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1f4e9e",
    marginBottom: 10,
    textAlign: "center",
  },

  stepText: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
    marginBottom: 8,
    fontWeight: "700",
  },

  boldText: {
    fontWeight: "900",
    color: "#111827",
  },

  donateButton: {
    backgroundColor: "#c62828",
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
