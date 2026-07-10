import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { isAdminLoggedIn } from "../stores/adminstore";
import { adminFetch, API_BASE } from "../utils/appconfig";
import { modalStyles } from "../utils/modalStyles";

type ModalType = "success" | "error" | "info";

type OperationsData = {
  ok?: boolean;
  message?: string;
  backend?: string;
  serverTime?: string;
  responseTimeMs?: number;
  environment?: string;
  backendVersion?: string;
  startedAt?: string;
  storage?: {
    available?: boolean;
    status?: string;
  };
  rosterCache?: {
    available?: boolean;
    rosterCount?: number;
    rawRecordCount?: number;
    refreshedAt?: string;
    expiresAt?: string;
  };
  waivers?: {
    signedCount?: number;
  };
  tournament?: {
    divisionCount?: number;
    assignedManagerCount?: number;
  };
  security?: {
    activeAdminSessions?: number;
    activeAnnouncerSessions?: number;
  };
};

export default function DiagnosticsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshingRoster, setRefreshingRoster] = useState(false);
  const [data, setData] = useState<OperationsData | null>(null);
  const [modalMessage, setModalMessage] = useState("");
  const [modalDetail, setModalDetail] = useState("");
  const [modalType, setModalType] = useState<ModalType>("info");

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function initialize() {
        const loggedIn = await isAdminLoggedIn();

        if (!loggedIn) {
          router.replace("/login");
          return;
        }

        if (active) {
          await loadOperationsData();
        }
      }

      initialize();

      return () => {
        active = false;
      };
    }, [])
  );

  function showModal(
    message: string,
    detail: string,
    type: ModalType = "info"
  ) {
    setModalMessage(message);
    setModalDetail(detail);
    setModalType(type);
  }

  async function loadOperationsData(showLoader = true) {
    try {
      if (showLoader) setLoading(true);

      const response = await adminFetch(
        `${API_BASE}/api/admin/operations-center`
      );
      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || "Operations Center could not be loaded.");
      }

      setData(json);
    } catch (error) {
      setData({
        ok: false,
        backend: "error",
        message:
          error instanceof Error
            ? error.message
            : "Operations Center could not be loaded.",
      });
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function refreshLeagueAppsData() {
    try {
      setRefreshingRoster(true);

      const response = await adminFetch(
        `${API_BASE}/api/admin/refresh-roster-cache`,
        { method: "POST" }
      );
      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || "LeagueApps refresh failed.");
      }

      await loadOperationsData(false);

      showModal(
        "LeagueApps Data Refreshed!",
        `${json.rosterCount ?? 0} players and ${
          json.rawRecordCount ?? 0
        } LeagueApps records were loaded.`,
        "success"
      );
    } catch (error) {
      showModal(
        "Refresh Failed",
        error instanceof Error
          ? error.message
          : "LeagueApps data could not be refreshed.",
        "error"
      );
    } finally {
      setRefreshingRoster(false);
    }
  }

  function showComingSoon(feature: string) {
    showModal(
      `${feature} Coming Soon`,
      "This control is reserved for a future Version 1.1 operations phase.",
      "info"
    );
  }

  const appVersion = Constants.expoConfig?.version || "1.0.0";
  const backendOnline = data?.ok && data?.backend === "online";
  const leagueAppsAvailable = !!data?.rosterCache?.available;
  const storageAvailable = !!data?.storage?.available;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={styles.backButton}
            onPress={() => router.replace("/admin")}
          >
            <View style={styles.buttonContentRow}>
              <Ionicons
                name="chevron-back-outline"
                size={16}
                color="#ffffff"
                style={{ marginRight: 3 }}
              />
              <Text style={styles.backButtonText}>Back</Text>
            </View>
          </Pressable>

          <View style={styles.heroCard}>
            <Image
              source={require("../assets/NTABL-Logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Operations Center</Text>
            <Text style={styles.subtitle}>
              Tournament Administration and System Control
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#1d4ed8" />
              <Text style={styles.loadingText}>Loading Operations Center...</Text>
            </View>
          ) : (
            <>
              <SectionCard title="System Health">
                <View style={styles.metricGrid}>
                  <MetricCard
                    label="Backend"
                    value={backendOnline ? "Online" : "Issue"}
                    icon={backendOnline ? "checkmark-circle" : "alert-circle"}
                    status={backendOnline ? "good" : "bad"}
                  />
                  <MetricCard
                    label="LeagueApps"
                    value={leagueAppsAvailable ? "Connected" : "No Cache"}
                    icon={leagueAppsAvailable ? "cloud-done" : "cloud-offline"}
                    status={leagueAppsAvailable ? "good" : "warning"}
                  />
                  <MetricCard
                    label="Storage"
                    value={storageAvailable ? "Available" : "Issue"}
                    icon={storageAvailable ? "folder-open" : "warning"}
                    status={storageAvailable ? "good" : "bad"}
                  />
                  <MetricCard
                    label="API Response"
                    value={`${data?.responseTimeMs ?? 0} ms`}
                    icon="speedometer-outline"
                  />
                </View>

                <View style={styles.serverTimeBox}>
                  <Text style={styles.serverTimeLabel}>Server Time</Text>
                  <Text style={styles.serverTimeValue}>
                    {formatDateTime(data?.serverTime)}
                  </Text>
                </View>

                {!data?.ok ? (
                  <Text style={styles.errorText}>
                    {data?.message || "Operations Center reported an issue."}
                  </Text>
                ) : null}
              </SectionCard>

              <SectionCard title="Tournament Operations">
                <ActionButton
                  label={
                    refreshingRoster
                      ? "Refreshing LeagueApps Data..."
                      : "Refresh LeagueApps Data"
                  }
                  icon="refresh"
                  backgroundColor="#15803d"
                  disabled={refreshingRoster}
                  loading={refreshingRoster}
                  onPress={refreshLeagueAppsData}
                />

                <ActionButton
                  label="Reload Division Configuration"
                  icon="baseball-outline"
                  backgroundColor="#c62828"
                  onPress={() => router.push("/divisionconfig")}
                />

                <ActionButton
                  label="Refresh Waiver Counts"
                  icon="document-text-outline"
                  backgroundColor="#660000"
                  onPress={() => loadOperationsData()}
                />

                <ActionButton
                  label="Clear Roster Cache"
                  icon="trash-outline"
                  backgroundColor="#6b7280"
                  onPress={() => showComingSoon("Clear Roster Cache")}
                />
              </SectionCard>

              <SectionCard title="Statistics">
                <View style={styles.metricGrid}>
                  <MetricCard
                    label="Signed Waivers"
                    value={String(data?.waivers?.signedCount ?? 0)}
                    icon="document-text-outline"
                  />
                  <MetricCard
                    label="Cached Players"
                    value={String(data?.rosterCache?.rosterCount ?? 0)}
                    icon="people-outline"
                  />
                  <MetricCard
                    label="LeagueApps Records"
                    value={String(data?.rosterCache?.rawRecordCount ?? 0)}
                    icon="server-outline"
                  />
                  <MetricCard
                    label="Managers Assigned"
                    value={String(data?.tournament?.assignedManagerCount ?? 0)}
                    icon="person-circle-outline"
                  />
                </View>

                <Text style={styles.detailText}>
                  Last LeagueApps refresh: {formatDateTime(data?.rosterCache?.refreshedAt)}
                </Text>
              </SectionCard>

              <SectionCard title="Reports">
                <ActionButton
                  label="Waiver Management"
                  icon="document-text-outline"
                  backgroundColor="#660000"
                  onPress={() => router.push("/waivermanagement")}
                />
                <ActionButton
                  label="Team Submission Status"
                  icon="clipboard-outline"
                  backgroundColor="#15803d"
                  onPress={() => router.push("/submissionstatus")}
                />
                <ActionButton
                  label="CSV Export"
                  icon="download-outline"
                  backgroundColor="#1d4ed8"
                  onPress={() => router.push("/waivermanagement")}
                />
                <ActionButton
                  label="Player Selection Report"
                  icon="list-outline"
                  backgroundColor="#6b7280"
                  onPress={() => showComingSoon("Player Selection Report")}
                />
              </SectionCard>

              <SectionCard title="Security">
                <View style={styles.metricGrid}>
                  <MetricCard
                    label="Admin Sessions"
                    value={String(data?.security?.activeAdminSessions ?? 0)}
                    icon="shield-checkmark-outline"
                  />
                  <MetricCard
                    label="Announcer Sessions"
                    value={String(data?.security?.activeAnnouncerSessions ?? 0)}
                    icon="mic-outline"
                  />
                  <MetricCard
                    label="Admin Access"
                    value="Protected"
                    icon="lock-closed-outline"
                    status="good"
                  />
                  <MetricCard
                    label="Password Storage"
                    value="Bcrypt"
                    icon="key-outline"
                    status="good"
                  />
                </View>
              </SectionCard>

              <SectionCard title="Application">
                <View style={styles.metricGrid}>
                  <MetricCard
                    label="App Version"
                    value={appVersion}
                    icon="phone-portrait-outline"
                  />
                  <MetricCard
                    label="Backend Version"
                    value={data?.backendVersion || "1.0.0"}
                    icon="code-slash-outline"
                  />
                  <MetricCard
                    label="Environment"
                    value={formatEnvironment(data?.environment)}
                    icon="globe-outline"
                  />
                  <MetricCard
                    label="Divisions"
                    value={String(data?.tournament?.divisionCount ?? 0)}
                    icon="apps-outline"
                  />
                </View>

                <View style={styles.apiBox}>
                  <Text style={styles.apiLabel}>API URL</Text>
                  <Text style={styles.apiValue}>{API_BASE}</Text>
                </View>
              </SectionCard>

              <SectionCard title="Future Operations">
                <ActionButton
                  label="Event Log"
                  icon="list-circle-outline"
                  backgroundColor="#4b5563"
                  onPress={() => showComingSoon("Event Log")}
                />
                <ActionButton
                  label="Tournament Notifications"
                  icon="notifications-outline"
                  backgroundColor="#4b5563"
                  onPress={() => showComingSoon("Tournament Notifications")}
                />
              </SectionCard>

              <Pressable style={styles.refreshButton} onPress={() => loadOperationsData()}>
                <View style={styles.buttonContentRow}>
                  <Ionicons
                    name="refresh-outline"
                    size={20}
                    color="#ffffff"
                    style={{ marginRight: 7 }}
                  />
                  <Text style={styles.refreshButtonText}>Refresh Operations Center</Text>
                </View>
              </Pressable>
            </>
          )}

          <Text style={styles.versionFooter}>
            NTABL All-Star App • Version {appVersion}
          </Text>
        </ScrollView>
      </View>

      <Modal
        visible={!!modalMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setModalMessage("")}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              modalType === "error" && styles.errorModalCard,
            ]}
          >
            <Ionicons
              name={
                modalType === "success"
                  ? "checkmark-circle"
                  : modalType === "error"
                  ? "alert-circle"
                  : "information-circle"
              }
              size={54}
              color={
                modalType === "success"
                  ? "#15803d"
                  : modalType === "error"
                  ? "#c62828"
                  : "#1d4ed8"
              }
              style={{ marginBottom: 10 }}
            />

            <Text
              style={[
                styles.modalTitle,
                modalType === "success" && styles.successModalTitle,
                modalType === "error" && styles.errorModalTitle,
              ]}
            >
              {modalMessage}
            </Text>

            <Text style={styles.modalDetail}>{modalDetail}</Text>

            <Pressable
              style={[
                styles.finishedButton,
                modalType === "error" && styles.errorFinishedButton,
              ]}
              onPress={() => setModalMessage("")}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#ffffff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.finishedButtonText}>
                  {modalType === "success" ? "Finished" : "OK"}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionHeader}>{title}</Text>
      {children}
    </View>
  );
}

