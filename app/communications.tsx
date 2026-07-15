import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { adminFetch, API_BASE } from "../utils/appconfig";
import { modalStyles } from "../utils/modalStyles";

type Audience = "missing-waivers" | "players" | "managers" | "everyone";

type Recipient = {
  key: string;
  id: string;
  name: string;
  firstName: string;
  role: "player" | "manager";
  roleLabel: string;
  email: string;
  phone: string;
  divisionId: string;
  divisionName: string;
  squad: string;
  teamName: string;
  waiverSigned: boolean;
};

type Division = {
  id: string;
  name: string;
};

const AUDIENCES: Array<{
  id: Audience;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    id: "missing-waivers",
    title: "Missing Waivers",
    description: "Players and managers who still need to sign",
    icon: "alert-circle-outline",
  },
  {
    id: "players",
    title: "Selected Players",
    description: "Every selected All-Star player",
    icon: "baseball-outline",
  },
  {
    id: "managers",
    title: "All-Star Managers",
    description: "Every assigned East and West manager",
    icon: "people-outline",
  },
  {
    id: "everyone",
    title: "Players & Managers",
    description: "All selected players and All-Star managers",
    icon: "megaphone-outline",
  },
];

const DEFAULT_SUBJECT = "NTABL All-Star Games Information";

const DEFAULT_MESSAGES: Record<Audience, string> = {
  "missing-waivers": `Hello {FirstName},

Our records indicate that your required NTABL All-Star Games waiver has not yet been completed.

Please log in to the NTABL All-Star App and complete your waiver as soon as possible.

Division: {Division}
Squad: {Squad}
Role: {Role}

Thank you,
NTABL`,
  players: `Hello {FirstName},

You are receiving this message because you have been selected for the NTABL All-Star Games.

Division: {Division}
Squad: {Squad}
Team: {Team}

Additional event information will be provided through the NTABL All-Star App.

Thank you,
NTABL`,
  managers: `Hello {FirstName},

You are receiving this message as an assigned NTABL All-Star Manager.

Division: {Division}
Squad: {Squad}

Please review the NTABL All-Star App for your roster and lineup responsibilities.

Thank you,
NTABL`,
  everyone: `Hello {FirstName},

This is an important message for NTABL All-Star Games participants and managers.

Division: {Division}
Squad: {Squad}
Role: {Role}

Thank you,
NTABL`,
};

