import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { API_BASE } from "../utils/appconfig";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    if (!email.trim()) {
      Alert.alert("Missing Email", "Please enter your email address.");
      return;
    }

    try {
      Keyboard.dismiss();
      setLoading(true);

      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        Alert.alert("Reset Failed", data.message || "Unable to send reset code.");
        return;
      }

      setCodeSent(true);
      Alert.alert("Code Sent", "Check your email for the 6-digit reset code.");
    } catch (e) {
      console.log(e);
      Alert.alert("Connection Error", "Could not reach the backend.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    if (!code.trim() || !newPassword || !confirmPassword) {
      Alert.alert("Missing Info", "Please complete all fields.");
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert("Password Too Short", "New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords Do Not Match", "Please re-enter your new password.");
      return;
    }

    try {
      Keyboard.dismiss();
      setLoading(true);

      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        Alert.alert("Reset Failed", data.message || "Unable to reset password.");
        return;
      }

      Alert.alert("Password Reset", "Your password has been updated.", [
        { text: "OK", onPress: () => router.replace("/login") },
      ]);
    } catch (e) {
      console.log(e);
      Alert.alert("Connection Error", "Could not reach the backend.");
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

          <Text style={styles.title}>Forgot Password</Text>

          <Text style={styles.subtitle}>
            Enter Your Manager Email and We&apos;ll Send You a Reset Code.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading && !codeSent}
          />

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
});