function MetricCard({
  label,
  value,
  icon,
  status = "neutral",
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  status?: "good" | "warning" | "bad" | "neutral";
}) {
  const iconColor =
    status === "good"
      ? "#15803d"
      : status === "warning"
      ? "#b45309"
      : status === "bad"
      ? "#c62828"
      : "#1f4e9e";

  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIconRow}>
        <Ionicons name={icon} size={21} color={iconColor} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  backgroundColor,
  onPress,
  disabled = false,
  loading = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[
        styles.actionButton,
        { backgroundColor },
        disabled && styles.disabledButton,
      ]}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <View style={styles.buttonContentRow}>
          <Ionicons
            name={icon}
            size={21}
            color="#ffffff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.actionButtonText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "Not Available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not Available";

  return date.toLocaleString();
}

function formatEnvironment(value?: string) {
  if (!value) return "Production";
  return value.charAt(0).toUpperCase() + value.slice(1);
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
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: "#1d4ed8",
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 13,
    marginBottom: 10,
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  logo: {
    width: 150,
    height: 150,
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
  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  loadingText: {
    color: "#1f4e9e",
    fontWeight: "800",
    marginTop: 12,
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
  sectionHeader: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1f4e9e",
    marginBottom: 12,
    textAlign: "center",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  metricCard: {
    width: "48%",
    minHeight: 105,
    backgroundColor: "#f4f8fd",
    borderRadius: 14,
    padding: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#dbe5f1",
  },
  metricIconRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  metricLabel: {
    flex: 1,
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    marginLeft: 6,
  },
  metricValue: {
    color: "#1f2937",
    fontSize: 17,
    fontWeight: "900",
  },
  serverTimeBox: {
    backgroundColor: "#eef4fb",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  serverTimeLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  serverTimeValue: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 3,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    minHeight: 52,
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  disabledButton: {
    opacity: 0.45,
  },
  detailText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 2,
  },
  apiBox: {
    backgroundColor: "#eef4fb",
    borderRadius: 12,
    padding: 12,
  },
  apiLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    textAlign: "center",
  },
  apiValue: {
    color: "#1f2937",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 4,
  },
  errorText: {
    color: "#c62828",
    fontWeight: "900",
    textAlign: "center",
    marginTop: 12,
  },
  refreshButton: {
    backgroundColor: "#1f4e9e",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 14,
  },
  refreshButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  versionFooter: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 2,
  },
  modalOverlay: {
    ...modalStyles.overlay,
  },
  modalCard: {
    ...modalStyles.card,
    alignItems: "center",
    justifyContent: "center",
  },
  errorModalCard: {
    borderWidth: 3,
    borderColor: "#c62828",
  },
  modalTitle: {
    color: "#1d4ed8",
    fontSize: 25,
    fontWeight: "900",
    textAlign: "center",
  },
  successModalTitle: {
    color: "#15803d",
  },
  errorModalTitle: {
    color: "#c62828",
  },
  modalDetail: {
    color: "#555555",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
  finishedButton: {
    marginTop: 18,
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 26,
    alignItems: "center",
  },
  errorFinishedButton: {
    backgroundColor: "#c62828",
  },
  finishedButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
});