export default function CommunicationsScreen() {
  const [audience, setAudience] = useState<Audience>("missing-waivers");
  const [divisionId, setDivisionId] = useState("all");
  const [squad, setSquad] = useState("all");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [message, setMessage] = useState(DEFAULT_MESSAGES["missing-waivers"]);
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [showRecipientPreview, setShowRecipientPreview] = useState(false);
  const [confirmSendVisible, setConfirmSendVisible] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [resultTitle, setResultTitle] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [resultType, setResultType] = useState<"success" | "error" | "warning">(
    "success"
  );

  useEffect(() => {
    loadRecipients();
  }, [audience, divisionId, squad]);

  const withEmail = useMemo(
    () => recipients.filter((recipient) => !!recipient.email),
    [recipients]
  );

  const missingEmailCount = recipients.length - withEmail.length;

  function selectAudience(nextAudience: Audience) {
    setAudience(nextAudience);
    setSubject(
      nextAudience === "missing-waivers"
        ? "NTABL All-Star Games - Waiver Required"
        : DEFAULT_SUBJECT
    );
    setMessage(DEFAULT_MESSAGES[nextAudience]);
  }

  async function loadRecipients() {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        audience,
        divisionId,
        squad,
      });

      const response = await adminFetch(
        `${API_BASE}/api/admin/communications/recipients?${params.toString()}`
      );

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || "Recipients could not be loaded.");
      }

      setRecipients(Array.isArray(json.recipients) ? json.recipients : []);
      setDivisions(Array.isArray(json.divisions) ? json.divisions : []);
    } catch (error: any) {
      showResult(
        "error",
        "Unable to Load Recipients",
        error?.message || "The Communications Center could not reach the backend."
      );
    } finally {
      setLoading(false);
    }
  }

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

  async function sendEmail(sendTest: boolean) {
    if (!subject.trim() || !message.trim()) {
      showResult(
        "warning",
        "Message Incomplete",
        "Enter both an email subject and message."
      );
      return;
    }

    if (sendTest && !testEmail.trim()) {
      showResult(
        "warning",
        "Test Email Required",
        "Enter the email address that should receive the test."
      );
      return;
    }

    try {
      setSending(true);
      setConfirmSendVisible(false);

      const response = await adminFetch(
        `${API_BASE}/api/admin/communications/email`,
        {
          method: "POST",
          body: JSON.stringify({
            audience,
            divisionId,
            squad,
            subject,
            message,
            testEmail,
            sendTest,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || "Email could not be sent.");
      }

      showResult(
        json.failedCount > 0 ? "warning" : "success",
        sendTest ? "Test Email Sent" : "Email Complete",
        json.message ||
          `${json.sentCount || 0} email${
            json.sentCount === 1 ? "" : "s"
          } sent.`
      );

      await loadRecipients();
    } catch (error: any) {
      showResult(
        "error",
        "Email Failed",
        error?.message || "The email could not be sent."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.replace("/admin")}
            >
              <View style={styles.buttonRow}>
                <Ionicons
                  name="chevron-back-outline"
                  size={16}
                  color="#ffffff"
                  style={{ marginRight: 3 }}
                />
                <Text style={styles.backButtonText}>Back</Text>
              </View>
            </Pressable>

            <Pressable style={styles.refreshButton} onPress={loadRecipients}>
              <View style={styles.buttonRow}>
                <Ionicons
                  name="refresh-outline"
                  size={17}
                  color="#ffffff"
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.heroCard}>
            <Image
              source={require("../assets/NTABL-Logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Communications Center</Text>
            <Text style={styles.subtitle}>
              Email selected players, All-Star managers, or anyone missing a waiver.
            </Text>
          </View>

          <View style={styles.summaryCard}>
            {loading ? (
              <ActivityIndicator size="large" color="#0f766e" />
            ) : (
              <>
                <Text style={styles.summaryNumber}>{recipients.length}</Text>
                <Text style={styles.summaryLabel}>Matching Recipients</Text>

                <View style={styles.summaryRow}>
                  <View style={styles.summaryPill}>
                    <Ionicons name="mail-outline" size={16} color="#15803d" />
                    <Text style={styles.summaryPillText}>
                      {withEmail.length} Email Ready
                    </Text>
                  </View>

                  <View style={[styles.summaryPill, styles.warningPill]}>
                    <Ionicons name="warning-outline" size={16} color="#c2410c" />
                    <Text style={[styles.summaryPillText, styles.warningPillText]}>
                      {missingEmailCount} Missing Email
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>1. Choose Audience</Text>

            {AUDIENCES.map((option) => {
              const active = audience === option.id;

              return (
                <Pressable
                  key={option.id}
                  style={[styles.audienceCard, active && styles.audienceCardActive]}
                  onPress={() => selectAudience(option.id)}
                >
                  <View
                    style={[
                      styles.audienceIcon,
                      active && styles.audienceIconActive,
                    ]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={24}
                      color={active ? "#ffffff" : "#0f766e"}
                    />
                  </View>

                  <View style={styles.audienceTextArea}>
                    <Text
                      style={[
                        styles.audienceTitle,
                        active && styles.audienceTitleActive,
                      ]}
                    >
                      {option.title}
                    </Text>
                    <Text
                      style={[
                        styles.audienceDescription,
                        active && styles.audienceDescriptionActive,
                      ]}
                    >
                      {option.description}
                    </Text>
                  </View>

                  <Ionicons
                    name={active ? "checkmark-circle" : "ellipse-outline"}
                    size={24}
                    color={active ? "#ffffff" : "#9ca3af"}
                  />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>2. Optional Filters</Text>

            <Text style={styles.filterLabel}>Division</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {[{ id: "all", name: "All Divisions" }, ...divisions].map(
                (division) => (
                  <Pressable
                    key={division.id}
                    style={[
                      styles.filterChip,
                      divisionId === division.id && styles.filterChipActive,
                    ]}
                    onPress={() => setDivisionId(division.id)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        divisionId === division.id &&
                          styles.filterChipTextActive,
                      ]}
                    >
                      {division.name}
                    </Text>
                  </Pressable>
                )
              )}
            </ScrollView>

            <Text style={styles.filterLabel}>Squad</Text>
            <View style={styles.squadRow}>
              {[
                { id: "all", label: "Both" },
                { id: "East", label: "East" },
                { id: "West", label: "West" },
              ].map((option) => (
                <Pressable
                  key={option.id}
                  style={[
                    styles.squadButton,
                    squad === option.id && styles.squadButtonActive,
                  ]}
                  onPress={() => setSquad(option.id)}
                >
                  <Text
                    style={[
                      styles.squadButtonText,
                      squad === option.id && styles.squadButtonTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={styles.previewButton}
              onPress={() => setShowRecipientPreview(true)}
            >
              <View style={styles.buttonRow}>
                <Ionicons
                  name="people-outline"
                  size={20}
                  color="#ffffff"
                  style={{ marginRight: 7 }}
                />
                <Text style={styles.previewButtonText}>
                  Preview {recipients.length} Recipients
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>3. Compose Email</Text>

            <Text style={styles.inputLabel}>Subject</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              style={styles.subjectInput}
              placeholder="Email subject"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.inputLabel}>Message</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              style={styles.messageInput}
              multiline
              textAlignVertical="top"
              placeholder="Write your message..."
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.templateHelp}>
              Available fields: {"{FirstName}"}, {"{Name}"}, {"{Division}"},{" "}
              {"{Squad}"}, {"{Team}"}, {"{Role}"}
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>4. Test and Send</Text>

            <Text style={styles.inputLabel}>Test Email Address</Text>
            <TextInput
              value={testEmail}
              onChangeText={setTestEmail}
              style={styles.subjectInput}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="your@email.com"
              placeholderTextColor="#9ca3af"
            />

            <Pressable
              style={styles.testButton}
              onPress={() => sendEmail(true)}
              disabled={sending}
            >
              <View style={styles.buttonRow}>
                <Ionicons
                  name="flask-outline"
                  size={20}
                  color="#111827"
                  style={{ marginRight: 7 }}
                />
                <Text style={styles.testButtonText}>Send Test Email</Text>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.sendButton,
                (sending || withEmail.length === 0) && styles.disabledButton,
              ]}
              onPress={() => setConfirmSendVisible(true)}
              disabled={sending || withEmail.length === 0}
            >
              {sending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <View style={styles.buttonRow}>
                  <Ionicons
                    name="send-outline"
                    size={21}
                    color="#ffffff"
                    style={{ marginRight: 7 }}
                  />
                  <Text style={styles.sendButtonText}>
                    Send to {withEmail.length} Recipient
                    {withEmail.length === 1 ? "" : "s"}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          <Text style={styles.versionFooter}>
            NTABL All-Star App • Communications Phase 1
          </Text>
        </ScrollView>
      </View>

      <Modal
        visible={showRecipientPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRecipientPreview(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.previewModalCard}>
            <Text style={styles.modalTitle}>Recipient Preview</Text>
            <Text style={styles.modalSubtitle}>
              {recipients.length} matching recipient
              {recipients.length === 1 ? "" : "s"}
            </Text>

            <ScrollView style={styles.recipientList}>
              {recipients.map((recipient) => (
                <View key={recipient.key} style={styles.recipientRow}>
                  <View style={styles.recipientIcon}>
                    <Ionicons
                      name={
                        recipient.role === "manager"
                          ? "people-outline"
                          : "person-outline"
                      }
                      size={20}
                      color="#ffffff"
                    />
                  </View>

                  <View style={styles.recipientTextArea}>
                    <Text style={styles.recipientName}>{recipient.name}</Text>
                    <Text style={styles.recipientMeta}>
                      {recipient.roleLabel} • {recipient.divisionName} •{" "}
                      {recipient.squad}
                    </Text>
                    <Text
                      style={[
                        styles.recipientEmail,
                        !recipient.email && styles.missingEmail,
                      ]}
                    >
                      {recipient.email || "No email address available"}
                    </Text>
                  </View>

                  <Ionicons
                    name={
                      recipient.waiverSigned
                        ? "checkmark-circle"
                        : "alert-circle"
                    }
                    size={21}
                    color={recipient.waiverSigned ? "#15803d" : "#f97316"}
                  />
                </View>
              ))}
            </ScrollView>

            <Pressable
              style={styles.closeButton}
              onPress={() => setShowRecipientPreview(false)}
            >
              <View style={styles.buttonRow}>
                <Ionicons
                  name="close-circle-outline"
                  size={19}
                  color="#ffffff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.closeButtonText}>Close</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={confirmSendVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmSendVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            <Ionicons
              name="send-outline"
              size={52}
              color="#0f766e"
              style={{ marginBottom: 8 }}
            />

            <Text style={styles.modalTitle}>Send Email Now?</Text>
            <Text style={styles.confirmMessage}>
              This will send an individual personalized email to{" "}
              <Text style={styles.confirmCount}>{withEmail.length}</Text>{" "}
              recipient{withEmail.length === 1 ? "" : "s"}.
            </Text>

            {missingEmailCount > 0 && (
              <Text style={styles.missingNotice}>
                {missingEmailCount} matching recipient
                {missingEmailCount === 1 ? " has" : "s have"} no email address
                and will be skipped.
              </Text>
            )}

            <Pressable
              style={styles.confirmSendButton}
              onPress={() => sendEmail(false)}
            >
              <View style={styles.buttonRow}>
                <Ionicons
                  name="send"
                  size={19}
                  color="#ffffff"
                  style={{ marginRight: 7 }}
                />
                <Text style={styles.confirmSendButtonText}>
                  Send {withEmail.length} Email
                  {withEmail.length === 1 ? "" : "s"}
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setConfirmSendVisible(false)}
            >
              <View style={styles.buttonRow}>
                <Ionicons
                  name="close-circle-outline"
                  size={19}
                  color="#ffffff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>

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

            <Pressable
              style={styles.resultButton}
              onPress={() => setResultVisible(false)}
            >
              <Text style={styles.resultButtonText}>OK</Text>
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
  container: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 70,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  buttonRow: {
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
  },
  refreshButton: {
    backgroundColor: "#6b7280",
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  refreshButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  logo: {
    width: 140,
    height: 140,
    alignSelf: "center",
  },
  title: {
    color: "#1f4e9e",
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 5,
    lineHeight: 21,
  },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  summaryNumber: {
    color: "#0f766e",
    fontSize: 38,
    fontWeight: "900",
  },
  summaryLabel: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "900",
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 12,
    gap: 8,
  },
  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  summaryPillText: {
    color: "#15803d",
    fontSize: 12,
    fontWeight: "900",
    marginLeft: 5,
  },
  warningPill: {
    backgroundColor: "#fff7ed",
  },
  warningPillText: {
    color: "#c2410c",
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  sectionTitle: {
    color: "#1f4e9e",
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 13,
  },
  audienceCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 14,
    padding: 12,
    marginBottom: 9,
  },
  audienceCardActive: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e",
  },
  audienceIcon: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  audienceIconActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  audienceTextArea: {
    flex: 1,
    paddingRight: 8,
  },
  audienceTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
  },
  audienceTitleActive: {
    color: "#ffffff",
  },
  audienceDescription: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  audienceDescriptionActive: {
    color: "#ccfbf1",
  },
  filterLabel: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 8,
  },
  filterRow: {
    paddingBottom: 13,
    gap: 8,
  },
  filterChip: {
    backgroundColor: "#f3f4f6",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  filterChipActive: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  filterChipText: {
    color: "#4b5563",
    fontWeight: "800",
    fontSize: 13,
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  squadRow: {
    flexDirection: "row",
    marginBottom: 13,
    gap: 8,
  },
  squadButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  squadButtonActive: {
    backgroundColor: "#1f4e9e",
  },
  squadButtonText: {
    color: "#4b5563",
    fontWeight: "900",
  },
  squadButtonTextActive: {
    color: "#ffffff",
  },
  previewButton: {
    backgroundColor: "#6b7280",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  previewButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  inputLabel: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 6,
  },
  subjectInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 11,
    backgroundColor: "#ffffff",
    padding: 12,
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  messageInput: {
    minHeight: 220,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 11,
    backgroundColor: "#ffffff",
    padding: 12,
    color: "#111827",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
  templateHelp: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 9,
  },
  testButton: {
    backgroundColor: "#facc15",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  testButtonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
  },
  sendButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  sendButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.5,
  },
  modalOverlay: {
    ...modalStyles.overlay,
  },
  previewModalCard: {
    ...modalStyles.card,
    maxHeight: "88%",
  },
  confirmModalCard: {
    ...modalStyles.card,
    alignItems: "center",
  },
  resultModalCard: {
    ...modalStyles.compactCard,
    alignItems: "center",
  },
  modalTitle: {
    color: "#1f4e9e",
    fontSize: 23,
    fontWeight: "900",
    textAlign: "center",
  },
  modalSubtitle: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 5,
    marginBottom: 12,
  },
  recipientList: {
    width: "100%",
    marginVertical: 10,
  },
  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 10,
  },
  recipientIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  recipientTextArea: {
    flex: 1,
    paddingRight: 8,
  },
  recipientName: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },
  recipientMeta: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  recipientEmail: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  missingEmail: {
    color: "#c62828",
  },
  closeButton: {
    width: "100%",
    backgroundColor: "#6b7280",
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 8,
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  confirmMessage: {
    color: "#4b5563",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 23,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  confirmCount: {
    color: "#0f766e",
    fontWeight: "900",
  },
  missingNotice: {
    color: "#c2410c",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    backgroundColor: "#fff7ed",
    borderRadius: 10,
    padding: 10,
    marginBottom: 13,
  },
  confirmSendButton: {
    width: "100%",
    backgroundColor: "#15803d",
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: "center",
  },
  confirmSendButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  cancelButton: {
    width: "100%",
    backgroundColor: "#c62828",
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 10,
  },
  cancelButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
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
