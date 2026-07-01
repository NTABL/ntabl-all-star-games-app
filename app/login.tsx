import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
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
import { setManagerContext } from "../stores/store";
import { API_BASE } from "../utils/appconfig";
import {
  authenticateWithBiometrics,
  canUseBiometrics,
  getManagerCredentials,
  saveManagerCredentials,
} from "../utils/biometricauth";

type MessageType = "success" | "error" | "warning" | "choice";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showBiometricLogin, setShowBiometricLogin] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<MessageType>("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const { width, height } = useWindowDimensions();
  const isTabletLayout = width >= 700;
  const isShortScreen = height < 760;

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  async function checkBiometricAvailability() {
    const biometricsAvailable = await canUseBiometrics();
    const savedCredentials = await getManagerCredentials();

    setShowBiometricLogin(biometricsAvailable && !!savedCredentials);
  }

  function showMessage(type: MessageType, title: string, message: string) {
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setPendingEmail("");
    setPendingPassword("");
  }

  async function handleBiometricLogin() {
    const authenticated = await authenticateWithBiometrics();

    if (!authenticated) return;

    const savedCredentials = await getManagerCredentials();

    if (!savedCredentials) {
      showMessage(
        "warning",
        "No Saved Login",
        "Please log in once with your email and password first."
      );
      return;
    }

    setEmail(savedCredentials.email);
    setPassword(savedCredentials.password);

    await handleLogin(true, savedCredentials.email, savedCredentials.password);
  }

  async function askToEnableBiometricLogin(
    emailValue: string,
    passwordValue: string
  ) {
    const biometricsAvailable = await canUseBiometrics();

    if (!biometricsAvailable) {
      router.replace("/dashboard");
      return;
    }

    setPendingEmail(emailValue);
    setPendingPassword(passwordValue);

    showMessage(
      "choice",
      "Enable Fingerprint / Face ID?",
      "Would you like to use fingerprint or Face ID to log in faster on this device?"
    );
  }

  async function handleEnableBiometrics() {
    await saveManagerCredentials(pendingEmail, pendingPassword);
    setShowBiometricLogin(true);
    setModalVisible(false);
    setPendingEmail("");
    setPendingPassword("");
    router.replace("/dashboard");
  }

  function handleSkipBiometrics() {
    setModalVisible(false);
    setPendingEmail("");
    setPendingPassword("");
    router.replace("/dashboard");
  }

  async function handleLogin(
    isAuto = false,
    overrideEmail?: string,
    overridePassword?: string
  ) {
    const cleanEmail = (overrideEmail || email).trim();
    const cleanPassword = (overridePassword || password).trim();

    if (!cleanEmail || !cleanPassword) {
      if (!isAuto) {
        showMessage(
          "warning",
          "Missing Info",
          "Please enter your email and password."
        );
      }

      return;
    }

    try {
      Keyboard.dismiss();
      setLoading(true);

      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        showMessage(
          "error",
          "Login Failed",
          data.message || "Unable to log in."
        );
        return;
      }

      await setManagerContext(data.manager);

      const savedCredentials = await getManagerCredentials();

      if (
        !isAuto &&
        (!savedCredentials ||
          savedCredentials.email !== cleanEmail ||
          savedCredentials.password !== cleanPassword)
      ) {
        await askToEnableBiometricLogin(cleanEmail, cleanPassword);
      } else {
        router.replace("/dashboard");
      }
    } catch (error) {
      console.log(error);
      showMessage(
        "error",
        "Connection Error",
        "Could not reach the backend. Make sure your backend is running and your phone is on the same Wi-Fi."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAnnouncerLogin() {
    const cleanUsername = email.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      showMessage(
        "warning",
        "Missing Info",
        "Please enter the announcer username and password."
      );
      return;
    }

    try {
      Keyboard.dismiss();
      setLoading(true);

      const response = await fetch(`${API_BASE}/api/auth/announcer-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: cleanUsername,
          password: cleanPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        showMessage(
          "error",
          "Announcer Login Failed",
          data.message || "Unable to Log In as Announcer."
        );
        return;
      }

      router.replace("/announcercontrol");
    } catch (error) {
      console.log(error);
      showMessage(
        "error",
        "Connection Error",
        "Could Not Reach the Backend. Make Sure Your Backend is Running and Your Phone is on the Same Wi-Fi."
      );
    } finally {
      setLoading(false);
    }
  }

    const isError = modalType === "error";
  const isWarning = modalType === "warning";
  const isChoice = modalType === "choice";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.container}
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
<View
  style={[
    styles.card,
    isTabletLayout && styles.cardTablet,
    isShortScreen && styles.cardShort,
  ]}
>
          <Image
            source={require("../assets/NTABL-Logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.mainTitle}>NTABL</Text>
          <Text style={styles.eventTitle}>Charity</Text>
          <Text style={styles.eventTitle}>All-Star Games</Text>

                    <Text style={styles.benefitText}>
            Benefiting Texas Scottish Rite for Children
          </Text>
          <Text style={styles.versionText}>Version 1.0</Text>

          <View style={styles.formSection}>
            <TextInput
              style={styles.input}
              placeholder="Email / Username"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              editable={!loading}
              returnKeyType="next"
              placeholderTextColor="#9ca3af"
            />

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
                autoComplete="password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={() => handleLogin()}
                placeholderTextColor="#9ca3af"
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

            <Pressable
              onPress={() => router.push("/forgotpassword")}
              disabled={loading}
              style={styles.forgotPasswordButton}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.managerLoginButton}
            onPress={() => handleLogin()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="baseball-outline"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.buttonText}>Manager & Player Login</Text>
              </View>
            )}
          </Pressable>

          {showBiometricLogin && (
            <Pressable
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              disabled={loading}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="finger-print-outline"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.buttonText}>Use Fingerprint / Face ID</Text>
              </View>
            </Pressable>
          )}

          <Pressable
            style={styles.donateButton}
            onPress={() => router.push("/donate")}
            disabled={loading}
          >
            <View style={styles.buttonContentRow}>
              <Ionicons
                name="heart"
                size={22}
                color="#ffffff"
                style={{ marginRight: 8 }}
              />

              <Text style={styles.buttonText}>Donate</Text>
            </View>
          </Pressable>

          <Pressable
            style={styles.announcerButton}
            onPress={handleAnnouncerLogin}
            disabled={loading}
          >
            <View style={styles.buttonContentRow}>
              <Ionicons
                name="mic-outline"
                size={22}
                color="#ffffff"
                style={{ marginRight: 8 }}
              />

              <Text style={styles.buttonText}>Announcer Login</Text>
            </View>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              © 2026 North Texas Adult Baseball League
            </Text>
            <Text style={styles.footerSubText}>
              Designed & Developed by Shawn Lee
            </Text>
          </View>
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
container: {
  flex: 1,
  backgroundColor: "#eef2f7",
},

scrollContent: {
  flexGrow: 1,
  justifyContent: "flex-start",
  paddingHorizontal: 20,
  paddingTop: 40,
  paddingBottom: 60,
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

  logo: {
    width: 150,
    height: 150,
    alignSelf: "center",
    marginBottom: 8,
  },

mainTitle: {
  fontSize: 34,
  fontWeight: "900",
  color: "#1f4e9e",
  textAlign: "center",
  marginBottom: 2,
},

eventTitle: {
  fontSize: 28,
  fontWeight: "800",
  color: "#1f4e9e",
  textAlign: "center",
  lineHeight: 30,
},

versionText: {
  color: "#1f4e9e",
  fontSize: 13,
  fontWeight: "800",
  textAlign: "center",
  marginTop: 2,
  marginBottom: 8,
},

benefitText: {
  color: "#6b7280",
  fontSize: 13,
  fontWeight: "700",
  textAlign: "center",
  marginTop: 4,
  marginBottom: 2,
},

  formSection: {
    marginTop: 2,
  },

  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },

  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    marginBottom: 10,
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

  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginBottom: 12,
  },

  forgotPasswordText: {
    color: "#1d4ed8",
    fontSize: 14,
    fontWeight: "800",
  },

  managerLoginButton: {
    marginTop: 2,
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  biometricButton: {
    marginTop: 12,
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  donateButton: {
    marginTop: 12,
    backgroundColor: "#c62828",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  announcerButton: {
    marginTop: 12,
    backgroundColor: "#374151",
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

  footer: {
    marginTop: 18,
    alignItems: "center",
  },

  footerText: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },

  footerSubText: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 2,
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

  scrollContentTablet: {
  paddingTop: 28,
  paddingBottom: 28,
},

cardTablet: {
  minHeight: "94%",
  justifyContent: "center",
},

cardShort: {
  paddingVertical: 18,
},

});
