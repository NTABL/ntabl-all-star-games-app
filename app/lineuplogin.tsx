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

export default function LineupLoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Missing Info", "Please enter your lineup username and password.");
      return;
    }

    try {
      Keyboard.dismiss();
      setLoading(true);

      const response = await fetch(`${API_BASE}/api/lineup/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        Alert.alert("Login Failed", data.message || "Unable to log in.");
        return;
      }

      router.replace({
        pathname: "/lineupbuilder",
        params: {
          username: data.user.username,
          displayName: data.user.displayName,
          squad: data.user.squad,
          divisionIds: JSON.stringify(data.user.divisionIds),
        },
      });
    } catch (e) {
      console.log(e);
      Alert.alert(
        "Connection Error",
        "Could not reach the backend. Make sure your backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.card}>
          <Image
            source={require("../assets/All-Star Logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.title}>NTABL Charity All-Star Games</Text>
          <Text style={styles.subtitle}>Lineup Manager Login</Text>

        <TextInput
  style={styles.input}
  placeholder="Username"
  value={username}
  onChangeText={setUsername}
  autoCapitalize="none"
  editable={!loading}
/>

<View style={styles.passwordContainer}>
  <TextInput
    style={styles.passwordInput}
    placeholder="Password"
    value={password}
    onChangeText={setPassword}
    secureTextEntry={!showPassword}
    autoCapitalize="none"
    editable={!loading}
  />

  <Pressable
    onPress={() => setShowPassword(!showPassword)}
    style={styles.eyeButton}
    disabled={loading}
  >
    <Ionicons
      name={showPassword ? "eye-off-outline" : "eye-outline"}
      size={18}
      color="#6b7280"
    />
  </Pressable>
</View>

          <Pressable
            style={styles.button}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </Pressable>

          <Pressable
  style={styles.announcerButton}
  onPress={() => router.push("/announcer")}
>
  <Text style={styles.announcerButtonText}>
    Announcer View
  </Text>
</Pressable>

          <Pressable
            style={styles.backLink}
            onPress={() => router.replace("/login")}
            disabled={loading}
          >
            <Text style={styles.backLinkText}>Back to Main Login</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#f5f7fb",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
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
    color: "#111827",
  },

  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    color: "#555",
  },

  input: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#fff",
  },

  button: {
    marginTop: 8,
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  backLink: {
    marginTop: 14,
    alignItems: "center",
  },

  backLinkText: {
    color: "#1d4ed8",
    fontSize: 15,
    fontWeight: "700",
  },

  announcerButton: {
  marginTop: 12,
  backgroundColor: "#6b7280",
  borderRadius: 10,
  paddingVertical: 14,
  alignItems: "center",
},

announcerButtonText: {
  color: "#ffffff",
  fontSize: 16,
  fontWeight: "800",
},

passwordContainer: {
  flexDirection: "row",
  alignItems: "center",
  borderWidth: 1,
  borderColor: "#d0d7de",
  borderRadius: 10,
  backgroundColor: "#fff",
  marginBottom: 12,
},

passwordInput: {
  flex: 1,
  padding: 12,
},

eyeButton: {
  paddingHorizontal: 8,
},
});
