import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  Switch,
  View,
} from "react-native";
import { clearAdminLogin, isAdminLoggedIn } from "../stores/adminstore";
import { adminFetch, API_BASE } from "../utils/appconfig";
export default function AdminScreen() {
  const [showMasterReset, setShowMasterReset] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetComplete, setResetComplete] = useState(false);
  const [allStarFeaturesEnabled, setAllStarFeaturesEnabled] = useState(true);
  const [allStarSettingLoading, setAllStarSettingLoading] = useState(true);
  const [allStarSettingSaving, setAllStarSettingSaving] = useState(false);
  useFocusEffect(
    useCallback(() => {
      checkAdmin();
      loadAllStarFeaturesSetting();
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

  async function loadAllStarFeaturesSetting() {
    try {
      setAllStarSettingLoading(true);

      const response = await adminFetch(`${API_BASE}/api/admin/config`);
      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || "All-Star features setting could not be loaded.");
      }

      setAllStarFeaturesEnabled(data?.config?.allStarFeaturesEnabled !== false);
    } catch (error) {
      console.log("ALL-STAR FEATURES LOAD ERROR:", error);
      setAllStarFeaturesEnabled(true);
    } finally {
      setAllStarSettingLoading(false);
    }
  }

  async function updateAllStarFeatures(enabled: boolean) {
    if (allStarSettingSaving || allStarSettingLoading) return;

    const previousValue = allStarFeaturesEnabled;
    setAllStarFeaturesEnabled(enabled);
    setAllStarSettingSaving(true);

    try {
      const response = await adminFetch(`${API_BASE}/api/admin/all-star-features`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || "All-Star features setting could not be saved.");
      }

      setAllStarFeaturesEnabled(data.allStarFeaturesEnabled !== false);
    } catch (error) {
      console.log("ALL-STAR FEATURES SAVE ERROR:", error);
      setAllStarFeaturesEnabled(previousValue);
    } finally {
      setAllStarSettingSaving(false);
    }
  }

  function openMasterReset() {
    setResetPassword("");
    setResetConfirmation("");
    setResetError("");
    setResetComplete(false);
    setShowMasterReset(true);
  }

  function closeMasterReset() {
    if (resetting) return;
    setShowMasterReset(false);
    setResetPassword("");
    setResetConfirmation("");
    setResetError("");
    setResetComplete(false);
  }

  async function runMasterReset() {
    if (resetConfirmation.trim().toUpperCase() !== "RESET" || !resetPassword.trim()) return;

    setResetting(true);
    setResetError("");

    try {
      const response = await adminFetch(`${API_BASE}/api/admin/master-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: resetPassword,
          confirmation: resetConfirmation,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || "Master reset failed.");
      }

      setResetComplete(true);
      setResetPassword("");
      setResetConfirmation("");
    } catch (error: any) {
      setResetError(error?.message || "Master reset failed.");
    } finally {
      setResetting(false);
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
              Access tournament operations and manage administrative configuration.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.featureToggleRow}>
              <View style={styles.featureToggleTextWrap}>
                <Text style={styles.sectionHeaderLeft}>All-Star Features</Text>
                <Text style={styles.featureToggleDescription}>
                  Show or hide All-Star selections, schedules, game view, rules, waiver prompts, and All-Star status information for members.
                </Text>
              </View>

              <View style={styles.featureToggleControl}>
                {allStarSettingLoading || allStarSettingSaving ? (
                  <ActivityIndicator size="small" color="#1f4e9e" />
                ) : (
                  <Switch
                    value={allStarFeaturesEnabled}
                    onValueChange={updateAllStarFeatures}
                  />
                )}
                <Text
                  style={[
                    styles.featureToggleStatus,
                    allStarFeaturesEnabled
                      ? styles.featureToggleStatusOn
                      : styles.featureToggleStatusOff,
                  ]}
                >
                  {allStarFeaturesEnabled ? "ON" : "OFF"}
                </Text>
              </View>
            </View>
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

                <Text style={styles.buttonText}>Open Communications Center</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>Game Schedules</Text>

            <TouchableOpacity
              style={styles.gameSchedulesButton}
              onPress={() => router.push("/gameschedules")}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="calendar-outline"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.buttonText}>Manage Game Schedules</Text>
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

      <Text style={styles.buttonText}>Configure Announcer</Text>
    </View>
  </TouchableOpacity>
</View>

          <View style={[styles.sectionCard, styles.dangerCard]}>
            <View style={styles.dangerTitleRow}>
              <Ionicons name="warning-outline" size={24} color="#b91c1c" />
              <Text style={styles.dangerHeader}>Danger Zone</Text>
            </View>

            <Text style={styles.dangerDescription}>
              Prepare the All-Star app for a new event or season. This clears All-Star selections, East/West assignments, saved lineups, managers, and live game progress. Game schedules and app configuration are preserved.
            </Text>

            <TouchableOpacity style={styles.masterResetButton} onPress={openMasterReset}>
              <View style={styles.buttonContentRow}>
                <Ionicons name="trash-outline" size={22} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Master Reset</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.versionFooter}>
            NTABL All-Star App • Version 1.0
          </Text>
        </ScrollView>

        <Modal
          visible={showMasterReset}
          transparent
          animationType="fade"
          onRequestClose={closeMasterReset}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.resetModal}>
              {resetComplete ? (
                <>
                  <Ionicons name="checkmark-circle" size={58} color="#15803d" style={styles.modalIcon} />
                  <Text style={styles.resetModalTitle}>Master Reset Complete</Text>
                  <Text style={styles.resetModalText}>
                    All-Star selections, team assignments, lineups, managers, and live game progress have been cleared. Game schedules and reusable app configuration were not changed.
                  </Text>
                  <TouchableOpacity style={styles.doneButton} onPress={closeMasterReset}>
                    <Text style={styles.buttonText}>Done</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons name="warning" size={58} color="#b91c1c" style={styles.modalIcon} />
                  <Text style={styles.resetModalTitle}>Master Reset All-Star Data?</Text>
                  <Text style={styles.resetWarning}>THIS CANNOT BE UNDONE</Text>

                  <Text style={styles.resetModalText}>
                    This will permanently clear team All-Star selections, East/West assignments, saved batting lineups, All-Star manager assignments, announcer player/manager edits, scores, innings, outs, and batter tracking.
                  </Text>

                  <View style={styles.preservedBox}>
                    <Text style={styles.preservedTitle}>This will NOT clear:</Text>
                    <Text style={styles.preservedText}>
                      • Game Schedules{"\n"}
                      • Division Configuration{"\n"}
                      • Announcer Configuration{"\n"}
                      • Admin or Member Accounts{"\n"}
                      • Communications Data{"\n"}
                      • Waivers
                    </Text>
                  </View>

                  <Text style={styles.inputLabel}>Admin Password</Text>
                  <TextInput
                    style={styles.resetInput}
                    value={resetPassword}
                    onChangeText={setResetPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    editable={!resetting}
                    placeholder="Enter admin password"
                  />

                  <Text style={styles.inputLabel}>Type RESET to Confirm</Text>
                  <TextInput
                    style={styles.resetInput}
                    value={resetConfirmation}
                    onChangeText={setResetConfirmation}
                    autoCapitalize="characters"
                    editable={!resetting}
                    placeholder="RESET"
                  />

                  {!!resetError && <Text style={styles.resetError}>{resetError}</Text>}

                  <View style={styles.resetButtonRow}>
                    <TouchableOpacity style={styles.cancelResetButton} onPress={closeMasterReset} disabled={resetting}>
                      <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.confirmResetButton,
                        (resetConfirmation.trim().toUpperCase() !== "RESET" || !resetPassword.trim() || resetting) && styles.disabledResetButton,
                      ]}
                      onPress={runMasterReset}
                      disabled={resetConfirmation.trim().toUpperCase() !== "RESET" || !resetPassword.trim() || resetting}
                    >
                      {resetting ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.buttonText}>Reset All-Star Data</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
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

  featureToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  featureToggleTextWrap: {
    flex: 1,
  },
  sectionHeaderLeft: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1f4e9e",
    marginBottom: 5,
  },
  featureToggleDescription: {
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  featureToggleControl: {
    minWidth: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  featureToggleStatus: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "900",
  },
  featureToggleStatusOn: {
    color: "#15803d",
  },
  featureToggleStatusOff: {
    color: "#b91c1c",
  },

  communicationsButton: {
    backgroundColor: "#0f766e",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  gameSchedulesButton: {
    backgroundColor: "#0369a1",
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



dangerCard: {
    borderWidth: 2,
    borderColor: "#fecaca",
    backgroundColor: "#fffafa",
  },
  dangerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  dangerHeader: {
    fontSize: 20,
    fontWeight: "900",
    color: "#b91c1c",
    marginLeft: 7,
  },
  dangerDescription: {
    color: "#4b5563",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 14,
  },
  masterResetButton: {
    backgroundColor: "#b91c1c",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  resetModal: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
  },
  modalIcon: {
    alignSelf: "center",
    marginBottom: 8,
  },
  resetModalTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
    marginBottom: 6,
  },
  resetWarning: {
    color: "#b91c1c",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 14,
  },
  resetModalText: {
    color: "#374151",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 14,
  },
  preservedBox: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  preservedTitle: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 14,
    marginBottom: 6,
  },
  preservedText: {
    color: "#374151",
    fontSize: 14,
    lineHeight: 21,
  },
  inputLabel: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
  },
  resetInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#ffffff",
    marginBottom: 14,
  },
  resetError: {
    color: "#b91c1c",
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },
  resetButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  cancelResetButton: {
    flex: 1,
    backgroundColor: "#4b5563",
    borderRadius: 11,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmResetButton: {
    flex: 1.5,
    backgroundColor: "#b91c1c",
    borderRadius: 11,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledResetButton: {
    opacity: 0.4,
  },
  doneButton: {
    backgroundColor: "#15803d",
    borderRadius: 11,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
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
