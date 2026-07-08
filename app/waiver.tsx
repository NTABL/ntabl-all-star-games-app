import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
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
  View,
} from "react-native";
import { getManagerContext } from "../stores/store";
import { API_BASE } from "../utils/appconfig";
import { modalStyles } from "../utils/modalStyles";

type MessageType = "success" | "error" | "warning";
const {
  participantId,
  readonly,
} = useLocalSearchParams<{
  participantId?: string;
  readonly?: string;
}>();

const isReadOnly = readonly === "true";
export default function WaiverScreen() {
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const [saving, setSaving] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [managerData, setManagerData] = useState<any>(null);
  const [waiverConfig, setWaiverConfig] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<MessageType>("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  useEffect(() => {
    loadWaiverScreen();
  }, []);

async function loadWaiverScreen() {
  try {
    const manager = await getManagerContext();
    setManagerData(manager);

    const response = await fetch(`${API_BASE}/api/waivers/config`);
    const data = await response.json();

    if (response.ok && data?.ok) {
      setWaiverConfig(data.config);
    }
    const statusResponse = await fetch(
  `${API_BASE}/api/waivers/status?divisionId=${encodeURIComponent(
    manager?.division || ""
  )}&squad=${encodeURIComponent(
    manager?.allStarManagerAccess?.squad || manager?.squad || ""
  )}&role=${encodeURIComponent(
    manager?.isAllStarManager ? "all-star-manager" : String(manager?.role || "player")
  )}&personId=${encodeURIComponent(
    String(
      Array.isArray(manager?.roster)
        ? manager.roster.find(
            (player: any) =>
              String(player?.email || "").trim().toLowerCase() ===
              String(manager?.email || "").trim().toLowerCase()
          )?.id || manager?.email || "unknown"
        : manager?.email || "unknown"
    )
  )}`
);

const statusData = await statusResponse.json();

if (statusResponse.ok && statusData?.ok && statusData?.signed) {
  setSignedAt(statusData.waiver?.signedAt || null);
}
  } catch (e) {
    console.log(e);
  }
}

  function showMessage(type: MessageType, title: string, message: string) {
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
  }

function getParticipantName() {
  return managerData?.managerName || managerData?.name || "Participant";
}

function getPersonId() {
  const loggedInPlayer = Array.isArray(managerData?.roster)
    ? managerData.roster.find(
        (player: any) =>
          String(player?.email || "").trim().toLowerCase() ===
          String(managerData?.email || "").trim().toLowerCase()
      )
    : null;

  return String(
    loggedInPlayer?.id ||
      managerData?.leagueAppsId ||
      managerData?.playerId ||
      managerData?.managerEmail ||
      managerData?.email ||
      "unknown"
  );
}

