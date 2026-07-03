import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
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
import { setAdminLoggedIn } from "../stores/adminstore";
import { API_BASE } from "../utils/appconfig";
import {
  authenticateWithBiometrics,
  canUseBiometrics,
  getAdminPassword,
  saveAdminPassword,
} from "../utils/biometricauth";

type MessageType = "success" | "error" | "warning" | "choice";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showBiometricLogin, setShowBiometricLogin] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<MessageType>("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [pendingBiometricPassword, setPendingBiometricPassword] = useState("");

  const { width, height } = useWindowDimensions();
  const isTabletLayout = width >= 700;
  const isShortScreen = height < 760;

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  async function checkBiometricAvailability() {
    const biometricsAvailable = await canUseBiometrics();
    const savedPassword = await getAdminPassword();

    setShowBiometricLogin(biometricsAvailable && !!savedPassword);
  }

  function showMessage(type: MessageType, title: string, message: string) {
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setPendingBiometricPassword("");
  }

  async function handleAdminLogin() {
    try {
      const response = await fetch(`${API_BASE}/api/auth/admin-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        showMessage(
          "error",
          "Access Denied",
          data.message || "Invalid admin password."
        );
        return;
      }

      await setAdminLoggedIn(true, data.adminToken);

      const biometricsAvailable = await canUseBiometrics();

      if (!biometricsAvailable) {
        router.replace("/admin");
        return;
      }

      setPendingBiometricPassword(password.trim());
      showMessage(
        "choice",
        "Enable Fingerprint / Face ID?",
        "Would you like to use fingerprint or Face ID for Admin Login on this device?"
      );
    } catch (e) {
      console.log(e);
      showMessage("error", "Connection Error", "Could not reach the backend.");
    }
  }

  async function handleEnableBiometrics() {
    await saveAdminPassword(pendingBiometricPassword);
    setShowBiometricLogin(true);
    setModalVisible(false);
    setPendingBiometricPassword("");
    router.replace("/admin");
  }

  function handleSkipBiometrics() {
    setModalVisible(false);
    setPendingBiometricPassword("");
    router.replace("/admin");
  }

  async function handleBiometricAdminLogin() {
    const authenticated = await authenticateWithBiometrics();

    if (!authenticated) return;

    const savedPassword = await getAdminPassword();

    if (!savedPassword) {
      showMessage(
        "warning",
        "No Saved Admin Login",
        "Please log in once with the admin password first."
      );
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/admin-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: savedPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        showMessage(
          "error",
          "Saved Password Invalid",
          data.message || "Please log in manually."
        );
        return;
      }

      await setAdminLoggedIn(true, data.adminToken);
      router.replace("/admin");
    } catch (e) {
      console.log(e);
      showMessage("error", "Connection Error", "Could not reach the backend.");
    }
  }

  const isError = modalType === "error";
  const isWarning = modalType === "warning";
  const isChoice = modalType === "choice";

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
          keyboardShouldPersistTaps="handled"
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
              source={require("../assets/NTABL-Logo.png")}
              style={[styles.logo, isShortScreen && styles.logoShort]}
              resizeMode="contain"
            />

            <Text style={styles.title}>Admin Login</Text>

            <Text style={styles.subtitle}>Authorized Access Only</Text>

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Admin Password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleAdminLogin}
                autoCapitalize="none"
              />

              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color="#6b7280"
                />
              </Pressable>
            </View>

            <Pressable style={styles.button} onPress={handleAdminLogin}>
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.buttonText}>Admin Login</Text>
              </View>
            </Pressable>

            {showBiometricLogin && (
              <Pressable
                style={styles.biometricButton}
                onPress={handleBiometricAdminLogin}
              >
                <View style={styles.buttonContentRow}>
                  <Ionicons
                    name="finger-print-outline"
                    size={22}
                    color="#ffffff"
                    style={{ marginRight: 8 }}
                  />

                  <Text style={styles.buttonText}>
                    Use Fingerprint / Face ID
                  </Text>
                </View>
              </Pressable>
            )}
<Pressable
  style={styles.forgotPasswordButton}
  onPress={() => router.push("/adminforgotpassword")}
>
  <View style={styles.buttonContentRow}>
    <Ionicons
      name="help-circle-outline"
      size={22}
      color="#ffffff"
      style={{ marginRight: 8 }}
    />

    <Text style={styles.buttonText}>Forgot Admin Password?</Text>
  </View>
</Pressable>
            <Pressable
              style={styles.changePasswordButton}
              onPress={() => router.push("/changeadminpassword")}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="key-outline"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.buttonText}>Change Admin Password</Text>
              </View>
            </Pressable>

            <Text style={styles.helperText}>
              Admin access is restricted to authorized NTABL staff.
            </Text>

            <Text style={styles.versionFooter}>
              NTABL All-Star App • Version 1.0
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.messageModal,
              isError && styles.errorModal,
              isWarning && styles.warningModal,
              isChoice && styles.choiceModal,
            ]}
          >
            <Ionicons
              name={
                isError
                  ? "alert-circle"
                  : isWarning
                  ? "warning"
                  : isChoice
                  ? "finger-print-outline"
                  : "checkmark-circle"
              }
              size={54}
              color={
                isError
                  ? "#c62828"
                  : isWarning
                  ? "#f97316"
                  : isChoice
                  ? "#1d4ed8"
                  : "#15803d"
              }
              style={{ marginBottom: 10 }}
            />

            <Text
              style={[
                styles.messageTitle,
                isError && styles.errorText,
                isWarning && styles.warningText,
                isChoice && styles.choiceText,
              ]}
            >
              {modalTitle}
            </Text>

            <Text style={styles.messageBody}>{modalMessage}</Text>

            {isChoice ? (
              <View style={styles.choiceButtonRow}>
                <Pressable
                  style={styles.notNowButton}
                  onPress={handleSkipBiometrics}
                >
                  <View style={styles.buttonContentRow}>
                    <Ionicons
                      name="close-circle-outline"
                      size={18}
                      color="#ffffff"
                      style={{ marginRight: 6 }}
                    />

                    <Text style={styles.choiceButtonText}>Not Now</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.enableButton}
                  onPress={handleEnableBiometrics}
                >
                  <View style={styles.buttonContentRow}>
                    <Ionicons
                      name="finger-print-outline"
                      size={18}
                      color="#ffffff"
                      style={{ marginRight: 6 }}
                    />

                    <Text style={styles.choiceButtonText}>Enable</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[
                  styles.modalOkButton,
                  isError && styles.errorOkButton,
                  isWarning && styles.warningOkButton,
                ]}
                onPress={closeModal}
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
            )}
          </View>
        </View>
      </Modal>
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
    textAlign: "center",
    marginBottom: 6,
    color: "#1f4e9e",
  },

  subtitle: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 18,
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
    paddingVertical: 13,
    paddingHorizontal: 12,
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },

  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  button: {
    marginTop: 2,
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  biometricButton: {
    marginTop: 12,
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  changePasswordButton: {
    marginTop: 12,
    backgroundColor: "#c62828",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
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
  },

  helperText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 14,
  },

  versionFooter: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 22,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  messageModal: {
    width: "84%",
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 22,
    alignItems: "center",
    elevation: 12,
  },

  errorModal: {
    borderWidth: 3,
    borderColor: "#c62828",
  },

  warningModal: {
    borderWidth: 3,
    borderColor: "#f97316",
  },

  choiceModal: {
    borderWidth: 3,
    borderColor: "#1d4ed8",
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

  warningText: {
    color: "#f97316",
  },

  choiceText: {
    color: "#1d4ed8",
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
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: "center",
  },

  errorOkButton: {
    backgroundColor: "#c62828",
  },

  warningOkButton: {
    backgroundColor: "#f97316",
  },

  modalOkText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  choiceButtonRow: {
    flexDirection: "row",
    marginTop: 18,
    width: "100%",
  },

  notNowButton: {
    flex: 1,
    backgroundColor: "#c62828",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginRight: 8,
  },

  enableButton: {
    flex: 1,
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginLeft: 8,
  },

  choiceButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  forgotPasswordButton: {
  marginTop: 12,
  backgroundColor: "#2563eb",
  borderRadius: 12,
  paddingVertical: 14,
  alignItems: "center",
},
});
