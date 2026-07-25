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
type ResultType = "success" | "error" | "warning";

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
  smsEnabled?: boolean;
  smsPreferenceStatus?: "enabled" | "disabled" | "pending";
};

type Division = { id: string; name: string };

type HistoryEntry = {
  id: string;
  channel: string;
  audience: string;
  divisionId: string;
  squad: string;
  message: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  test: boolean;
  createdAt: string;
  results?: Array<{ name?: string; phone?: string; status?: string; error?: string }>;
};

type Template = {
  id: string;
  name: string;
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
  audience?: Audience;
};

const AUDIENCES: Array<{
  id: Audience;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: "missing-waivers", title: "Missing Waivers", description: "Players and managers who still need to sign", icon: "alert-circle-outline" },
  { id: "players", title: "Selected Players", description: "Every selected All-Star player", icon: "baseball-outline" },
  { id: "managers", title: "All-Star Managers", description: "Every assigned East and West manager", icon: "people-outline" },
  { id: "everyone", title: "Players & Managers", description: "All selected players and All-Star managers", icon: "megaphone-outline" },
];

const DEFAULT_MESSAGES: Record<Audience, string> = {
  "missing-waivers": "Hi {FirstName}, our records show your NTABL All-Star waiver is still incomplete. Please log in to the NTABL All-Star App and complete it as soon as possible. Division: {Division}. Squad: {Squad}. Reply STOP to opt out.",
  players: "Hi {FirstName}, you have been selected for the NTABL All-Star Games! Division: {Division}. Squad: {Squad}. Team: {Team}. Please review the NTABL All-Star App for details. Reply STOP to opt out.",
  managers: "Hi {FirstName}, this is an NTABL All-Star manager update for {Division} {Squad}. Please review the app for roster and lineup responsibilities. Reply STOP to opt out.",
  everyone: "Hi {FirstName}, this is an important NTABL All-Star Games update for {Division} {Squad}. Please review the NTABL All-Star App for details. Reply STOP to opt out.",
};

const INSERT_FIELDS = [
  ["First Name", "{FirstName}"], ["Full Name", "{Name}"], ["Division", "{Division}"],
  ["Squad", "{Squad}"], ["Team", "{Team}"], ["Role", "{Role}"],
  ["Dugout", "{Dugout}"], ["Opponent", "{Opponent}"], ["Game Title", "{GameTitle}"],
  ["Game Number", "{GameNumber}"], ["Arrival Time", "{ArrivalTime}"], ["Game Time", "{GameTime}"],
  ["Venue", "{Venue}"], ["Field", "{Field}"], ["Event Date", "{EventDate}"],
] as const;

const TEMPLATES: Template[] = [
  { id: "waiver", name: "Waiver Reminder", icon: "document-text-outline", audience: "missing-waivers", message: DEFAULT_MESSAGES["missing-waivers"] },
  { id: "selection", name: "Selection Congratulations", icon: "trophy-outline", audience: "players", message: DEFAULT_MESSAGES.players },
  { id: "schedule", name: "Schedule Update", icon: "calendar-outline", message: "Hi {FirstName}, your NTABL All-Star schedule: arrive {ArrivalTime}; game {GameTime}; {Venue}, {Field}. Dugout: {Dugout}. Reply STOP to opt out." },
  { id: "location", name: "Field or Location Change", icon: "location-outline", message: "Hi {FirstName}, important NTABL location update for {GameTitle}: {Venue}, {Field}. Game time: {GameTime}. Reply STOP to opt out." },
  { id: "general", name: "General Announcement", icon: "megaphone-outline", audience: "everyone", message: DEFAULT_MESSAGES.everyone },
];

function estimateSegments(text: string) {
  if (!text.length) return 0;
  const unicode = /[^\u0000-\u007f]/.test(text);
  const single = unicode ? 70 : 160;
  const multipart = unicode ? 67 : 153;
  return text.length <= single ? 1 : Math.ceil(text.length / multipart);
}

