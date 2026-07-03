import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { API_BASE } from "../utils/appconfig";

export default function ForgotPasswordScreen() {
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageTitle, setMessageTitle] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messageCallback, setMessageCallback] = useState<(() => void) | null>(null);

function showMessage(title: string, message: string) {
  setMessageTitle(title);
  setMessageText(message);
  setShowMessageModal(true);
}

async function sendCode() {
  try {
    Keyboard.dismiss();
    setLoading(true);

    const response = await fetch(
      `${API_BASE}/api/auth/forgot-admin-password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      showMessage(
        "Reset Failed",
        data.message || "Unable to send admin reset code."
      );
      return;
    }

    setCodeSent(true);

    showMessage(
      "Code Sent",
      "A reset code has been emailed to the configured NTABL administrator."
    );
  } catch (e) {
    console.log(e);
    showMessage("Connection Error", "Could not reach the backend.");
  } finally {
    setLoading(false);
  }
}

  async function resetPassword() {
    if (!code.trim() || !newPassword || !confirmPassword) {
      showMessage("Missing Info", "Please Complete All Fields.");
      return;
    }

    if (newPassword.length < 8) {
      showMessage(
  "Password Too Short",
  "New Password Must Be at Least 8 Characters."
);
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage(
  "Passwords Do Not Match",
  "Please Re-Enter Your New Password."
);
      return;
    }

    try {
      Keyboard.dismiss();
      setLoading(true);

      const response = await fetch(`${API_BASE}/api/auth/reset-admin-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
body: JSON.stringify({
  code: code.trim(),
  newPassword,
}),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        showMessage(
  "Reset Failed",
  data.message || "Unable to Reset Password."
);
        return;
      }

setMessageTitle("Admin Password Reset");
setMessageText("Your Admin Password Has Been Updated.");
setMessageCallback(() => () => router.replace("/login"));
setShowMessageModal(true);
    } catch (e) {
      console.log(e);
      showMessage("Connection Error", "Could Not Reach the Backend.");
    } finally {
      setLoading(false);
    }
  }

  function passwordInput(
    value: string,
    setValue: (value: string) => void,
    placeholder: string,
    visible: boolean,
    setVisible: (value: boolean) => void
  ) {
    return (
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder={placeholder}
          value={value}
          onChangeText={setValue}
          secureTextEntry={!visible}
          editable={!loading}
          autoCapitalize="none"
        />

        <Pressable
          onPress={() => setVisible(!visible)}
          style={styles.eyeButton}
          disabled={loading}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={18}
            color="#6b7280"
          />
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.replace("/login")}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Image
            source={require("../assets/NTABL-Logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.title}>Forgot Admin Password</Text>

          <Text style={styles.subtitle}>
            We&apos;ll Send an Admin Reset Code to the Configured Admin Email.
          </Text>

<Text style={styles.adminResetNotice}>
  This Will Send a Reset Code to the Configured NTABL Admin Email.
</Text>
          {!codeSent ? (
            <Pressable
              style={[styles.button, loading && styles.disabledButton]}
              onPress={sendCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <View style={styles.buttonContentRow}>
                  <Ionicons
                    name="mail-outline"
                    size={22}
                    color="#ffffff"
                    style={{ marginRight: 8 }}
                  />

                  <Text style={styles.buttonText}>Send Reset Code</Text>
                </View>
              )}
            </Pressable>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="6-Digit Code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                editable={!loading}
              />

              {passwordInput(
                newPassword,
                setNewPassword,
                "New Password",
                showPassword,
                setShowPassword
              )}

              {passwordInput(
                confirmPassword,
                setConfirmPassword,
                "Confirm New Password",
                showConfirm,
                setShowConfirm
              )}

              <Pressable
                style={[styles.button, loading && styles.disabledButton]}
                onPress={resetPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <View style={styles.buttonContentRow}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={22}
                      color="#ffffff"
                      style={{ marginRight: 8 }}
                    />

                    <Text style={styles.buttonText}>Reset Password</Text>
                  </View>
                )}
              </Pressable>

<Pressable
  style={styles.secondaryButton}
  onPress={sendCode}
  disabled={loading}
>
  <View style={styles.buttonContentRow}>
    <Ionicons
      name="paper-plane-outline"
      size={22}
      color="#ffffff"
      style={{ marginRight: 8 }}
    />

    <Text style={styles.secondaryButtonText}>
      Send New Code
    </Text>
  </View>
</Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showMessageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMessageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.messageModal}>
            <Ionicons
              name={
                messageTitle.includes("Sent") || messageTitle.includes("Reset")
                  ? "checkmark-circle"
                  : "alert-circle"
              }
              size={54}
              color={
                messageTitle.includes("Sent") || messageTitle.includes("Reset")
                  ? "#15803d"
                  : "#c62828"
              }
              style={{ marginBottom: 10 }}
            />

            <Text
              style={[
                styles.messageTitle,
                messageTitle.includes("Sent") || messageTitle.includes("Reset")
                  ? styles.successText
                  : styles.errorText,
              ]}
            >
              {messageTitle}
            </Text>

            <Text style={styles.messageBody}>{messageText}</Text>

            <Pressable
              style={[
                styles.modalOkButton,
                !(messageTitle.includes("Sent") || messageTitle.includes("Reset")) &&
                  styles.errorOkButton,
              ]}
              onPress={() => {
                setShowMessageModal(false);
                const callback = messageCallback;
                setMessageCallback(null);
                if (callback) callback();
              }}
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 50,
    backgroundColor: "#f5f7fb",
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    width: "100%",
    marginBottom: 12,
  },

  backButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  backButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
  },

  logo: {
    width: 140,
    height: 140,
    alignSelf: "center",
    marginBottom: 12,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    color: "#1f4e9e",
  },

  subtitle: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 20,
    color: "#555",
  },

adminResetNotice: {
  backgroundColor: "#eff6ff",
  borderWidth: 1,
  borderColor: "#bfdbfe",
  borderRadius: 12,
  color: "#1f4e9e",
  fontSize: 14,
  fontWeight: "800",
  lineHeight: 20,
  marginBottom: 14,
  padding: 12,
  textAlign: "center",
},

  input: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#ffffff",
  },

  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    marginBottom: 12,
  },

  passwordInput: {
    flex: 1,
    padding: 12,
  },

  eyeButton: {
    paddingHorizontal: 8,
  },

  button: {
    marginTop: 8,
    backgroundColor: "#15803d",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

secondaryButton: {
  marginTop: 12,
  backgroundColor: "#1d4ed8",
  borderRadius: 10,
  paddingVertical: 14,
  alignItems: "center",
},

secondaryButtonText: {
  color: "#ffffff",
  fontSize: 16,
  fontWeight: "700",
},

  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  disabledButton: {
    opacity: 0.55,
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

messageTitle: {
  fontSize: 24,
  fontWeight: "900",
  textAlign: "center",
},

successText: {
  color: "#15803d",
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
