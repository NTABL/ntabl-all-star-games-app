import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { isAdminLoggedIn } from "../stores/adminstore";
import { adminFetch, API_BASE } from "../utils/appconfig";

export default function SmsCenterScreen() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState(
    "This is a test text message from the NTABL All-Star Games app."
  );
  const [sending, setSending] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [resultTitle, setResultTitle] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [resultType, setResultType] = useState<"success" | "error" | "warning">(
    "success"
  );

  function showResult(
    type: "success" | "error" | "warning",
    title: string,
    text: string
  ) {
    setResultType(type);
    setResultTitle(title);
    setResultMessage(text);
    setResultVisible(true);
  }

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

  async function sendTestSms() {
    const cleanPhoneNumber = phoneNumber.trim();
    const cleanMessage = message.trim();

    if (!cleanPhoneNumber) {
      showResult(
        "warning",
        "Phone Number Required",
        "Enter the mobile phone number that should receive the test message."
      );
      return;
    }

    if (!cleanMessage) {
      showResult(
        "warning",
        "Message Required",
        "Enter the test message that should be sent."
      );
      return;
    }

    try {
      Keyboard.dismiss();
      setSending(true);

      const response = await adminFetch(
        `${API_BASE}/api/admin/test-sms`,
        {
          method: "POST",
          body: JSON.stringify({
            to: cleanPhoneNumber,
            message: cleanMessage,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "The test text message could not be sent."
        );
      }

      showResult(
        "success",
        "SMS Submitted",
        `Twilio accepted the message for ${cleanPhoneNumber}.\n\nStatus: ${
          data?.sms?.status || "queued"
        }`
      );
    } catch (error) {
      console.log("TEST SMS ERROR:", error);

      showResult(
        "error",
        "SMS Failed",
        error instanceof Error
          ? error.message
          : "The text message could not be submitted."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.replace("/communications")}
              style={styles.backButton}
              disabled={sending}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="chevron-back-outline"
                  size={17}
                  color="#ffffff"
                  style={styles.buttonIcon}
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

            <Text style={styles.title}>Text Message Communications</Text>

            <Text style={styles.subtitle}>
              Send live SMS messages through the NTABL Twilio account.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIcon}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={24}
                  color="#ffffff"
                />
              </View>

              <View style={styles.sectionTitleText}>
                <Text style={styles.sectionHeader}>Send Text Message</Text>
                <Text style={styles.sectionDescription}>
                  Send one live message to a mobile phone through the NTABL Twilio account.
                </Text>
              </View>
            </View>

            <Text style={styles.label}>Destination Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Example: (817) 555-1234"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              editable={!sending}
              returnKeyType="next"
            />

            <Text style={styles.helperText}>
              Enter a valid 10-digit U.S. mobile number.
            </Text>

            <Text style={styles.label}>Test Message</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={message}
              onChangeText={setMessage}
              placeholder="Enter the test message."
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              editable={!sending}
              maxLength={1600}
            />

            <Text style={styles.characterCount}>
              {message.length.toLocaleString()} / 1,600
            </Text>

            <TouchableOpacity
              style={[
                styles.sendButton,
                sending && styles.sendButtonDisabled,
              ]}
              onPress={sendTestSms}
              disabled={sending}
            >
              <View style={styles.buttonContentRow}>
                {sending ? (
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                    style={styles.buttonIcon}
                  />
                ) : (
                  <Ionicons
                    name="send-outline"
                    size={21}
                    color="#ffffff"
                    style={styles.buttonIcon}
                  />
                )}

                <Text style={styles.sendButtonText}>
                  {sending ? "Submitting SMS..." : "Send Text Message"}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.noticeBox}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color="#1f4e9e"
                style={styles.noticeIcon}
              />
              <Text style={styles.noticeText}>
                This sends a real text message and may count toward Twilio usage.
              </Text>
            </View>
          </View>

          <Text style={styles.versionFooter}>
            NTABL All-Star App • Text Message Communications
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={resultVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResultVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.resultModalCard}>
            <Ionicons
              name={
                resultType === "success"
                  ? "checkmark-circle"
                  : resultType === "warning"
                  ? "warning"
                  : "alert-circle"
              }
              size={58}
              color={
                resultType === "success"
                  ? "#15803d"
                  : resultType === "warning"
                  ? "#f97316"
                  : "#c62828"
              }
              style={{ marginBottom: 8 }}
            />

            <Text style={styles.modalTitle}>{resultTitle}</Text>
            <Text style={styles.resultMessage}>{resultMessage}</Text>

            <TouchableOpacity
              style={styles.resultButton}
              onPress={() => setResultVisible(false)}
            >
              <Text style={styles.resultButtonText}>OK</Text>
            </TouchableOpacity>
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

  backButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },

  backButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },

  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  buttonIcon: {
    marginRight: 7,
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
    width: 130,
    height: 130,
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
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  sectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#15803d",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  sectionTitleText: {
    flex: 1,
  },

  sectionHeader: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1f4e9e",
    marginBottom: 3,
  },

  sectionDescription: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: "#6b7280",
  },

  label: {
    fontSize: 14,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 7,
  },

  input: {
    width: "100%",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#111827",
    fontSize: 16,
    marginBottom: 7,
  },

  messageInput: {
    minHeight: 130,
    paddingTop: 13,
  },

  helperText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 18,
  },

  characterCount: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: 16,
  },

  sendButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  sendButtonDisabled: {
    opacity: 0.65,
  },

  sendButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },

  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },

  noticeIcon: {
    marginRight: 8,
    marginTop: 1,
  },

  noticeText: {
    flex: 1,
    color: "#1e3a8a",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },

  comingSoonCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
  },

  comingSoonTitle: {
    color: "#374151",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 6,
  },

  comingSoonText: {
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    textAlign: "center",
  },


  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  resultModalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 10,
  },

  modalTitle: {
    color: "#1f4e9e",
    fontSize: 23,
    fontWeight: "900",
    textAlign: "center",
  },

  resultMessage: {
    color: "#4b5563",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },

  resultButton: {
    width: "100%",
    backgroundColor: "#1d4ed8",
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 16,
  },

  resultButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  versionFooter: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
});
