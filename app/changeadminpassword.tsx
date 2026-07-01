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
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
import { API_BASE } from "../utils/appconfig";

type MessageType = "success" | "error" | "warning";

export default function ChangeAdminPasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<MessageType>("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [returnAfterSuccess, setReturnAfterSuccess] = useState(false);

  const { width, height } = useWindowDimensions();
  const isTabletLayout = width >= 700;
  const isShortScreen = height < 760;

  function showMessage(
    type: MessageType,
    title: string,
    message: string,
    goToAdminAfter = false
  ) {
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message);
    setReturnAfterSuccess(goToAdminAfter);
    setModalVisible(true);

    if (goToAdminAfter) {
      setTimeout(() => {
        setModalVisible(false);
        router.replace("/admin");
      }, 1800);
    }
  }

  async function handleChangeAdminPassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage(
        "warning",
        "Missing Info",
        "Please complete all password fields."
      );
      return;
    }

    if (newPassword.length < 8) {
      showMessage(
        "warning",
        "Password Too Short",
        "New password must be at least 8 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage(
        "warning",
        "Passwords Do Not Match",
        "Please re-enter your new password."
      );
      return;
    }

    try {
      Keyboard.dismiss();
      setLoading(true);

      const response = await fetch(`${API_BASE}/api/auth/change-admin-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        showMessage(
          "error",
          "Password Not Changed",
          data.message || "Unable to change admin password."
        );
        return;
      }

      showMessage(
        "success",
        "Password Updated!",
        "The admin password has been changed successfully.",
        true
      );
    } catch (e) {
      console.log(e);
      showMessage("error", "Connection Error", "Could not reach the backend.");
    } finally {
      setLoading(false);
    }
  }

  function passwordField(
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
          placeholderTextColor="#9ca3af"
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
            size={22}
            color="#6b7280"
          />
        </Pressable>
      </View>
    );
  }

  const isError = modalType === "error";
  const isWarning = modalType === "warning";

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
              onPress={() => router.replace("/adminlogin")}
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

            <Text style={styles.title}>Admin Password</Text>

            <Text style={styles.subtitle}>
              Update the secure password used for Admin Control Panel access.
            </Text>

            <View style={styles.formSection}>
              {passwordField(
                currentPassword,
                setCurrentPassword,
                "Current Admin Password",
                showCurrent,
                setShowCurrent
              )}

              {passwordField(
                newPassword,
                setNewPassword,
                "New Admin Password",
                showNew,
                setShowNew
              )}

              {passwordField(
                confirmPassword,
                setConfirmPassword,
                "Confirm New Admin Password",
                showConfirm,
                setShowConfirm
              )}
            </View>

            <Pressable
              style={[styles.saveButton, loading && styles.disabledButton]}
              onPress={handleChangeAdminPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <View style={styles.buttonContentRow}>
                  <Ionicons
                    name="key-outline"
                    size={22}
                    color="#ffffff"
                    style={{ marginRight: 8 }}
                  />

                  <Text style={styles.saveButtonText}>Update Admin Password</Text>
                </View>
              )}
            </Pressable>

            <Text style={styles.helperText}>
              Your new password must be at least 8 characters.
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
        onRequestClose={() => {
          if (!returnAfterSuccess) {
            setModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.messageModal,
              isError && styles.errorModal,
              isWarning && styles.warningModal,
            ]}
          >
            <Ionicons
              name={
                isError
                  ? "alert-circle"
                  : isWarning
                  ? "warning"
                  : "checkmark-circle"
              }
              size={54}
              color={isError ? "#c62828" : isWarning ? "#f97316" : "#15803d"}
              style={{ marginBottom: 10 }}
            />

            <Text
              style={[
                styles.messageTitle,
                isError && styles.errorText,
                isWarning && styles.warningText,
              ]}
            >
              {modalTitle}
            </Text>

            <Text style={styles.messageBody}>{modalMessage}</Text>

            {!returnAfterSuccess && (
              <Pressable
                style={[
                  styles.modalOkButton,
                  isError && styles.errorOkButton,
                  isWarning && styles.warningOkButton,
                ]}
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
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 6,
  },

  subtitle: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 18,
  },

  formSection: {
    marginTop: 2,
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

  saveButton: {
    marginTop: 6,
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  helperText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 12,
  },

  versionFooter: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 22,
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

  errorModal: {
    borderWidth: 3,
    borderColor: "#c62828",
  },

  warningModal: {
    borderWidth: 3,
    borderColor: "#f97316",
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
});
