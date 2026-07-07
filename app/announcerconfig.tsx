import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { adminFetch, API_BASE } from "../utils/appconfig";
import { modalStyles } from "../utils/modalStyles";

export default function AnnouncerConfigScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [username, setUsername] = useState("Announcer");
  const [displayName, setDisplayName] = useState("NTABL Announcer");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<"success" | "error">("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const { width, height } = useWindowDimensions();
  const isTabletLayout = width >= 700;
  const isShortScreen = height < 760;

  useEffect(() => {
    loadAnnouncer();
  }, []);

  function showModal(type: "success" | "error", title: string, message: string) {
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  }

  async function loadAnnouncer() {
    try {
      setLoading(true);

      const response = await adminFetch(`${API_BASE}/api/admin/announcer`);
      const json = await response.json();

if (!json?.ok) {
  showModal("error", "Load Failed", "Announcer account could not be loaded.");
  return;
}

setModalVisible(false);

setUsername(json.announcer?.username || "Announcer");
      setDisplayName(json.announcer?.displayName || "NTABL Announcer");
      setHasPassword(!!json.announcer?.hasPassword);
      setUpdatedAt(json.announcer?.updatedAt || "");
      setPassword("");
      setConfirmPassword("");
    } catch (e) {
      console.log("LOAD ANNOUNCER CONFIG ERROR:", e);
      showModal("error", "Connection Error", "Could not reach the backend.");
    } finally {
      setLoading(false);
    }
  }

  async function saveAnnouncer() {
    const cleanUsername = username.trim();
    const cleanDisplayName = displayName.trim();
    const cleanPassword = password.trim();
    const cleanConfirmPassword = confirmPassword.trim();

    if (!cleanUsername) {
      showModal("error", "Missing Username", "Please enter an announcer username.");
      return;
    }

    if (!cleanDisplayName) {
      showModal("error", "Missing Display Name", "Please enter an announcer display name.");
      return;
    }

    if (cleanPassword || cleanConfirmPassword) {
      if (cleanPassword.length < 8) {
        showModal("error", "Password Too Short", "Password must be at least 8 characters.");
        return;
      }

      if (cleanPassword !== cleanConfirmPassword) {
        showModal("error", "Password Mismatch", "Password and confirm password do not match.");
        return;
      }
    }

    try {
      setSaving(true);

      const response = await adminFetch(`${API_BASE}/api/admin/announcer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: cleanUsername,
          displayName: cleanDisplayName,
          password: cleanPassword,
        }),
      });

      const json = await response.json();

      if (!json?.ok) {
        showModal("error", "Save Failed", json?.message || "Announcer account could not be saved.");
        return;
      }

      setUsername(json.announcer?.username || cleanUsername);
      setDisplayName(json.announcer?.displayName || cleanDisplayName);
      setHasPassword(!!json.announcer?.hasPassword);
      setUpdatedAt(json.announcer?.updatedAt || "");
      setPassword("");
      setConfirmPassword("");

      showModal(
        "success",
        "Announcer Information Saved",
        "The Announcer Login Information was Saved Successfully."
      );
    } catch (e) {
      console.log("SAVE ANNOUNCER CONFIG ERROR:", e);
      showModal("error", "Connection Error", "Could not reach the backend.");
    } finally {
      setSaving(false);
    }
  }

  const isError = modalType === "error";

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
            isShortScreen && styles.scrollContentShort,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
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

          <View style={styles.heroCard}>
            <Image
              source={require("../assets/NTABL-Logo.png")}
              style={[styles.logo, isShortScreen && styles.logoShort]}
              resizeMode="contain"
            />

            <Text style={styles.title}>Announcer Configuration</Text>

            <Text style={styles.subtitle}>
              Configure Announcer Credentials
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#1d4ed8" />
              <Text style={styles.loadingText}>Loading announcer settings...</Text>
            </View>
          ) : (
            <>
              <View style={styles.statusCard}>
                <View style={styles.statusHeaderRow}>
                  <Ionicons
                    name={hasPassword ? "lock-closed-outline" : "warning-outline"}
                    size={26}
                    color={hasPassword ? "#15803d" : "#c62828"}
                    style={{ marginRight: 8 }}
                  />

                  <Text style={styles.statusHeaderText}>
                    Announcer Account Status
                  </Text>
                </View>

                <View style={styles.statusDetailRow}>
                  <Text style={styles.statusLabel}>Username:</Text>
                  <Text style={styles.statusValue}>{username || "Not Set"}</Text>
                </View>

                <View style={styles.statusDetailRow}>
                  <Text style={styles.statusLabel}>Display Name:</Text>
                  <Text style={styles.statusValue}>
                    {displayName || "Not Set"}
                  </Text>
                </View>

                <View style={styles.statusDetailRow}>
                  <Text style={styles.statusLabel}>Password:</Text>
                  <Text
                    style={[
                      styles.statusValue,
                      hasPassword ? styles.statusGood : styles.statusBad,
                    ]}
                  >
                    {hasPassword ? "Configured" : "Not Set"}
                  </Text>
                </View>

                <Text style={styles.statusUpdated}>
                  {updatedAt
                    ? `Last Updated: ${new Date(updatedAt).toLocaleString()}`
                    : "No Update Timestamp Available."}
                </Text>
              </View>

              <View style={styles.formCard}>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Announcer"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Display Name</Text>
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="NTABL Announcer"
                  placeholderTextColor="#9ca3af"
                />

                <Text style={styles.label}>New Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={
                      hasPassword
                        ? "Leave blank to keep current password"
                        : "Enter announcer password"
                    }
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />

                  <Pressable
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={22}
                      color="#6b7280"
                    />
                  </Pressable>
                </View>

                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />

                  <Pressable
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons
                      name={
                        showConfirmPassword ? "eye-off-outline" : "eye-outline"
                      }
                      size={22}
                      color="#6b7280"
                    />
                  </Pressable>
                </View>

                <Text style={styles.helperText}>
                  Leave both password fields blank if you only want to update the
                  username or display name.
                </Text>
              </View>

              <Pressable
                style={[styles.saveButton, saving && styles.disabledButton]}
                onPress={saveAnnouncer}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <View style={styles.buttonContentRow}>
                    <Ionicons
                      name="save-outline"
                      size={22}
                      color="#ffffff"
                      style={{ marginRight: 8 }}
                    />

                    <Text style={styles.saveButtonText}>
                      Save Announcer Login Info
                    </Text>
                  </View>
                )}
              </Pressable>

              <Text style={styles.versionFooter}>
                NTABL All-Star App • Version 1.0
              </Text>
            </>
          )}
        </ScrollView>

        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.messageModal, isError && styles.errorModal]}>
              <Ionicons
                name={isError ? "alert-circle" : "checkmark-circle"}
                size={54}
                color={isError ? "#c62828" : "#15803d"}
                style={{ marginBottom: 10 }}
              />

              <Text style={[styles.messageTitle, isError && styles.errorText]}>
                {modalTitle}
              </Text>

              <Text style={styles.messageBody}>{modalMessage}</Text>

              <Pressable
                style={[styles.modalOkButton, isError && styles.errorOkButton]}
                onPress={() => setModalVisible(false)}
              >
                <View style={styles.buttonContentRow}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color="#ffffff"
                    style={{ marginRight: 6 }}
                  />

                  <Text style={styles.modalOkText}>OK</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 70,
  },

  scrollContentTablet: {
    paddingTop: 30,
    paddingBottom: 50,
  },

  scrollContentShort: {
    paddingTop: 28,
    paddingBottom: 80,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
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
    fontSize: 14,
    fontWeight: "800",
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

  logoShort: {
    width: 130,
    height: 130,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 8,
  },

  subtitle: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
  },

  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },

  loadingText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
  },

  statusCard: {
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

  statusHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  statusHeaderText: {
    color: "#1f4e9e",
    fontSize: 18,
    fontWeight: "900",
  },

  statusDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingVertical: 8,
  },

  statusLabel: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "900",
  },

  statusValue: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
    flexShrink: 1,
    marginLeft: 8,
  },

  statusGood: {
    color: "#15803d",
  },

  statusBad: {
    color: "#c62828",
  },

  statusUpdated: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 10,
  },

  formCard: {
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

  label: {
    color: "#1f4e9e",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 5,
  },

  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
    backgroundColor: "#ffffff",
    marginBottom: 12,
  },

  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    marginBottom: 12,
  },

  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },

  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  helperText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },

  saveButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 5,
  },

  saveButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },

  disabledButton: {
    opacity: 0.5,
  },

  versionFooter: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 22,
    marginBottom: 8,
  },

  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

modalOverlay: {
  ...modalStyles.overlay,
},

messageModal: {
  ...modalStyles.card,
  alignItems: "center",
},

  errorModal: {
    borderWidth: 3,
    borderColor: "#c62828",
  },

  messageTitle: {
    color: "#15803d",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },

  errorText: {
    color: "#c62828",
  },

  messageBody: {
    color: "#555555",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
  },

  modalOkButton: {
    marginTop: 18,
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: "center",
  },

  errorOkButton: {
    backgroundColor: "#c62828",
  },

  modalOkText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
});
