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
import { clearAdminLogin, isAdminLoggedIn } from "../stores/adminstore";
export default function AdminScreen() {
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

  async function handleLogout() {
    await clearAdminLogin();
    router.replace("/login");
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
              onPress={() => router.replace("/dashboard")}
              style={styles.backButton}
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
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <View style={styles.smallButtonRow}>
                <Ionicons
                  name="log-out-outline"
                  size={16}
                  color="#ffffff"
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.logoutButtonText}>Logout</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.heroCard}>
            <Image
              source={require("../assets/NTABL-Logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.title}>Admin Control Panel</Text>

            <Text style={styles.subtitle}>
              Access tournament operations and manage administrative configuration.
            </Text>
          </View>
<View style={styles.sectionCard}>
  <Text style={styles.sectionHeader}>Operations Center</Text>

  <TouchableOpacity
    style={styles.diagnosticsButton}
    onPress={() => router.push("/diagnostics")}
  >
    <View style={styles.buttonContentRow}>
      <Ionicons
        name="settings-outline"
        size={22}
        color="#ffffff"
        style={{ marginRight: 8 }}
      />

      <Text style={styles.buttonText}>Open Operations Center</Text>
    </View>
  </TouchableOpacity>
</View>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>Member Support</Text>

            <TouchableOpacity
              style={styles.memberLookupButton}
              onPress={() => router.push("/memberlookup")}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="person-circle-outline"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.buttonText}>Member Lookup & Impersonation</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>Communications Center</Text>

            <TouchableOpacity
              style={styles.communicationsButton}
              onPress={() => router.push("/communications")}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="mail-unread-outline"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.buttonText}>Email Players & Managers</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>
              All-Star Managers
            </Text>

            <TouchableOpacity
              style={styles.managerCard}
              onPress={() => router.push("/managers")}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="people"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.buttonText}>Assign All-Star Managers</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>Division Configuration</Text>

            <TouchableOpacity
              style={styles.divisionConfigButton}
              onPress={() => router.push("/divisionconfig")}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="baseball-outline"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.buttonText}>Configure Divisions</Text>
              </View>
            </TouchableOpacity>
          </View>

<View style={styles.sectionCard}>
  <Text style={styles.sectionHeader}>Announcer Configuration</Text>

  <TouchableOpacity
    style={styles.announcerButton}
    onPress={() => router.push("/announcerconfig")}
  >
    <View style={styles.buttonContentRow}>
      <Ionicons
        name="mic-outline"
        size={22}
        color="#ffffff"
        style={{ marginRight: 8 }}
      />

      <Text style={styles.buttonText}>Configure Password</Text>
    </View>
  </TouchableOpacity>
</View>

          <Text style={styles.versionFooter}>
            NTABL All-Star App • Version 1.0
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  smallButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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

  logoutButton: {
    backgroundColor: "#c62828",
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },

  logoutButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },

  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },

  logo: {
    width: 150,
    height: 150,
    alignSelf: "center",
    marginBottom: 8,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6b7280",
    textAlign: "center",
  },

  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },

  sectionHeader: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1f4e9e",
    marginBottom: 12,
    textAlign: "center",
  },

  communicationsButton: {
    backgroundColor: "#0f766e",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  managerCard: {
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  divisionConfigButton: {
    backgroundColor: "#c62828",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  announcerButton: {
    backgroundColor: "#4b5563",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  buttonText: {
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



diagnosticsButton: {
  backgroundColor: "#1f4e9e",
  borderRadius: 12,
  paddingVertical: 16,
  paddingHorizontal: 18,
  alignItems: "center",
  justifyContent: "center",
},
  memberLookupButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
});