function formatAudience(value: string) {
  if (value === "missing-waivers") return "Missing Waivers";
  if (value === "players") return "Selected Players";
  if (value === "managers") return "All-Star Managers";
  if (value === "everyone") return "Players & Managers";
  if (value === "test") return "Test SMS";
  return value || "Audience";
}

export default function SmsCenterScreen() {
  const [audience, setAudience] = useState<Audience>("missing-waivers");
  const [divisionId, setDivisionId] = useState("all");
  const [squad, setSquad] = useState("all");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [summaries, setSummaries] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(DEFAULT_MESSAGES["missing-waivers"]);
  const [testPhone, setTestPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [showRecipientPreview, setShowRecipientPreview] = useState(false);
  const [confirmSendVisible, setConfirmSendVisible] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [resultType, setResultType] = useState<ResultType>("success");
  const [resultTitle, setResultTitle] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historySummary, setHistorySummary] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { loadRecipients(); }, [audience, divisionId, squad]);
  useEffect(() => { loadHistory(); }, []);

  const smsReady = useMemo(
    () => recipients.filter((r) => r.smsEnabled === true && !!r.phone),
    [recipients]
  );
  const missingPhoneCount = Number(summaries?.missingPhone ?? recipients.filter((r) => r.smsEnabled && !r.phone).length);
  const optedOutCount = Number(summaries?.smsDisabled ?? recipients.filter((r) => r.smsPreferenceStatus === "disabled").length);
  const pendingCount = Number(summaries?.smsPending ?? recipients.filter((r) => r.smsPreferenceStatus === "pending").length);
  const duplicateCount = Number(summaries?.duplicatePhones ?? 0);
  const segments = estimateSegments(message);

  function showResult(type: ResultType, title: string, text: string) {
    setResultType(type);
    setResultTitle(title);
    setResultMessage(text);
    setResultVisible(true);
  }

  function selectAudience(next: Audience) {
    setAudience(next);
    setMessage(DEFAULT_MESSAGES[next]);
  }

  function applyTemplate(template: Template) {
    setMessage(template.message);
    if (template.audience) setAudience(template.audience);
  }

  function insertField(value: string) {
    setMessage((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${value}`);
  }

  async function loadRecipients() {
    try {
      setLoading(true);
      const params = new URLSearchParams({ audience, divisionId, squad });
      const response = await adminFetch(`${API_BASE}/api/admin/communications/recipients?${params.toString()}`);
      const json = await response.json();
      if (!response.ok || !json?.ok) throw new Error(json?.message || "Recipients could not be loaded.");
      setRecipients(Array.isArray(json.recipients) ? json.recipients : []);
      setDivisions(Array.isArray(json.divisions) ? json.divisions : []);
      setSummaries(json.summaries || {});
    } catch (error: any) {
      showResult("error", "Unable to Load Recipients", error?.message || "The SMS Center could not reach the backend.");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      setHistoryLoading(true);
      const response = await adminFetch(`${API_BASE}/api/admin/communications/history`);
      const json = await response.json();
      if (response.ok && json?.ok) {
        const smsEntries = (Array.isArray(json.entries) ? json.entries : []).filter((entry: HistoryEntry) => entry.channel === "sms");
        setHistory(smsEntries);
        setHistorySummary({
          totalSends: smsEntries.length,
          totalSent: smsEntries.reduce((n: number, e: HistoryEntry) => n + Number(e.sentCount || 0), 0),
          totalFailed: smsEntries.reduce((n: number, e: HistoryEntry) => n + Number(e.failedCount || 0), 0),
        });
      }
    } catch (error) {
      console.log("SMS HISTORY LOAD ERROR:", error);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function sendSms(sendTest: boolean) {
    if (!message.trim()) {
      showResult("warning", "Message Required", "Enter a text message before continuing.");
      return;
    }
    if (sendTest && !testPhone.trim()) {
      showResult("warning", "Test Phone Required", "Enter the mobile number that should receive the test SMS.");
      return;
    }

    try {
      setSending(true);
      setConfirmSendVisible(false);
      const response = await adminFetch(`${API_BASE}/api/admin/communications/sms`, {
        method: "POST",
        body: JSON.stringify({ audience, divisionId, squad, message, testPhone, sendTest }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        const firstFailure = Array.isArray(json?.results)
          ? json.results.find((item: any) => item?.error || item?.errorMessage)
          : null;
        throw new Error(firstFailure?.error || firstFailure?.errorMessage || json?.error || json?.message || "SMS could not be sent.");
      }
      showResult(
        json.failedCount > 0 ? "warning" : "success",
        sendTest ? "Test SMS Submitted" : "SMS Send Complete",
        json.message || `${json.sentCount || 0} SMS message${json.sentCount === 1 ? "" : "s"} submitted.`
      );
      await loadRecipients();
      await loadHistory();
    } catch (error: any) {
      showResult("error", "SMS Failed", error?.message || "The text message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.replace("/communications")}>
              <View style={styles.buttonRow}><Ionicons name="chevron-back-outline" size={16} color="#fff" /><Text style={styles.backButtonText}>Back</Text></View>
            </Pressable>
            <Pressable style={styles.refreshButton} onPress={() => { loadRecipients(); loadHistory(); }}>
              <View style={styles.buttonRow}><Ionicons name="refresh-outline" size={17} color="#fff" /><Text style={styles.refreshButtonText}>Refresh</Text></View>
            </Pressable>
          </View>

          <View style={styles.heroCard}>
            <Image source={require("../assets/NTABL-Logo.png")} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Text Message Communications</Text>
            <Text style={styles.subtitle}>Create and send personalized SMS alerts to selected players, All-Star managers, or anyone missing a waiver.</Text>
          </View>

          <View style={styles.summaryCard}>
            {loading ? <ActivityIndicator size="large" color="#0f766e" /> : <>
              <Text style={styles.summaryNumber}>{smsReady.length}</Text>
              <Text style={styles.summaryLabel}>SMS-Ready Recipients</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryPill}><Ionicons name="chatbubble-outline" size={16} color="#15803d" /><Text style={styles.summaryPillText}>{smsReady.length} Ready</Text></View>
                <View style={[styles.summaryPill, styles.warningPill]}><Ionicons name="warning-outline" size={16} color="#c2410c" /><Text style={[styles.summaryPillText, styles.warningText]}>{missingPhoneCount} Missing Phone</Text></View>
              </View>
            </>}
          </View>

          <View style={styles.dashboardGrid}>
            <Stat icon="people-outline" value={recipients.length} label="Matching" color="#1d4ed8" />
            <Stat icon="chatbubble-ellipses-outline" value={smsReady.length} label="SMS Ready" color="#15803d" />
            <Stat icon="ban-outline" value={optedOutCount} label="Opted Out" color="#c62828" />
            <Pressable style={[styles.dashboardCard, styles.historyDashboardCard]} onPress={() => { setShowHistory(true); loadHistory(); }}>
              <Ionicons name="time-outline" size={24} color="#7c3aed" />
              <Text style={styles.dashboardNumber}>{historySummary?.totalSends || 0}</Text>
              <Text style={styles.dashboardLabel}>Send History</Text>
            </Pressable>
          </View>

          {(pendingCount > 0 || duplicateCount > 0) && (
            <View style={styles.noticeBox}>
              <Ionicons name="information-circle-outline" size={22} color="#1f4e9e" />
              <Text style={styles.noticeText}>{pendingCount} recipient{pendingCount === 1 ? " has" : "s have"} not selected an SMS preference. {duplicateCount > 0 ? `${duplicateCount} duplicate phone number${duplicateCount === 1 ? " was" : "s were"} removed.` : ""}</Text>
            </View>
          )}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Quick Templates</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
              {TEMPLATES.map((template) => (
                <Pressable key={template.id} style={styles.templateCard} onPress={() => applyTemplate(template)}>
                  <View style={styles.templateIcon}><Ionicons name={template.icon} size={23} color="#fff" /></View>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateAction}>Use Template</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>1. Choose Audience</Text>
            {AUDIENCES.map((option) => {
              const active = audience === option.id;
              return <Pressable key={option.id} style={[styles.audienceCard, active && styles.audienceCardActive]} onPress={() => selectAudience(option.id)}>
                <View style={[styles.audienceIcon, active && styles.audienceIconActive]}><Ionicons name={option.icon} size={24} color={active ? "#fff" : "#0f766e"} /></View>
                <View style={styles.audienceTextArea}><Text style={[styles.audienceTitle, active && styles.whiteText]}>{option.title}</Text><Text style={[styles.audienceDescription, active && styles.activeDescription]}>{option.description}</Text></View>
                <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={24} color={active ? "#fff" : "#9ca3af"} />
              </Pressable>;
            })}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>2. Optional Filters</Text>
            <Text style={styles.filterLabel}>Division</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {[{ id: "all", name: "All Divisions" }, ...divisions].map((division) => (
                <Pressable key={division.id} style={[styles.filterChip, divisionId === division.id && styles.filterChipActive]} onPress={() => setDivisionId(division.id)}>
                  <Text style={[styles.filterChipText, divisionId === division.id && styles.whiteText]}>{division.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.filterLabel}>Squad</Text>
            <View style={styles.squadRow}>{[{ id: "all", label: "Both" }, { id: "East", label: "East" }, { id: "West", label: "West" }].map((option) => (
              <Pressable key={option.id} style={[styles.squadButton, squad === option.id && styles.squadButtonActive]} onPress={() => setSquad(option.id)}><Text style={[styles.squadButtonText, squad === option.id && styles.whiteText]}>{option.label}</Text></Pressable>
            ))}</View>
            <Pressable style={styles.previewButton} onPress={() => setShowRecipientPreview(true)}><View style={styles.buttonRow}><Ionicons name="people-outline" size={20} color="#fff" /><Text style={styles.previewButtonText}>Preview {recipients.length} Recipients</Text></View></Pressable>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>3. Compose Text Message</Text>
            <Text style={styles.inputLabel}>Insert Personalized Field</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.insertFieldRow}>
              {INSERT_FIELDS.map(([label, value]) => <Pressable key={value} style={styles.insertFieldButton} onPress={() => insertField(value)}><Ionicons name="add-circle-outline" size={16} color="#1d4ed8" /><Text style={styles.insertFieldText}>{label}</Text></Pressable>)}
            </ScrollView>
            <Text style={styles.inputLabel}>Message</Text>
            <TextInput value={message} onChangeText={setMessage} style={styles.messageInput} multiline textAlignVertical="top" maxLength={1600} placeholder="Write your text message..." placeholderTextColor="#9ca3af" />
            <View style={styles.characterRow}><Text style={styles.templateHelp}>Each field is personalized for every recipient.</Text><Text style={styles.characterCount}>{message.length}/1,600 • {segments} segment{segments === 1 ? "" : "s"}</Text></View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>4. Test and Send</Text>
            <Text style={styles.inputLabel}>Test Mobile Number</Text>
            <TextInput value={testPhone} onChangeText={setTestPhone} style={styles.subjectInput} keyboardType="phone-pad" placeholder="(817) 555-1234" placeholderTextColor="#9ca3af" />
            <Pressable style={styles.testButton} onPress={() => sendSms(true)} disabled={sending}><View style={styles.buttonRow}>{sending ? <ActivityIndicator color="#111827" /> : <Ionicons name="flask-outline" size={20} color="#111827" />}<Text style={styles.testButtonText}>Send Test SMS</Text></View></Pressable>
            <Pressable style={[styles.sendButton, (sending || smsReady.length === 0) && styles.disabledButton]} onPress={() => setConfirmSendVisible(true)} disabled={sending || smsReady.length === 0}>
              {sending ? <ActivityIndicator color="#fff" /> : <View style={styles.buttonRow}><Ionicons name="send-outline" size={21} color="#fff" /><Text style={styles.sendButtonText}>Send to {smsReady.length} Recipient{smsReady.length === 1 ? "" : "s"}</Text></View>}
            </Pressable>
          </View>

          <Text style={styles.versionFooter}>NTABL All-Star App • Text Message Communications</Text>
        </ScrollView>
      </View>

      <Modal visible={showRecipientPreview} transparent animationType="fade" onRequestClose={() => setShowRecipientPreview(false)}>
        <View style={styles.modalOverlay}><View style={styles.previewModalCard}>
          <Text style={styles.modalTitle}>Recipient Preview</Text><Text style={styles.modalSubtitle}>{recipients.length} matching recipient{recipients.length === 1 ? "" : "s"}</Text>
          <ScrollView style={styles.recipientList}>{recipients.map((r) => {
            const eligible = r.smsEnabled === true && !!r.phone;
            const status = r.smsPreferenceStatus === "disabled" ? "Opted Out" : r.smsPreferenceStatus === "pending" ? "Consent Pending" : !r.phone ? "Missing Phone" : "SMS Ready";
            return <View key={r.key} style={styles.recipientRow}><View style={styles.recipientIcon}><Ionicons name={r.role === "manager" ? "people-outline" : "person-outline"} size={20} color="#fff" /></View><View style={styles.recipientTextArea}><Text style={styles.recipientName}>{r.name}</Text><Text style={styles.recipientMeta}>{r.roleLabel} • {r.divisionName} • {r.squad}</Text><Text style={[styles.recipientPhone, !eligible && styles.missingPhone]}>{r.phone || "No mobile number available"} • {status}</Text></View><Ionicons name={eligible ? "checkmark-circle" : "alert-circle"} size={21} color={eligible ? "#15803d" : "#f97316"} /></View>;
          })}</ScrollView>
          <Pressable style={styles.closeButton} onPress={() => setShowRecipientPreview(false)}><Text style={styles.closeButtonText}>Close</Text></Pressable>
        </View></View>
      </Modal>

      <Modal visible={confirmSendVisible} transparent animationType="fade" onRequestClose={() => setConfirmSendVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.confirmModalCard}><Ionicons name="send-outline" size={52} color="#0f766e" /><Text style={styles.modalTitle}>Send SMS Now?</Text><Text style={styles.confirmMessage}>This will send an individual personalized text message to <Text style={styles.confirmCount}>{smsReady.length}</Text> recipient{smsReady.length === 1 ? "" : "s"}.</Text>
          {(missingPhoneCount + optedOutCount + pendingCount > 0) && <Text style={styles.missingNotice}>{missingPhoneCount} missing phone • {optedOutCount} opted out • {pendingCount} consent pending. These recipients will be skipped.</Text>}
          <Pressable style={styles.confirmSendButton} onPress={() => sendSms(false)}><Text style={styles.confirmSendButtonText}>Send {smsReady.length} SMS Message{smsReady.length === 1 ? "" : "s"}</Text></Pressable>
          <Pressable style={styles.cancelButton} onPress={() => setConfirmSendVisible(false)}><Text style={styles.cancelButtonText}>Cancel</Text></Pressable>
        </View></View>
      </Modal>

      <Modal visible={showHistory} transparent animationType="fade" onRequestClose={() => setShowHistory(false)}>
        <View style={styles.modalOverlay}><View style={styles.historyModalCard}><View style={styles.historyHeaderRow}><View><Text style={styles.modalTitle}>SMS History</Text><Text style={styles.modalSubtitle}>{historySummary?.totalSent || 0} submitted • {historySummary?.totalFailed || 0} failed</Text></View><Pressable style={styles.historyRefreshButton} onPress={loadHistory}><Ionicons name="refresh-outline" size={20} color="#fff" /></Pressable></View>
          {historyLoading ? <ActivityIndicator size="large" color="#7c3aed" /> : <ScrollView style={styles.historyList}>{history.length === 0 ? <Text style={styles.emptyHistoryText}>No SMS history is available yet.</Text> : history.map((entry) => <View key={entry.id} style={styles.historyEntry}><View style={styles.historyEntryIcon}><Ionicons name={entry.test ? "flask-outline" : "chatbubble-outline"} size={21} color="#fff" /></View><View style={styles.historyEntryText}><Text style={styles.historySubject}>{entry.test ? "Test SMS" : "SMS Broadcast"}</Text><Text style={styles.historyMeta}>{formatAudience(entry.audience)} • {entry.divisionId === "all" ? "All Divisions" : entry.divisionId} • {entry.squad === "all" ? "Both Squads" : entry.squad}</Text><Text style={styles.historyDate}>{new Date(entry.createdAt).toLocaleString()}</Text></View><View style={styles.historyStats}><Text style={styles.historySent}>{entry.sentCount} sent</Text>{entry.failedCount > 0 && <Text style={styles.historyFailed}>{entry.failedCount} failed</Text>}</View></View>)}</ScrollView>}
          <Pressable style={styles.closeButton} onPress={() => setShowHistory(false)}><Text style={styles.closeButtonText}>Close</Text></Pressable>
        </View></View>
      </Modal>

      <Modal visible={resultVisible} transparent animationType="fade" onRequestClose={() => setResultVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.resultModalCard}><Ionicons name={resultType === "success" ? "checkmark-circle" : resultType === "warning" ? "warning" : "alert-circle"} size={58} color={resultType === "success" ? "#15803d" : resultType === "warning" ? "#f97316" : "#c62828"} /><Text style={styles.modalTitle}>{resultTitle}</Text><Text style={styles.resultMessage}>{resultMessage}</Text><Pressable style={styles.resultButton} onPress={() => setResultVisible(false)}><Text style={styles.resultButtonText}>OK</Text></Pressable></View></View>
      </Modal>
    </>
  );
}

function Stat({ icon, value, label, color }: { icon: keyof typeof Ionicons.glyphMap; value: number; label: string; color: string }) {
  return <View style={styles.dashboardCard}><Ionicons name={icon} size={24} color={color} /><Text style={styles.dashboardNumber}>{value}</Text><Text style={styles.dashboardLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef2f7" },
  container: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 70 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  buttonRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  backButton: { backgroundColor: "#1d4ed8", borderRadius: 9, paddingVertical: 8, paddingHorizontal: 14 },
  backButtonText: { color: "#fff", fontWeight: "800" },
  refreshButton: { backgroundColor: "#6b7280", borderRadius: 9, paddingVertical: 8, paddingHorizontal: 14 },
  refreshButtonText: { color: "#fff", fontWeight: "800" },
  heroCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 16, elevation: 6, shadowColor: "#000", shadowOpacity: .08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  logo: { width: 140, height: 140, alignSelf: "center" },
  title: { color: "#1f4e9e", fontSize: 28, fontWeight: "900", textAlign: "center" },
  subtitle: { color: "#6b7280", fontSize: 15, fontWeight: "700", textAlign: "center", marginTop: 5, lineHeight: 21 },
  summaryCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 16, alignItems: "center", elevation: 6 },
  summaryNumber: { color: "#0f766e", fontSize: 38, fontWeight: "900" },
  summaryLabel: { color: "#374151", fontSize: 16, fontWeight: "900" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 12, gap: 8 },
  summaryPill: { flexDirection: "row", alignItems: "center", backgroundColor: "#ecfdf5", borderRadius: 999, paddingVertical: 7, paddingHorizontal: 11, gap: 5 },
  summaryPillText: { color: "#15803d", fontSize: 12, fontWeight: "900" }, warningPill: { backgroundColor: "#fff7ed" }, warningText: { color: "#c2410c" },
  dashboardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  dashboardCard: { width: "48%", minHeight: 112, backgroundColor: "#fff", borderRadius: 16, padding: 14, alignItems: "center", justifyContent: "center", elevation: 5 },
  historyDashboardCard: { borderWidth: 1, borderColor: "#ddd6fe" }, dashboardNumber: { color: "#111827", fontSize: 25, fontWeight: "900", marginTop: 5 }, dashboardLabel: { color: "#6b7280", fontSize: 12, fontWeight: "900", textAlign: "center" },
  noticeBox: { flexDirection: "row", gap: 8, backgroundColor: "#eff6ff", borderRadius: 12, padding: 12, marginBottom: 16 }, noticeText: { flex: 1, color: "#1e3a8a", fontSize: 12, lineHeight: 18, fontWeight: "700" },
  sectionCard: { backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 16, elevation: 6 }, sectionTitle: { color: "#1f4e9e", fontSize: 19, fontWeight: "900", marginBottom: 13 },
  templateRow: { gap: 10, paddingRight: 4 }, templateCard: { width: 170, minHeight: 145, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#dbe5f1", borderRadius: 15, padding: 13 }, templateIcon: { width: 42, height: 42, borderRadius: 999, backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center", marginBottom: 11 }, templateName: { color: "#111827", fontSize: 15, fontWeight: "900", lineHeight: 20 }, templateAction: { color: "#0f766e", fontSize: 12, fontWeight: "900", marginTop: 8 },
  audienceCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 14, padding: 12, marginBottom: 9 }, audienceCardActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" }, audienceIcon: { width: 42, height: 42, borderRadius: 999, backgroundColor: "#ecfdf5", alignItems: "center", justifyContent: "center", marginRight: 11 }, audienceIconActive: { backgroundColor: "rgba(255,255,255,.18)" }, audienceTextArea: { flex: 1, paddingRight: 8 }, audienceTitle: { color: "#111827", fontSize: 16, fontWeight: "900" }, audienceDescription: { color: "#6b7280", fontSize: 12, fontWeight: "700", marginTop: 2 }, activeDescription: { color: "#ccfbf1" }, whiteText: { color: "#fff" },
  filterLabel: { color: "#374151", fontSize: 14, fontWeight: "900", marginBottom: 8 }, filterRow: { paddingBottom: 13, gap: 8 }, filterChip: { backgroundColor: "#f3f4f6", borderRadius: 999, borderWidth: 1, borderColor: "#d1d5db", paddingVertical: 8, paddingHorizontal: 12 }, filterChipActive: { backgroundColor: "#1d4ed8", borderColor: "#1d4ed8" }, filterChipText: { color: "#4b5563", fontWeight: "800", fontSize: 13 }, squadRow: { flexDirection: "row", marginBottom: 13, gap: 8 }, squadButton: { flex: 1, backgroundColor: "#f3f4f6", borderRadius: 10, paddingVertical: 10, alignItems: "center" }, squadButtonActive: { backgroundColor: "#1f4e9e" }, squadButtonText: { color: "#4b5563", fontWeight: "900" },
  previewButton: { backgroundColor: "#6b7280", borderRadius: 12, paddingVertical: 13, alignItems: "center" }, previewButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  insertFieldRow: { gap: 8, paddingBottom: 13 }, insertFieldButton: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#bfdbfe", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 11 }, insertFieldText: { color: "#1e3a8a", fontSize: 12, fontWeight: "900" }, inputLabel: { color: "#374151", fontSize: 14, fontWeight: "900", marginBottom: 6 }, subjectInput: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 11, backgroundColor: "#fff", padding: 12, color: "#111827", fontSize: 15, fontWeight: "700", marginBottom: 12 }, messageInput: { minHeight: 190, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 11, backgroundColor: "#fff", padding: 12, color: "#111827", fontSize: 15, fontWeight: "600", lineHeight: 21 }, characterRow: { marginTop: 9 }, templateHelp: { color: "#6b7280", fontSize: 12, fontWeight: "700" }, characterCount: { color: "#1f4e9e", fontSize: 12, fontWeight: "900", textAlign: "right", marginTop: 4 },
  testButton: { backgroundColor: "#facc15", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 10 }, testButtonText: { color: "#111827", fontSize: 16, fontWeight: "900" }, sendButton: { backgroundColor: "#15803d", borderRadius: 12, paddingVertical: 14, alignItems: "center" }, sendButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" }, disabledButton: { opacity: .5 },
  modalOverlay: { ...modalStyles.overlay }, previewModalCard: { ...modalStyles.card, maxHeight: "88%" }, confirmModalCard: { ...modalStyles.card, alignItems: "center" }, historyModalCard: { ...modalStyles.card, maxHeight: "88%" }, resultModalCard: { ...modalStyles.compactCard, alignItems: "center" }, modalTitle: { color: "#1f4e9e", fontSize: 23, fontWeight: "900", textAlign: "center" }, modalSubtitle: { color: "#6b7280", fontSize: 14, fontWeight: "700", textAlign: "center", marginTop: 5, marginBottom: 12 },
  recipientList: { width: "100%", marginVertical: 10 }, recipientRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingVertical: 10 }, recipientIcon: { width: 36, height: 36, borderRadius: 999, backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center", marginRight: 9 }, recipientTextArea: { flex: 1, paddingRight: 8 }, recipientName: { color: "#111827", fontSize: 15, fontWeight: "900" }, recipientMeta: { color: "#6b7280", fontSize: 11, fontWeight: "700", marginTop: 2 }, recipientPhone: { color: "#15803d", fontSize: 12, fontWeight: "800", marginTop: 2 }, missingPhone: { color: "#c62828" },
  closeButton: { width: "100%", backgroundColor: "#6b7280", borderRadius: 11, paddingVertical: 13, alignItems: "center", marginTop: 8 }, closeButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" }, confirmMessage: { color: "#4b5563", fontSize: 16, fontWeight: "700", lineHeight: 23, textAlign: "center", marginTop: 8, marginBottom: 12 }, confirmCount: { color: "#0f766e", fontWeight: "900" }, missingNotice: { color: "#c2410c", fontSize: 13, fontWeight: "800", textAlign: "center", backgroundColor: "#fff7ed", borderRadius: 10, padding: 10, marginBottom: 13 }, confirmSendButton: { width: "100%", backgroundColor: "#15803d", borderRadius: 11, paddingVertical: 13, alignItems: "center" }, confirmSendButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" }, cancelButton: { width: "100%", backgroundColor: "#c62828", borderRadius: 11, paddingVertical: 13, alignItems: "center", marginTop: 10 }, cancelButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  historyHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }, historyRefreshButton: { width: 40, height: 40, borderRadius: 999, backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center", marginLeft: 10 }, historyList: { width: "100%", marginVertical: 10 }, historyEntry: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }, historyEntryIcon: { width: 38, height: 38, borderRadius: 999, backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center", marginRight: 10 }, historyEntryText: { flex: 1, paddingRight: 8 }, historySubject: { color: "#111827", fontSize: 14, fontWeight: "900" }, historyMeta: { color: "#6b7280", fontSize: 11, fontWeight: "700", marginTop: 3 }, historyDate: { color: "#9ca3af", fontSize: 11, fontWeight: "700", marginTop: 3 }, historyStats: { alignItems: "flex-end" }, historySent: { color: "#15803d", fontSize: 12, fontWeight: "900" }, historyFailed: { color: "#c62828", fontSize: 11, fontWeight: "900", marginTop: 3 }, emptyHistoryText: { color: "#6b7280", fontSize: 14, fontWeight: "800", textAlign: "center", paddingVertical: 24 },
  resultMessage: { color: "#4b5563", fontSize: 15, fontWeight: "700", lineHeight: 22, textAlign: "center", marginTop: 8 }, resultButton: { width: "100%", backgroundColor: "#1d4ed8", borderRadius: 11, paddingVertical: 13, alignItems: "center", marginTop: 16 }, resultButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" }, versionFooter: { color: "#6b7280", fontSize: 12, fontWeight: "700", textAlign: "center", marginTop: 8 },
});
