import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { clearAdminLogin, isAdminLoggedIn } from "../stores/adminstore";
import { adminFetch, API_BASE } from "../utils/appconfig";
import { modalStyles } from "../utils/modalStyles";
export default function AdminScreen() {
  const [refreshingRoster, setRefreshingRoster] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [lastRefreshAt, setLastRefreshAt] = useState("");
  const [refreshModalMessage, setRefreshModalMessage] = useState("");
  const [refreshModalType, setRefreshModalType] = useState<"success" | "error">(
    "success"
  );

  useFocusEffect(
    useCallback(() => {
      checkAdmin();
    }, [])
  );

  function showRefreshModal(
    message: string,
    type: "success" | "error" = "success"
  ) {
    setRefreshModalMessage(message);
    setRefreshModalType(type);
  }

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

  async function refreshRosterCache() {
    try {
      setRefreshingRoster(true);
      setRefreshMessage("Refreshing LeagueApps data...");

      const response = await adminFetch(
        `${API_BASE}/api/admin/refresh-roster-cache`,
        { method: "POST" }
      );

      const json = await response.json();

      if (json?.ok) {
        setRefreshMessage(
          `LeagueApps Data Refreshed! ${json.rosterCount} Players Loaded.`
        );

        if (json.refreshedAt) {
          setLastRefreshAt(new Date(json.refreshedAt).toLocaleString());
        }

        showRefreshModal("LeagueApps Data Refreshed!", "success");
      } else {
        setRefreshMessage(json?.message || "Refresh failed.");
        showRefreshModal("Refresh Failed", "error");
      }
    } catch (e) {
      console.log("REFRESH ROSTER ERROR:", e);
      setRefreshMessage("Refresh failed. Please try again.");
      showRefreshModal("Refresh Failed", "error");
    } finally {
      setRefreshingRoster(false);
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
              Manage app data, manager access, divisions, and announcer settings.
            </Text>
          </View>
<View style={styles.sectionCard}>
  <Text style={styles.sectionHeader}>System Diagnostics</Text>

  <TouchableOpacity
    style={styles.diagnosticsButton}
    onPress={() => router.push("/diagnostics")}
  >
    <View style={styles.buttonContentRow}>
      <Ionicons
        name="pulse-outline"
        size={22}
        color="#ffffff"
        style={{ marginRight: 8 }}
      />

      <Text style={styles.buttonText}>Open Diagnostics</Text>
    </View>
  </TouchableOpacity>
</View>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>Refresh Back End Data</Text>

            <TouchableOpacity
              disabled={refreshingRoster}
              style={[
                styles.refreshRosterButton,
                refreshingRoster && styles.disabledButton,
              ]}
              onPress={refreshRosterCache}
            >
              {refreshingRoster ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <View style={styles.buttonContentRow}>
                  <Ionicons
                    name="refresh"
                    size={22}
                    color="#ffffff"
                    style={{ marginRight: 8 }}
                  />

                  <Text style={styles.refreshRosterButtonText}>
                    Refresh LeagueApps Data
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {refreshMessage ? (
              <Text style={styles.refreshMessage}>{refreshMessage}</Text>
            ) : null}

            {lastRefreshAt ? (
              <Text style={styles.lastRefreshText}>
                Last refreshed: {lastRefreshAt}
              </Text>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>
              All-Star Manager Configuration
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
            <Text style={styles.sectionHeader}>NTABL Division Configuration</Text>

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
  <Text style={styles.sectionHeader}>Team Submission Status</Text>

  <TouchableOpacity
    style={styles.submissionStatusButton}
    onPress={() => router.push("/submissionstatus")}
  >
    <View style={styles.buttonContentRow}>
      <Ionicons
        name="clipboard-outline"
        size={22}
        color="#ffffff"
        style={{ marginRight: 8 }}
      />

      <Text style={styles.buttonText}>View Team Status</Text>
    </View>
  </TouchableOpacity>
</View>

<View style={styles.sectionCard}>
  <Text style={styles.sectionHeader}>Waiver Management</Text>

  <TouchableOpacity
    style={styles.waiverManagementButton}
    onPress={() => router.push("/waivermanagement")}
  >
    <View style={styles.buttonContentRow}>
      <Ionicons
        name="document-text-outline"
        size={22}
        color="#ffffff"
        style={{ marginRight: 8 }}
      />

      <Text style={styles.buttonText}>Manage Event Waivers</Text>
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

        {refreshModalMessage ? (
          <View style={styles.toastOverlay}>
            <View
              style={[
                styles.saveToast,
                refreshModalType === "error" && styles.errorToast,
              ]}
            >
              <Ionicons
                name={
                  refreshModalType === "error"
                    ? "alert-circle"
                    : "checkmark-circle"
                }
                size={54}
                color={refreshModalType === "error" ? "#c62828" : "#15803d"}
                style={{ marginBottom: 10 }}
              />

              <Text
                style={[
                  styles.saveToastText,
                  refreshModalType === "error" && styles.errorToastText,
                ]}
              >
                {refreshModalMessage}
              </Text>

              <Text style={styles.saveToastSubText}>
                {refreshModalType === "error"
                  ? "Please try again."
                  : "Roster cache has finished refreshing."}
              </Text>

              <TouchableOpacity
                style={[
                  styles.finishedButton,
                  refreshModalType === "error" && styles.errorFinishedButton,
                ]}
                onPress={() => setRefreshModalMessage("")}
              >
                <View style={styles.buttonContentRow}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color="#ffffff"
                    style={{ marginRight: 6 }}
                  />

                  <Text style={styles.finishedButtonText}>
                    {refreshModalType === "error" ? "OK" : "Finished"}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
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

  refreshRosterButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 5,
  },

  refreshRosterButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },

  refreshMessage: {
    textAlign: "center",
    color: "#1f4e9e",
    fontWeight: "800",
    marginTop: 4,
    marginBottom: 8,
  },

  lastRefreshText: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
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

  disabledButton: {
    opacity: 0.45,
  },

  versionFooter: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },

toastOverlay: {
  ...modalStyles.overlay,
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.25)",
  zIndex: 99999,
},

saveToast: {
  ...modalStyles.card,
  alignItems: "center",
  justifyContent: "center",
},

  errorToast: {
    borderWidth: 3,
    borderColor: "#c62828",
  },

  saveToastText: {
    color: "#15803d",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },

  errorToastText: {
    color: "#c62828",
  },

  saveToastSubText: {
    color: "#555555",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },

  finishedButton: {
    marginTop: 18,
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 26,
    alignItems: "center",
  },

  errorFinishedButton: {
    backgroundColor: "#c62828",
  },

  finishedButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  submissionStatusButton: {
  backgroundColor: "#15803d",
  borderRadius: 12,
  paddingVertical: 16,
  paddingHorizontal: 18,
  alignItems: "center",
  justifyContent: "center",
},

waiverManagementButton: {
  backgroundColor: "#660000",
  borderRadius: 12,
  paddingVertical: 16,
  paddingHorizontal: 18,
  alignItems: "center",
  justifyContent: "center",
},

diagnosticsButton: {
  backgroundColor: "#1f4e9e",
  borderRadius: 12,
  paddingVertical: 16,
  paddingHorizontal: 18,
  alignItems: "center",
  justifyContent: "center",
},
});
