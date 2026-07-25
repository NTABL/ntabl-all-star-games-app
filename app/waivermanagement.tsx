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

type GameOption = {
  id: string;
  gameLabel: string;
  title: string;
  divisionId: string;
  logoType: "single" | "dual";
};

type WaiverParticipant = {
  signed?: boolean;
  role?: string;
};

type WaiverSquad = {
  manager?: WaiverParticipant | null;
  players?: WaiverParticipant[];
  total?: number;
  complete?: number;
  missing?: number;
};

type WaiverDivision = {
  divisionId: string;
  divisionName: string;
  squads?: {
    East?: WaiverSquad;
    West?: WaiverSquad;
  };
};

type WaiverStatusResponse = {
  ok: boolean;
  config?: any;
  divisions?: WaiverDivision[];
  message?: string;
};

type SummaryCounts = {
  required: number;
  completed: number;
  missing: number;
  percentage: number;
  playersRequired: number;
  playersCompleted: number;
  playersMissing: number;
  managersRequired: number;
  managersCompleted: number;
  managersMissing: number;
};

const GAMES: GameOption[] = [
  {
    id: "game1",
    gameLabel: "Game 1",
    title: "60+ All-Stars",
    divisionId: "regency",
    logoType: "single",
  },
  {
    id: "game2",
    gameLabel: "Game 2",
    title: "45+ All-Stars",
    divisionId: "masters",
    logoType: "single",
  },
  {
    id: "game3",
    gameLabel: "Game 3",
    title: "30+ / Rookie Prospects",
    divisionId: "veterans",
    logoType: "dual",
  },
  {
    id: "game4",
    gameLabel: "Game 4",
    title: "18+ All-Stars",
    divisionId: "open",
    logoType: "single",
  },
];

function renderGameLogo(game: GameOption) {
  if (game.divisionId === "regency") {
    return (
      <Image
        source={require("../assets/RegencyACP.png")}
        style={styles.divisionLogo}
        resizeMode="contain"
      />
    );
  }

  if (game.divisionId === "masters") {
    return (
      <Image
        source={require("../assets/MastersACP.png")}
        style={styles.divisionLogo}
        resizeMode="contain"
      />
    );
  }

  if (game.divisionId === "open") {
    return (
      <Image
        source={require("../assets/OpenACP.png")}
        style={styles.divisionLogo}
        resizeMode="contain"
      />
    );
  }

  if (game.divisionId === "veterans") {
    return (
      <View style={styles.dualLogoRow}>
        <Image
          source={require("../assets/VeteransACP.png")}
          style={styles.dualDivisionLogo}
          resizeMode="contain"
        />
        <Image
          source={require("../assets/RookieACP.png")}
          style={styles.dualDivisionLogo}
          resizeMode="contain"
        />
      </View>
    );
  }

  return null;
}

function safeNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function calculatePercentage(completed: number, required: number) {
  if (required <= 0) return 0;
  return Math.round((completed / required) * 100);
}

function getStatusColor(percentage: number, required: number) {
  if (required > 0 && percentage === 100) return "#15803d";
  if (percentage >= 75) return "#ca8a04";
  return "#c62828";
}

function getStatusText(percentage: number, required: number) {
  if (required === 0) return "No Waivers Required";
  if (percentage === 100) return "Complete";
  if (percentage >= 75) return "Needs Attention";
  return "Action Required";
}

function getSquadCounts(squad?: WaiverSquad) {
  const players = Array.isArray(squad?.players) ? squad?.players || [] : [];
  const manager = squad?.manager || null;

  const playersRequired = players.length;
  const playersCompleted = players.filter((player) => player?.signed === true).length;
  const managersRequired = manager ? 1 : 0;
  const managersCompleted = manager?.signed === true ? 1 : 0;

  const required =
    safeNumber(squad?.total) || playersRequired + managersRequired;
  const completed =
    safeNumber(squad?.complete) || playersCompleted + managersCompleted;
  const missing = Math.max(
    0,
    safeNumber(squad?.missing) || required - completed
  );

  return {
    required,
    completed,
    missing,
    playersRequired,
    playersCompleted,
    playersMissing: Math.max(0, playersRequired - playersCompleted),
    managersRequired,
    managersCompleted,
    managersMissing: Math.max(0, managersRequired - managersCompleted),
  };
}

