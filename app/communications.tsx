import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { isAdminLoggedIn } from "../stores/adminstore";

export default function CommunicationsHubScreen() {
  useFocusEffect(
    useCallback(() => {
      checkAdmin();
    }, [])
  );

  async function checkAdmin() {
    const loggedIn = await isAdminLoggedIn();

    if (!loggedIn) {
      router.replace("/login");
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.replace("/admin")}
              style={styles.backButton}
            >
              <View style={styles.buttonRow}>
                <Ionicons
                  name="chevron-back-outline"
                  size={17}
                  color="#ffffff"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.backButtonText}>Back</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.heroCard}>
            <Image
              source={require("../assets/NTABL-Logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.title}>Communications Center</Text>

            <Text style={styles.subtitle}>
              Choose how you would like to communicate with NTABL players and
              managers.
            </Text>
          </View>

          <View style={styles.communicationCard}>
            <View style={[styles.iconCircle, styles.emailIconCircle]}>
              <Ionicons name="mail-outline" size={34} color="#ffffff" />
            </View>

            <Text style={styles.cardTitle}>Email Communications</Text>

            <Text style={styles.cardDescription}>
              Create personalized emails, waiver reminders, schedule updates,
              and general announcements.
            </Text>

            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={18} color="#15803d" />
              <Text style={styles.readyStatus}>Ready</Text>
            </View>

            <TouchableOpacity
              style={[styles.openButton, styles.emailButton]}
              onPress={() => router.push("/emailcenter")}
            >
              <View style={styles.buttonRow}>
                <Ionicons
                  name="mail-unread-outline"
                  size={21}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.openButtonText}>Open Email Center</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.communicationCard}>
            <View style={[styles.iconCircle, styles.smsIconCircle]}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={34}
                color="#ffffff"
              />
            </View>

            <Text style={styles.cardTitle}>Text Message Communications</Text>

            <Text style={styles.cardDescription}>
              Send live SMS alerts, reminders, schedule changes, and urgent
              event updates through the NTABL Twilio account.
            </Text>

            <View style={styles.statusRow}>
              <Ionicons name="time-outline" size={18} color="#b45309" />
              <Text style={styles.pendingStatus}>Awaiting Twilio Approval</Text>
            </View>

            <TouchableOpacity
              style={[styles.openButton, styles.smsButton]}
              onPress={() => router.push("/smscenter")}
            >
              <View style={styles.buttonRow}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={21}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.openButtonText}>
                  Open Text Message Center
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.versionFooter}>
            NTABL All-Star App • Communications Center
          </Text>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 70,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 10,
  },

  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  backButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },

  backButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 18,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },

  logo: {
    width: 140,
    height: 140,
    alignSelf: "center",
    marginBottom: 8,
  },

  title: {
    color: "#1f4e9e",
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
  },

  subtitle: {
    color: "#6b7280",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    textAlign: "center",
  },

  communicationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },

  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  emailIconCircle: {
    backgroundColor: "#1d4ed8",
  },

  smsIconCircle: {
    backgroundColor: "#15803d",
  },

  cardTitle: {
    color: "#1f4e9e",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },

  cardDescription: {
    color: "#6b7280",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 13,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  readyStatus: {
    color: "#15803d",
    fontSize: 13,
    fontWeight: "900",
    marginLeft: 6,
  },

  pendingStatus: {
    color: "#b45309",
    fontSize: 13,
    fontWeight: "900",
    marginLeft: 6,
  },

  openButton: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  emailButton: {
    backgroundColor: "#1d4ed8",
  },

  smsButton: {
    backgroundColor: "#15803d",
  },

  openButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },

  versionFooter: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
});