function getRole() {
  if (managerData?.isAllStarManager) return "all-star-manager";
  return String(managerData?.role || "player").toLowerCase();
}

  async function signWaiver() {
    if (!agreementAccepted) {
      showMessage(
        "warning",
        "Agreement Required",
        "Please Check the Agreement Box Before Selecting Complete Waiver."
      );
      return;
    }

    if (typedSignature.trim().length < 2) {
      showMessage(
        "warning",
        "Signature Required",
        "Please Type Your Full Legal Name."
      );
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`${API_BASE}/api/waivers/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          waiverVersion: waiverConfig?.waiverVersion || "",
          divisionId: managerData?.divisionId || managerData?.division || "",
          squad: managerData?.squad || managerData?.allStarManagerAccess?.squad || "",
          role: getRole(),
          personId: getPersonId(),
          leagueAppsId: managerData?.leagueAppsId || getPersonId(),
          name: getParticipantName(),
          age: managerData?.age || "",
          address: managerData?.address || "",
          city: managerData?.city || "",
          state: managerData?.state || "",
          zip: managerData?.zip || "",
          phone: managerData?.phone || "",
          teamName: managerData?.teamName || "",
          agreementAccepted: true,
          typedSignature: typedSignature.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || data.message || "Unable to save waiver.");
      }

      setSignedAt(data.waiver?.signedAt || new Date().toISOString());

      showMessage(
        "success",
        "Waiver Complete",
        "Your Waiver Has Been Recorded."
      );
    } catch (error: any) {
      showMessage(
        "error",
        "Waiver Error",
        error.message || "Unable to Save Waiver."
      );
    } finally {
      setSaving(false);
    }
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
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Image
              source={require("../assets/Frisco-RoughRiders-Logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.title}>
  {waiverConfig?.waiverYear || "2026"} NTABL Charity All-Star Games
</Text>
            <Text style={styles.subtitle}>Agreement & Release of Liability</Text>

 {signedAt ? (
  <>
    <View style={styles.completeBox}>
      <Ionicons
        name="checkmark-circle"
        size={52}
        color="#15803d"
        style={{ marginBottom: 8 }}
      />

      <Text style={styles.completeTitle}>Waiver Complete</Text>

      <Text style={styles.completeText}>
        Signed on {new Date(signedAt).toLocaleString()}
      </Text>
    </View>

    <View style={styles.infoBox}>
      <Text style={styles.infoLabel}>Participant</Text>
      <Text style={styles.infoValue}>{getParticipantName()}</Text>

      <Text style={styles.infoLabel}>Team</Text>
      <Text style={styles.infoValue}>
        {managerData?.teamName || "Not Listed"}
      </Text>

      <Text style={styles.infoLabel}>Division</Text>
      <Text style={styles.infoValue}>
        {managerData?.division || "Not Listed"}
      </Text>

      <Text style={styles.infoLabel}>Role</Text>
      <Text style={styles.infoValue}>{getRole()}</Text>
    </View>

    <View style={styles.waiverBox}>
      <Text style={styles.waiverTitle}>
        Agreement and Release of Liability Waiver
      </Text>

      <Text style={styles.waiverText}>
        I, as the participant, parent, or legal guardian of the participant,
        hereby acknowledge and am aware that participant is being permitted to use
        the facilities at Dr Pepper Ballpark / Riders Field by the Frisco
        RoughRiders Baseball Team, the City of Frisco, Frisco RoughRiders LP,
        and/or its affiliated entities.
      </Text>

      <Text style={styles.waiverText}>
        On my own behalf or on behalf of participant, I agree that neither I nor
        the participant nor any of our respective heirs, distributees, guardians,
        legal representatives and/or assigns will make any actions, suits, claims
        against, or attachment of the property of, or prosecute any of the
        released parties or any of their respective employees, agents, officers,
        directors, assigns, and affiliated organizations, for injury or damage to
        person or property resulting from use of the facility.
      </Text>

      <Text style={styles.boldWaiverText}>
        This waiver was completed electronically and recorded by the NTABL
        Charity All-Star Games system.
      </Text>
    </View>
  </>
) : (
              <>
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>Participant</Text>
                  <Text style={styles.infoValue}>{getParticipantName()}</Text>

                  <Text style={styles.infoLabel}>Team</Text>
                  <Text style={styles.infoValue}>
                    {managerData?.teamName || "Not Listed"}
                  </Text>

                  <Text style={styles.infoLabel}>Division</Text>
                  <Text style={styles.infoValue}>
                    {managerData?.division || "Not Listed"}
                  </Text>

                  <Text style={styles.infoLabel}>Role</Text>
                  <Text style={styles.infoValue}>{getRole()}</Text>
                </View>

                <View style={styles.waiverBox}>
                  <Text style={styles.waiverTitle}>
                    Agreement and Release of Liability Waiver
                  </Text>

                  <Text style={styles.waiverText}>
                    I, as the participant, parent, or legal guardian of the
                    participant, hereby acknowledge and am aware that participant is
                    being permitted to use the facilities at Dr Pepper Ballpark /
                    Riders Field by the Frisco RoughRiders Baseball Team, the City
                    of Frisco, Frisco RoughRiders LP, and/or its affiliated entities.
                  </Text>

                  <Text style={styles.waiverText}>
                    On my own behalf or on behalf of participant, I agree that
                    neither I nor the participant nor any of our respective heirs,
                    distributees, guardians, legal representatives and/or assigns
                    will make any actions, suits, claims against, or attachment of
                    the property of, or prosecute any of the released parties or any
                    of their respective employees, agents, officers, directors,
                    assigns, and affiliated organizations, for injury or damage to
                    person or property resulting from use of the facility, including
                    injury or damage caused by the negligent acts or intentional
                    misconduct of any person or entity.
                  </Text>

                  <Text style={styles.waiverText}>
                    By signing below, I acknowledge release and waiver of any and
                    all potential claims against the released parties and their
                    respective employees, agents, officers, directors, assigns, and
                    affiliated organizations.
                  </Text>

                  <Text style={styles.boldWaiverText}>
                    I have carefully read this agreement and fully understand its
                    contents. I am aware that this is a release of liability and a
                    contract between myself, the released parties and their
                    respective employees, agents, officers, directors, assigns and
                    affiliated organizations and sign it of my own free will.
                  </Text>
                </View>

                <Pressable
                  style={styles.checkRow}
                  onPress={() => setAgreementAccepted((current) => !current)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      agreementAccepted && styles.checkboxChecked,
                    ]}
                  >
                    {agreementAccepted ? (
                      <Text style={styles.checkmark}>✓</Text>
                    ) : null}
                  </View>

                  <Text style={styles.checkText}>
                    I have read and agree to the Agreement and Release of
                    Liability.
                  </Text>
                </Pressable>

                <Text style={styles.inputLabel}>Typed Signature</Text>

                <TextInput
                  value={typedSignature}
                  onChangeText={setTypedSignature}
                  placeholder="Type your full legal name"
                  style={styles.input}
                  autoCapitalize="words"
                  placeholderTextColor="#9ca3af"
                />

                <Pressable
                  style={[styles.button, saving && styles.buttonDisabled]}
                  onPress={signWaiver}
                  disabled={saving}
                >
                  <View style={styles.buttonContentRow}>
                    <Ionicons
                      name="create-outline"
                      size={20}
                      color="#ffffff"
                      style={{ marginRight: 8 }}
                    />

                    <Text style={styles.buttonText}>
                      {saving ? "Saving..." : "Complete Waiver"}
                    </Text>
                  </View>
                </Pressable>
              </>
            )}
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

  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 60,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
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
    width: 190,
    height: 110,
    alignSelf: "center",
    marginBottom: 10,
  },

  title: {
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    color: "#111827",
    marginTop: 4,
  },

  subtitle: {
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
    color: "#c62828",
    marginTop: 6,
    marginBottom: 18,
  },

  infoBox: {
    backgroundColor: "#eef4fb",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },

  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5c6b7a",
    textTransform: "uppercase",
    marginTop: 8,
  },

  infoValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
    marginTop: 2,
    textTransform: "capitalize",
  },

  waiverBox: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },

  waiverTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
    textDecorationLine: "underline",
    marginBottom: 14,
  },

  waiverText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#374151",
    marginBottom: 12,
    fontWeight: "600",
  },

  boldWaiverText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#111827",
    marginBottom: 4,
    fontWeight: "900",
  },

  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
  },

  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#0b2a4a",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 1,
  },

  checkboxChecked: {
    backgroundColor: "#0b2a4a",
  },

  checkmark: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },

  checkText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    color: "#243b53",
    fontWeight: "700",
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: "#102a43",
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#ffffff",
    marginBottom: 18,
    color: "#111827",
    fontWeight: "700",
  },

  button: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  completeBox: {
    backgroundColor: "#e8f7ee",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },

  completeTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#15803d",
    marginBottom: 8,
  },

  completeText: {
    fontSize: 15,
    color: "#1f5132",
    textAlign: "center",
    fontWeight: "700",
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