export default function WaiverManagementScreen() {
  const [config, setConfig] = useState<any>(null);
  const [statusDivisions, setStatusDivisions] = useState<WaiverDivision[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState("");

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [waiverYear, setWaiverYear] = useState("");
  const [waiverVersion, setWaiverVersion] = useState("");
  const [venueName, setVenueName] = useState("");
  const [hostName, setHostName] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    loadWaiverDashboard();
  }, []);

  const overallSummary = useMemo<SummaryCounts>(() => {
    let required = 0;
    let completed = 0;
    let playersRequired = 0;
    let playersCompleted = 0;
    let managersRequired = 0;
    let managersCompleted = 0;

    statusDivisions.forEach((division) => {
      ["East", "West"].forEach((squadName) => {
        const squad =
          division?.squads?.[squadName as "East" | "West"];
        const counts = getSquadCounts(squad);

        required += counts.required;
        completed += counts.completed;
        playersRequired += counts.playersRequired;
        playersCompleted += counts.playersCompleted;
        managersRequired += counts.managersRequired;
        managersCompleted += counts.managersCompleted;
      });
    });

    return {
      required,
      completed,
      missing: Math.max(0, required - completed),
      percentage: calculatePercentage(completed, required),
      playersRequired,
      playersCompleted,
      playersMissing: Math.max(0, playersRequired - playersCompleted),
      managersRequired,
      managersCompleted,
      managersMissing: Math.max(0, managersRequired - managersCompleted),
    };
  }, [statusDivisions]);

  function openGame(game: GameOption) {
    router.push(`/waiverdivision/${game.divisionId}`);
  }

  function findDivision(divisionId: string) {
    return statusDivisions.find(
      (division) => division.divisionId === divisionId
    );
  }

  function getDivisionSummary(divisionId: string) {
    const division = findDivision(divisionId);
    const east = getSquadCounts(division?.squads?.East);
    const west = getSquadCounts(division?.squads?.West);

    const required = east.required + west.required;
    const completed = east.completed + west.completed;
    const missing = east.missing + west.missing;

    return {
      required,
      completed,
      missing,
      percentage: calculatePercentage(completed, required),
      east,
      west,
    };
  }

  async function loadWaiverDashboard() {
    try {
      setLoadingStatus(true);
      setStatusError("");

      const [configResponse, statusResponse] = await Promise.all([
        fetch(`${API_BASE}/api/waivers/config`),
        adminFetch(`${API_BASE}/api/admin/waivers/status`),
      ]);

      const configJson = await configResponse.json();
      const statusJson: WaiverStatusResponse = await statusResponse.json();

      if (configResponse.ok && configJson?.ok) {
        setConfig(configJson.config);
        setWaiverYear(String(configJson.config?.waiverYear || ""));
        setWaiverVersion(String(configJson.config?.waiverVersion || ""));
        setVenueName(String(configJson.config?.venueName || "Riders Field"));
        setHostName(
          String(configJson.config?.hostName || "Frisco RoughRiders")
        );
      }

      if (!statusResponse.ok || !statusJson?.ok) {
        throw new Error(
          statusJson?.message || "Waiver status could not be loaded."
        );
      }

      setStatusDivisions(
        Array.isArray(statusJson.divisions) ? statusJson.divisions : []
      );

      if (statusJson.config && !configJson?.ok) {
        setConfig(statusJson.config);
      }
    } catch (error) {
      console.log("WAIVER DASHBOARD LOAD ERROR:", error);
      setStatusError(
        error instanceof Error
          ? error.message
          : "Waiver status could not be loaded."
      );
    } finally {
      setLoadingStatus(false);
    }
  }

  async function saveWaiverConfig() {
    try {
      setSavingConfig(true);

      const response = await adminFetch(
        `${API_BASE}/api/admin/waivers/config`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            waiverYear,
            waiverVersion,
            venueName,
            hostName,
            active: true,
          }),
        }
      );

      const json = await response.json();

      if (response.ok && json?.ok) {
        setConfig(json.config);
        setShowConfigModal(false);
        await loadWaiverDashboard();
      }
    } catch (e) {
      console.log("WAIVER CONFIG SAVE ERROR:", e);
    } finally {
      setSavingConfig(false);
    }
  }

  function renderSummaryCard(
    icon: keyof typeof Ionicons.glyphMap,
    value: number,
    label: string,
    iconColor: string
  ) {
    return (
      <View style={styles.summaryTile}>
        <Ionicons name={icon} size={25} color={iconColor} />
        <Text style={styles.summaryTileNumber}>{value}</Text>
        <Text style={styles.summaryTileLabel}>{label}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.replace("/diagnostics")}
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

            <Pressable
              style={styles.refreshButton}
              onPress={loadWaiverDashboard}
              disabled={loadingStatus}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="refresh-outline"
                  size={17}
                  color="#ffffff"
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.refreshButtonText}>
                  {loadingStatus ? "Loading..." : "Refresh"}
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.heroCard}>
            <Image
              source={require("../assets/NTABL-Logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Waiver Management</Text>
            <Text style={styles.subtitle}>
              Overall Waiver Status for Selected Players and Managers
            </Text>
          </View>

          {loadingStatus ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#1d4ed8" />
              <Text style={styles.loadingText}>
                Loading waiver dashboard...
              </Text>
            </View>
          ) : statusError ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={34} color="#c62828" />
              <Text style={styles.errorTitle}>Unable to Load Waivers</Text>
              <Text style={styles.errorText}>{statusError}</Text>
              <Pressable
                style={styles.retryButton}
                onPress={loadWaiverDashboard}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.overallCard}>
                <Text style={styles.overallEyebrow}>
                  {config?.waiverYear || "2026"} NTABL ALL-STAR GAMES
                </Text>
                <Text style={styles.overallTitle}>Overall Completion</Text>

                <Text style={styles.overallPercentage}>
                  {overallSummary.percentage}%
                </Text>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(
                          100,
                          Math.max(0, overallSummary.percentage)
                        )}%`,
                        backgroundColor: getStatusColor(
                          overallSummary.percentage,
                          overallSummary.required
                        ),
                      },
                    ]}
                  />
                </View>

                <Text style={styles.progressCaption}>
                  {overallSummary.completed} of {overallSummary.required} required
                  waivers completed
                </Text>
              </View>

              <View style={styles.summaryGrid}>
                {renderSummaryCard(
                  "documents-outline",
                  overallSummary.required,
                  "Total Required",
                  "#1d4ed8"
                )}
                {renderSummaryCard(
                  "checkmark-circle-outline",
                  overallSummary.completed,
                  "Completed",
                  "#15803d"
                )}
                {renderSummaryCard(
                  "alert-circle-outline",
                  overallSummary.missing,
                  "Missing",
                  "#c62828"
                )}
                {renderSummaryCard(
                  "stats-chart-outline",
                  overallSummary.percentage,
                  "Percent Complete",
                  "#7c3aed"
                )}
              </View>

              <View style={styles.roleBreakdownCard}>
                <Text style={styles.sectionTitle}>Player and Manager Status</Text>

                <View style={styles.roleRow}>
                  <View style={styles.roleIconBlue}>
                    <Ionicons name="baseball-outline" size={25} color="#ffffff" />
                  </View>
                  <View style={styles.roleTextArea}>
                    <Text style={styles.roleTitle}>Selected Players</Text>
                    <Text style={styles.roleMeta}>
                      {overallSummary.playersCompleted} completed •{" "}
                      {overallSummary.playersMissing} missing
                    </Text>
                  </View>
                  <Text style={styles.roleFraction}>
                    {overallSummary.playersCompleted}/
                    {overallSummary.playersRequired}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.roleRow}>
                  <View style={styles.roleIconGreen}>
                    <Ionicons name="people-outline" size={25} color="#ffffff" />
                  </View>
                  <View style={styles.roleTextArea}>
                    <Text style={styles.roleTitle}>All-Star Managers</Text>
                    <Text style={styles.roleMeta}>
                      {overallSummary.managersCompleted} completed •{" "}
                      {overallSummary.managersMissing} missing
                    </Text>
                  </View>
                  <Text style={styles.roleFraction}>
                    {overallSummary.managersCompleted}/
                    {overallSummary.managersRequired}
                  </Text>
                </View>
              </View>
            </>
          )}

          <View style={styles.configCard}>
            <View style={styles.configHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.configTitle}>Waiver Configuration</Text>
                <Text style={styles.configSubtitle}>
                  Year, Version, Host, and Venue Settings
                </Text>
              </View>

              <Pressable
                style={styles.editConfigButton}
                onPress={() => setShowConfigModal(true)}
              >
                <View style={styles.buttonContentRow}>
                  <Ionicons
                    name="settings-outline"
                    size={18}
                    color="#ffffff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.editConfigButtonText}>Edit</Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.configInfoBox}>
              <Text style={styles.configLabel}>Waiver Year</Text>
              <Text style={styles.configValue}>
                {config?.waiverYear || "Not Listed"}
              </Text>

              <Text style={styles.configLabel}>Waiver Version</Text>
              <Text style={styles.configValue}>
                {config?.waiverVersion || "Not Listed"}
              </Text>

              <Text style={styles.configLabel}>Host</Text>
              <Text style={styles.configValue}>
                {config?.hostName || "Not Listed"}
              </Text>

              <Text style={styles.configLabel}>Venue</Text>
              <Text style={styles.configValue}>
                {config?.venueName || "Not Listed"}
              </Text>
            </View>
          </View>

          <Text style={styles.gameSectionTitle}>Game-by-Game Status</Text>

          <View style={styles.grid}>
            {GAMES.map((game) => {
              const summary = getDivisionSummary(game.divisionId);
              const statusColor = getStatusColor(
                summary.percentage,
                summary.required
              );

              return (
                <View key={game.id} style={styles.gameTile}>
                  <View style={styles.gameHeader}>
                    <Text style={styles.gameLabel}>{game.gameLabel}</Text>
                    <Text style={styles.gameTitle}>{game.title}</Text>
                  </View>

                  <View style={styles.logoBox}>{renderGameLogo(game)}</View>

                  <View style={styles.gameStatsBox}>
                    <View style={styles.gameStatRow}>
                      <Text style={styles.gameStatLabel}>Required</Text>
                      <Text style={styles.gameStatValue}>{summary.required}</Text>
                    </View>
                    <View style={styles.gameStatRow}>
                      <Text style={styles.gameStatLabel}>Completed</Text>
                      <Text style={[styles.gameStatValue, styles.completedText]}>
                        {summary.completed}
                      </Text>
                    </View>
                    <View style={styles.gameStatRow}>
                      <Text style={styles.gameStatLabel}>Missing</Text>
                      <Text style={[styles.gameStatValue, styles.missingText]}>
                        {summary.missing}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.smallProgressTrack}>
                    <View
                      style={[
                        styles.smallProgressFill,
                        {
                          width: `${Math.min(
                            100,
                            Math.max(0, summary.percentage)
                          )}%`,
                          backgroundColor: statusColor,
                        },
                      ]}
                    />
                  </View>

                  <Text style={[styles.gameStatusText, { color: statusColor }]}>
                    {summary.percentage}% •{" "}
                    {getStatusText(summary.percentage, summary.required)}
                  </Text>

                  <View style={styles.squadSummaryRow}>
                    <View style={styles.squadSummaryBox}>
                      <Text style={styles.squadSummaryTitle}>East</Text>
                      <Text style={styles.squadSummaryValue}>
                        {summary.east.completed}/{summary.east.required}
                      </Text>
                      <Text style={styles.squadSummaryMeta}>
                        {summary.east.missing} missing
                      </Text>
                    </View>

                    <View style={styles.squadSummaryBox}>
                      <Text style={styles.squadSummaryTitle}>West</Text>
                      <Text style={styles.squadSummaryValue}>
                        {summary.west.completed}/{summary.west.required}
                      </Text>
                      <Text style={styles.squadSummaryMeta}>
                        {summary.west.missing} missing
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    style={styles.selectButton}
                    onPress={() => openGame(game)}
                  >
                    <View style={styles.buttonContentRow}>
                      <Ionicons
                        name="document-text-outline"
                        size={18}
                        color="#ffffff"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.selectButtonText}>
                        Review Waivers
                      </Text>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <Text style={styles.versionFooter}>
            NTABL All-Star App • Version 1.0
          </Text>
        </ScrollView>
      </View>

      <Modal
        visible={showConfigModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfigModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.configModalCard}>
            <Ionicons
              name="document-text-outline"
              size={54}
              color="#1d4ed8"
              style={{ marginBottom: 10 }}
            />

            <Text style={styles.modalTitle}>Waiver Configuration</Text>
            <Text style={styles.modalSubtitle}>
              Update annual waiver settings.
            </Text>

            <Text style={styles.inputLabel}>Waiver Year</Text>
            <TextInput
              value={waiverYear}
              onChangeText={setWaiverYear}
              style={styles.input}
              placeholder="2026"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.inputLabel}>Waiver Version</Text>
            <TextInput
              value={waiverVersion}
              onChangeText={setWaiverVersion}
              style={styles.input}
              placeholder="2026-roughriders-waiver-v1"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.inputLabel}>Host</Text>
            <TextInput
              value={hostName}
              onChangeText={setHostName}
              style={styles.input}
              placeholder="Frisco RoughRiders"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.inputLabel}>Venue</Text>
            <TextInput
              value={venueName}
              onChangeText={setVenueName}
              style={styles.input}
              placeholder="Riders Field"
              placeholderTextColor="#9ca3af"
            />

            <Pressable
              style={[
                styles.saveConfigButton,
                savingConfig && styles.disabledButton,
              ]}
              onPress={saveWaiverConfig}
              disabled={savingConfig}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="save-outline"
                  size={20}
                  color="#ffffff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.saveConfigButtonText}>
                  {savingConfig ? "Saving..." : "Save Configuration"}
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setShowConfigModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 70,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
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
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: "800",
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
    padding: 24,
    alignItems: "center",
    marginBottom: 18,
  },
  loadingText: {
    color: "#4b5563",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },
  errorCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorTitle: {
    color: "#c62828",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 8,
  },
  errorText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 5,
  },
  retryButton: {
    backgroundColor: "#c62828",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  retryButtonText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  overallCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  overallEyebrow: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  overallTitle: {
    color: "#1f4e9e",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },
  overallPercentage: {
    color: "#111827",
    fontSize: 48,
    fontWeight: "900",
    marginTop: 8,
  },
  progressTrack: {
    width: "100%",
    height: 14,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressCaption: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 9,
    textAlign: "center",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  summaryTile: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  summaryTileNumber: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 5,
  },
  summaryTileLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 2,
  },
  roleBreakdownCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
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
    marginBottom: 12,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  roleIconBlue: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  roleIconGreen: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: "#15803d",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  roleTextArea: {
    flex: 1,
  },
  roleTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
  },
  roleMeta: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  roleFraction: {
    color: "#1f4e9e",
    fontSize: 18,
    fontWeight: "900",
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 13,
  },
  configCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  configHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  configTitle: {
    color: "#1f4e9e",
    fontSize: 20,
    fontWeight: "900",
  },
  configSubtitle: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  editConfigButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  editConfigButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  configInfoBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 12,
  },
  configLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 8,
  },
  configValue: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
  },
  gameSectionTitle: {
    color: "#1f4e9e",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gameTile: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginBottom: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  gameHeader: {
    backgroundColor: "#1d4ed8",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  gameLabel: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  gameTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 2,
    minHeight: 36,
  },
  logoBox: {
    height: 86,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  divisionLogo: {
    width: 108,
    height: 72,
  },
  dualLogoRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  dualDivisionLogo: {
    width: 64,
    height: 54,
    marginHorizontal: 2,
  },
  gameStatsBox: {
    paddingHorizontal: 13,
    paddingTop: 7,
  },
  gameStatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  gameStatLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "800",
  },
  gameStatValue: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
  },
  completedText: {
    color: "#15803d",
  },
  missingText: {
    color: "#c62828",
  },
  smallProgressTrack: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
    marginHorizontal: 13,
    marginTop: 8,
  },
  smallProgressFill: {
    height: "100%",
    borderRadius: 999,
  },
  gameStatusText: {
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 6,
  },
  squadSummaryRow: {
    flexDirection: "row",
    marginHorizontal: 10,
    marginTop: 9,
  },
  squadSummaryBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 8,
    marginHorizontal: 3,
    alignItems: "center",
  },
  squadSummaryTitle: {
    color: "#1f4e9e",
    fontSize: 12,
    fontWeight: "900",
  },
  squadSummaryValue: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  squadSummaryMeta: {
    color: "#c62828",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 1,
  },
  selectButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 14,
    alignItems: "center",
  },
  selectButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    ...modalStyles.overlay,
  },
  configModalCard: {
    ...modalStyles.card,
    alignItems: "center",
  },
  modalTitle: {
    color: "#1f4e9e",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  modalSubtitle: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  inputLabel: {
    width: "100%",
    color: "#374151",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 5,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    backgroundColor: "#ffffff",
    marginBottom: 10,
  },
  saveConfigButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    width: "100%",
    alignItems: "center",
    marginTop: 6,
  },
  saveConfigButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  cancelButton: {
    backgroundColor: "#6b7280",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    width: "100%",
    alignItems: "center",
    marginTop: 10,
  },
  cancelButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.65,
  },
  versionFooter: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 20,
  },
});
