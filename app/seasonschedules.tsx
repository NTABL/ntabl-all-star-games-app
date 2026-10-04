import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getManagerContext } from "../stores/store";
import { API_BASE } from "../utils/appconfig";

type ManagerData = {
  programId?: string;
  teamId?: string;
  teamName?: string;
  division?: string;
  playerId?: string;
  leagueAppsId?: string;
  role?: string;
};

type ScheduleGame = {
  gameId: string;
  programId?: string;
  teamId?: string;
  startTime?: number | null;
  type?: string;
  typeLabel?: string;
  state?: string;
  stateLabel?: string;
  homeAway?: string;
  team1Id?: string;
  team1Name?: string;
  team2Id?: string;
  team2Name?: string;
  opponentId?: string;
  opponentName?: string;
  team1Score?: number | null;
  team2Score?: number | null;
  locationId?: number | string | null;
  locationName?: string;
  subLocationId?: number | string | null;
  subLocationName?: string;
  notes?: string;
};


type AttendanceStatus = "yes" | "maybe" | "no";

type AttendanceResponse = {
  personId: string;
  name: string;
  email?: string;
  status: AttendanceStatus;
  note?: string;
  updatedAt?: string;
};

type TeamAttendanceSummary = {
  yes: number;
  maybe: number;
  no: number;
  noResponse: number;
  total: number;
};

type TeamAttendanceMember = {
  personId: string;
  name: string;
  email?: string;
  isManager?: boolean;
  attendance: AttendanceResponse | null;
};

type AlertAudience = "all" | "responded" | "not_replied";

const teamLogoImages: Record<string, any> = {
  dentonmeanbears: require("../assets/Denton_Mean_Bears.png"),
  ntxreapers: require("../assets/NTX_Reapers.png"),
  pelicans: require("../assets/Pelicans.png"),
  royals: require("../assets/Royals.png"),
  thedarkhorse: require("../assets/The_Dark_Horse.png"),
  dallasmustangs: require("../assets/Dallas_Mustangs.png"),
  briscoereds: require("../assets/Brisco_Co._Reds.png"),
  dallasorioles30: require("../assets/Dallas_Orioles.png"),
  texasdiablos: require("../assets/Texas_Diablos.png"),
  theoldfashioneds: require("../assets/The_Old_Fashioneds.png"),
  dallasspirits: require("../assets/Spirits.png"),
  hurricanes: require("../assets/Hurricanes.png"),
  knights: require("../assets/Knights.png"),
  northdallasexpos: require("../assets/North_Dallas_Expos.png"),
  reds: require("../assets/Reds.png"),
  redsox45: require("../assets/Red_Sox_45.png"),
  bluejays: require("../assets/Blue_Jays.png"),
  dallasorioles60: require("../assets/Dallas_Orioles_60.png"),
  dallasrangers: require("../assets/Dallas_Rangers.png"),
  redsox60: require("../assets/Red_Sox_60.png"),
  dallasgiants: require("../assets/Dallas_Giants.png"),
  dallasmonsters: require("../assets/Dallas_Monsters.png"),
  gannsbulls: require("../assets/Ganns_Bulls.png"),
  grandprairieexpos: require("../assets/Grand_Prairie_Expos.png"),
  uptowngrays: require("../assets/Updown_Grays.png"),
  victoryparkindians: require("../assets/Victory_Park_Indians.png"),
};

function normalizeTeamName(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getTeamLogo(teamName = "", division = "") {
  const key = normalizeTeamName(teamName);
  const divisionKey = normalizeTeamName(division);

  if (key.includes("dallasorioles") && divisionKey.includes("60")) {
    return teamLogoImages.dallasorioles60;
  }
  if (key.includes("dallasorioles")) return teamLogoImages.dallasorioles30;
  if (key.includes("redsox") && divisionKey.includes("60")) {
    return teamLogoImages.redsox60;
  }
  if (key.includes("redsox")) return teamLogoImages.redsox45;

  return teamLogoImages[key] || require("../assets/NTABL-Logo.png");
}

function formatGameDate(startTime?: number | null) {
  if (!startTime) return "DATE TBD";
  return new Date(startTime).toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
  }).toUpperCase();
}

function formatGameTime(startTime?: number | null) {
  if (!startTime) return "TIME TBD";

  const correctedStartTime = Number(startTime) + 60 * 60 * 1000;

  return new Date(correctedStartTime).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

function getResult(game: ScheduleGame, teamId: string) {
  const teamIsOne = String(game.team1Id || "") === teamId;
  const teamScore = teamIsOne ? game.team1Score : game.team2Score;
  const opponentScore = teamIsOne ? game.team2Score : game.team1Score;

  if (teamScore == null || opponentScore == null) return null;
  if (teamScore > opponentScore) return "WIN";
  if (teamScore < opponentScore) return "LOSS";
  return "TIE";
}

function getScore(game: ScheduleGame, teamId: string) {
  const teamIsOne = String(game.team1Id || "") === teamId;
  return {
    teamScore: teamIsOne ? game.team1Score : game.team2Score,
    opponentScore: teamIsOne ? game.team2Score : game.team1Score,
  };
}

function isPastGame(game: ScheduleGame) {
  const state = String(game.state || "").toUpperCase();
  if (["COMPLETED", "FINAL", "PLAYED"].includes(state)) return true;
  if (game.team1Score != null || game.team2Score != null) return true;
  return !!game.startTime && Number(game.startTime) < Date.now();
}

export default function SeasonSchedules() {
  const params = useLocalSearchParams<{
    alertTitle?: string;
    alertMessage?: string;
    alertId?: string;
  }>();
  const [receivedAlert, setReceivedAlert] = useState<{
    title: string;
    message: string;
    id: string;
  } | null>(null);
  const [manager, setManager] = useState<ManagerData | null>(null);
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [attendanceByGame, setAttendanceByGame] = useState<Record<string, AttendanceResponse | null>>({});
  const [attendanceSaving, setAttendanceSaving] = useState<Record<string, boolean>>({});
  const [teamAttendance, setTeamAttendance] = useState<Record<string, { summary: TeamAttendanceSummary; members: TeamAttendanceMember[] }>>({});
  const [teamAttendanceOpen, setTeamAttendanceOpen] = useState<Record<string, boolean>>({});
  const [teamAttendanceLoading, setTeamAttendanceLoading] = useState<Record<string, boolean>>({});
  const [alertGame, setAlertGame] = useState<ScheduleGame | null>(null);
  const [alertAudience, setAlertAudience] = useState<AlertAudience>("all");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSending, setAlertSending] = useState(false);
  const [alertResult, setAlertResult] = useState("");

  useEffect(() => {
    const message = String(params.alertMessage || "").trim();
    if (!message) return;

    setReceivedAlert({
      title: String(params.alertTitle || "Team Alert"),
      message,
      id: String(params.alertId || Date.now()),
    });

    router.setParams({
      alertTitle: undefined,
      alertMessage: undefined,
      alertId: undefined,
    });
  }, [params.alertId, params.alertMessage, params.alertTitle]);

  const loadSchedule = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");

      const context = (await getManagerContext()) as ManagerData | null;
      setManager(context);

      const programId = String(context?.programId || "").trim();
      const teamId = String(context?.teamId || "").trim();

      if (!programId || !teamId) {
        setGames([]);
        setError(
          "Your team schedule information is not available. Please log out and log back in, then try again."
        );
        return;
      }

      const response = await fetch(
        `${API_BASE}/api/team-schedule/${encodeURIComponent(
          programId
        )}/${encodeURIComponent(teamId)}`
      );

      const data = await response.json();

      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.message || "Team schedule could not be loaded.");
      }

      const loadedGames = Array.isArray(data.games) ? data.games : [];
      setGames(loadedGames);
      await loadMyAttendance(context, loadedGames);
    } catch (err: any) {
      setGames([]);
      setError(err?.message || "Team schedule could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSchedule();
    }, [loadSchedule])
  );

  const upcomingGames = useMemo(
    () => games.filter((game) => !isPastGame(game)),
    [games]
  );

  const pastGames = useMemo(
    () => [...games.filter(isPastGame)].sort(
      (a, b) => Number(b.startTime || 0) - Number(a.startTime || 0)
    ),
    [games]
  );

  const teamId = String(manager?.teamId || "");
  const programId = String(manager?.programId || "");
  const personId = String(manager?.playerId || manager?.leagueAppsId || "");
  const isManager = String(manager?.role || "").toLowerCase() === "manager";
  const teamLogo = getTeamLogo(manager?.teamName || "", manager?.division || "");

  const loadMyAttendance = useCallback(async (
    currentManager: ManagerData | null,
    currentGames: ScheduleGame[]
  ) => {
    const currentProgramId = String(currentManager?.programId || "").trim();
    const currentTeamId = String(currentManager?.teamId || "").trim();
    const currentPersonId = String(
      currentManager?.playerId || currentManager?.leagueAppsId || ""
    ).trim();

    if (!currentProgramId || !currentTeamId || !currentPersonId) return;

    const upcoming = currentGames.filter((game) => !isPastGame(game));
    const results = await Promise.all(
      upcoming.map(async (game) => {
        try {
          const response = await fetch(
            `${API_BASE}/api/team-attendance/${encodeURIComponent(
              currentProgramId
            )}/${encodeURIComponent(currentTeamId)}/${encodeURIComponent(
              game.gameId
            )}?personId=${encodeURIComponent(currentPersonId)}`
          );
          const data = await response.json();
          return [game.gameId, response.ok && data?.ok ? data.attendance || null : null] as const;
        } catch {
          return [game.gameId, null] as const;
        }
      })
    );

    setAttendanceByGame(Object.fromEntries(results));
  }, []);

  async function saveAttendance(game: ScheduleGame, status: AttendanceStatus) {
    if (!programId || !teamId || !personId || attendanceSaving[game.gameId]) return;

    const currentStatus = attendanceByGame[game.gameId]?.status || "";
    const nextStatus = currentStatus === status ? "" : status;

    setAttendanceSaving((prev) => ({ ...prev, [game.gameId]: true }));

    try {
      const response = await fetch(
        `${API_BASE}/api/team-attendance/${encodeURIComponent(
          programId
        )}/${encodeURIComponent(teamId)}/${encodeURIComponent(game.gameId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personId, status: nextStatus, note: "" }),
        }
      );

      const data = await response.json();
      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.message || "Attendance could not be saved.");
      }

      setAttendanceByGame((prev) => ({
        ...prev,
        [game.gameId]: data.attendance,
      }));

      if (isManager && teamAttendanceOpen[game.gameId]) {
        await loadTeamAttendance(game);
      }
    } catch (err: any) {
      setError(err?.message || "Attendance could not be saved.");
    } finally {
      setAttendanceSaving((prev) => ({ ...prev, [game.gameId]: false }));
    }
  }

  async function loadTeamAttendance(game: ScheduleGame) {
    if (!programId || !teamId || !personId || !isManager) return;

    setTeamAttendanceLoading((prev) => ({ ...prev, [game.gameId]: true }));
    try {
      const response = await fetch(
        `${API_BASE}/api/team-attendance/${encodeURIComponent(
          programId
        )}/${encodeURIComponent(teamId)}/${encodeURIComponent(
          game.gameId
        )}/team?managerPersonId=${encodeURIComponent(personId)}`
      );
      const data = await response.json();

      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.message || "Team attendance could not be loaded.");
      }

      setTeamAttendance((prev) => ({
        ...prev,
        [game.gameId]: {
          summary: data.summary,
          members: Array.isArray(data.members) ? data.members : [],
        },
      }));
    } catch (err: any) {
      setError(err?.message || "Team attendance could not be loaded.");
    } finally {
      setTeamAttendanceLoading((prev) => ({ ...prev, [game.gameId]: false }));
    }
  }

  async function toggleTeamAttendance(game: ScheduleGame) {
    const opening = !teamAttendanceOpen[game.gameId];
    setTeamAttendanceOpen((prev) => ({ ...prev, [game.gameId]: opening }));
    if (opening) await loadTeamAttendance(game);
  }

  async function openAlertModal(game: ScheduleGame) {
    setAlertGame(game);
    setAlertAudience("all");
    setAlertMessage("");
    setAlertResult("");

    if (!teamAttendance[game.gameId]) {
      await loadTeamAttendance(game);
    }
  }

  function closeAlertModal() {
    if (alertSending) return;
    setAlertGame(null);
    setAlertMessage("");
    setAlertResult("");
  }

  function getAlertRecipientCount() {
    if (!alertGame) return null;

    const attendance = teamAttendance[alertGame.gameId];
    if (!attendance?.summary) return null;

    if (alertAudience === "responded") {
      return attendance.summary.yes + attendance.summary.maybe + attendance.summary.no;
    }

    if (alertAudience === "not_replied") {
      return attendance.summary.noResponse;
    }

    return attendance.summary.total;
  }

  const alertRecipientCount = getAlertRecipientCount();

  async function sendTeamAlert() {
    if (!alertGame || !programId || !teamId || !personId || !alertMessage.trim() || alertSending) return;
    setAlertSending(true);
    setAlertResult("");
    try {
      const response = await fetch(
        `${API_BASE}/api/team-alerts/${encodeURIComponent(programId)}/${encodeURIComponent(teamId)}/${encodeURIComponent(alertGame.gameId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senderPersonId: personId, audience: alertAudience, message: alertMessage.trim() }),
        }
      );
      const data = await response.json();
      if (!response.ok || data?.ok !== true) throw new Error(data?.message || "Team alert could not be sent.");
      const count = Number(data.recipientCount || 0);
      const pushed = Number(data.pushSent || 0);
      setAlertResult(`Alert sent to ${count} teammate${count === 1 ? "" : "s"}${pushed ? ` • ${pushed} push sent` : ""}.`);
    } catch (err: any) {
      setAlertResult(err?.message || "Team alert could not be sent.");
    } finally {
      setAlertSending(false);
    }
  }

  function renderGame(game: ScheduleGame, past: boolean) {
    const result = past ? getResult(game, teamId) : null;
    const score = getScore(game, teamId);
    const homeAwayLabel =
      game.homeAway === "Team 1"
        ? "HOME"
        : game.homeAway === "Team 2"
        ? "AWAY"
        : "";
    const location = [game.locationName, game.subLocationName]
      .filter(Boolean)
      .join(" • ");
    const locationUrl = game.locationId
      ? `https://ntabl.leagueapps.com/location/${game.locationId}`
      : "";

    return (
      <View key={game.gameId} style={styles.gameCard}>
        <View style={styles.cardTopRow}>
          <Text style={styles.gameType}>
            {(game.typeLabel || "GAME").toUpperCase()}
          </Text>
          {result && (
            <View
              style={[
                styles.resultBadge,
                result === "WIN"
                  ? styles.winBadge
                  : result === "LOSS"
                  ? styles.lossBadge
                  : styles.tieBadge,
              ]}
            >
              <Text style={styles.resultText}>{result}</Text>
            </View>
          )}
        </View>

        <Text style={styles.gameDate}>{formatGameDate(game.startTime)}</Text>
        <Text style={styles.gameTime}>{formatGameTime(game.startTime)}</Text>

        <View style={styles.matchupRow}>
          <View style={styles.matchupTextWrap}>
            <View style={styles.opponentHeaderRow}>
              <Text style={styles.opponentLabel}>OPPONENT</Text>
              {!!homeAwayLabel && (
                <View style={[styles.homeAwayBadge, homeAwayLabel === "HOME" ? styles.homeBadge : styles.awayBadge]}>
                  <Text
                    style={[
                      styles.homeAwayBadgeText,
                      homeAwayLabel === "AWAY" && styles.awayBadgeText,
                    ]}
                  >
                    {homeAwayLabel}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.opponentName}>
              {game.opponentName || "Opponent TBD"}
            </Text>
          </View>

          {past &&
            score.teamScore != null &&
            score.opponentScore != null && (
              <View style={styles.scoreBox}>
                <Text style={styles.scoreText}>
                  {score.teamScore} - {score.opponentScore}
                </Text>
              </View>
            )}
        </View>

        {!!location && (
          locationUrl ? (
            <Pressable
              style={({ pressed }) => [
                styles.detailRow,
                styles.locationLinkRow,
                pressed && styles.locationLinkPressed,
              ]}
              onPress={() => Linking.openURL(locationUrl)}
              accessibilityRole="link"
              accessibilityLabel={`Open ${location} location and directions`}
            >
              <Ionicons name="location-outline" size={18} color="#1d4ed8" />
              <Text style={[styles.detailText, styles.locationLinkText]}>
                {location}
              </Text>
              <Ionicons name="open-outline" size={16} color="#1d4ed8" />
            </Pressable>
          ) : (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={18} color="#475569" />
              <Text style={styles.detailText}>{location}</Text>
            </View>
          )
        )}

        {!!game.notes && (
          <View style={styles.notesBox}>
            <Ionicons name="information-circle-outline" size={18} color="#475569" />
            <Text style={styles.notesText}>{game.notes}</Text>
          </View>
        )}

        {!past && (
          <View style={styles.attendanceBox}>
            <Text style={styles.attendanceLabel}>YOUR ATTENDANCE</Text>
            <View style={styles.attendanceButtons}>
              {(["yes", "maybe", "no"] as AttendanceStatus[]).map((status) => {
                const selected = attendanceByGame[game.gameId]?.status === status;
                const saving = !!attendanceSaving[game.gameId];
                const icon =
                  status === "yes"
                    ? "checkmark-circle-outline"
                    : status === "maybe"
                    ? "help-circle-outline"
                    : "close-circle-outline";

                return (
                  <Pressable
                    key={status}
                    disabled={saving}
                    onPress={() => saveAttendance(game, status)}
                    style={[
                      styles.attendanceButton,
                      selected &&
                        (status === "yes"
                          ? styles.attendanceYesSelected
                          : status === "maybe"
                          ? styles.attendanceMaybeSelected
                          : styles.attendanceNoSelected),
                    ]}
                  >
                    <Ionicons
                      name={icon}
                      size={18}
                      color={selected ? "#ffffff" : "#334155"}
                    />
                    <Text
                      style={[
                        styles.attendanceButtonText,
                        selected && styles.attendanceButtonTextSelected,
                      ]}
                    >
                      {status.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {isManager && (
              <View style={styles.managerAttendanceBox}>
                <Pressable
                  style={styles.gameLineupButton}
                  onPress={() => {
                    const opponentTeamId = String(
                      game.opponentId ||
                        (String(game.team1Id || "") === teamId
                          ? game.team2Id || ""
                          : game.team1Id || "")
                    );

                    router.push({
                      pathname: "/gamelineupbuilder" as any,
                      params: {
                        programId,
                        teamId,
                        gameId: String(game.gameId || ""),
                        opponentTeamId,
                        managerPersonId: personId,
                        teamName: manager?.teamName || "My Team",
                        opponentName: game.opponentName || "Opponent",
                        gameDate: formatGameDate(game.startTime),
                        gameTime: formatGameTime(game.startTime),
                      },
                    });
                  }}
                >
                  <View style={styles.gameLineupButtonRow}>
                    <Ionicons name="list-outline" size={20} color="#ffffff" />
                    <Text style={styles.gameLineupButtonText}>GAME LINEUP</Text>
                  </View>
                  <Text style={styles.gameLineupButtonSubtext}>Build, edit, save and share with opponent</Text>
                </Pressable>

                <Pressable style={styles.alertTeamButton} onPress={() => openAlertModal(game)}>
                  <View style={styles.alertTeamButtonRow}>
                    <Ionicons name="notifications-outline" size={19} color="#334155" />
                    <Text style={styles.alertTeamButtonText}>ALERT TEAM</Text>
                  </View>
                  <Text style={styles.alertTeamButtonSubtext}>All • Responded • Not Replied</Text>
                </Pressable>

                <Pressable
                  style={styles.teamAttendanceButton}
                  onPress={() => toggleTeamAttendance(game)}
                >
                  <View>
                    <Text style={styles.teamAttendanceTitle}>TEAM ATTENDANCE</Text>
                    {!!teamAttendance[game.gameId]?.summary && (
                      <Text style={styles.teamAttendanceSummary}>
                        {teamAttendance[game.gameId].summary.yes} Yes  •  {teamAttendance[game.gameId].summary.maybe} Maybe  •  {teamAttendance[game.gameId].summary.no} No  •  {teamAttendance[game.gameId].summary.noResponse} No Response
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name={teamAttendanceOpen[game.gameId] ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#1e3a8a"
                  />
                </Pressable>

                {teamAttendanceOpen[game.gameId] && (
                  <View style={styles.teamResponseList}>
                    {teamAttendanceLoading[game.gameId] ? (
                      <ActivityIndicator />
                    ) : (
                      teamAttendance[game.gameId]?.members.map((member) => (
                        <View key={member.personId} style={styles.teamResponseRow}>
                          <Text style={styles.teamMemberName}>{member.name}</Text>
                          <Text
                            style={[
                              styles.teamMemberStatus,
                              member.attendance?.status === "yes"
                                ? styles.statusYes
                                : member.attendance?.status === "maybe"
                                ? styles.statusMaybe
                                : member.attendance?.status === "no"
                                ? styles.statusNo
                                : styles.statusNone,
                            ]}
                          >
                            {member.attendance?.status
                              ? member.attendance.status.toUpperCase()
                              : "NO RESPONSE"}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" />
            <Text style={styles.stateText}>Loading team schedule...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadSchedule(true)}
              />
            }
          >
            <View style={styles.headerRow}>
              <Pressable
                style={styles.backButton}
                onPress={() => router.replace("/dashboard")}
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

            <View style={styles.heroCard}>
              <Image
                source={teamLogo}
                style={styles.heroLogo}
                resizeMode="contain"
              />
              <Text style={styles.heroTitle}>Team Schedule</Text>
              <Text style={styles.heroTeam}>
                {manager?.teamName || "Your Team"}
              </Text>
              {!!manager?.division && (
                <Text style={styles.heroDivision}>{manager.division}</Text>
              )}
            </View>

            {!!error && (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle-outline" size={26} color="#991b1b" />
                <Text style={styles.errorText}>{error}</Text>
                <Pressable
                  style={styles.retryButton}
                  onPress={() => loadSchedule()}
                >
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </Pressable>
              </View>
            )}

            {!error && games.length === 0 && (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={34} color="#64748b" />
                <Text style={styles.emptyTitle}>No Games Found</Text>
                <Text style={styles.emptyText}>
                  There are no games on the current LeagueApps schedule for this team.
                </Text>
              </View>
            )}

            {!error && upcomingGames.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>UPCOMING GAMES</Text>
                {upcomingGames.map((game) => renderGame(game, false))}
              </View>
            )}

            {!error && pastGames.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PAST GAMES</Text>
                {pastGames.map((game) => renderGame(game, true))}
              </View>
            )}

            <Text style={styles.sourceText}>Schedule provided by LeagueApps</Text>
          </ScrollView>
        )}

        <Modal
          visible={!!receivedAlert}
          transparent
          animationType="fade"
          onRequestClose={() => setReceivedAlert(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.receivedAlertModal}>
              <View style={styles.receivedAlertHeader}>
                <View style={styles.receivedAlertTitleRow}>
                  <Ionicons name="notifications" size={22} color="#1d4ed8" />
                  <Text style={styles.receivedAlertTitle}>
                    {receivedAlert?.title || "Team Alert"}
                  </Text>
                </View>
              </View>

              <Text style={styles.receivedAlertMessage}>
                {receivedAlert?.message}
              </Text>

              <View style={styles.receivedAlertActions}>
                <Pressable
                  style={styles.receivedAlertOkButton}
                  onPress={() => setReceivedAlert(null)}
                >
                  <Text style={styles.receivedAlertOkButtonText}>OK</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={!!alertGame} transparent animationType="fade" onRequestClose={closeAlertModal}>
          <View style={styles.modalBackdrop}>
            <View style={styles.alertModal}>
              <View style={styles.alertModalHeader}>
                <View>
                  <Text style={styles.alertModalTitle}>Alert Team</Text>
                  <Text style={styles.alertModalGame}>{alertGame?.opponentName ? `vs. ${alertGame.opponentName}` : "Upcoming Game"}</Text>
                </View>
                <Pressable onPress={closeAlertModal} disabled={alertSending}>
                  <Ionicons name="close" size={26} color="#475569" />
                </Pressable>
              </View>
              <Text style={styles.alertFieldLabel}>AUDIENCE</Text>
              <View style={styles.audienceRow}>
                {([["all", "All"], ["responded", "Responded"], ["not_replied", "Not Replied"]] as [AlertAudience, string][]).map(([value, label]) => (
                  <Pressable
                    key={value}
                    onPress={() => setAlertAudience(value)}
                    style={[
                      styles.audienceButton,
                      alertAudience === value &&
                        (value === "all"
                          ? styles.audienceAllSelected
                          : value === "responded"
                          ? styles.audienceRespondedSelected
                          : styles.audienceNotRepliedSelected),
                    ]}
                  >
                    <Text
                      style={[
                        styles.audienceButtonText,
                        alertAudience === value &&
                          (value === "all"
                            ? styles.audienceButtonTextSelected
                            : value === "responded"
                            ? styles.audienceRespondedText
                            : styles.audienceNotRepliedText),
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.alertRecipientCount}>
                {alertRecipientCount == null
                  ? "Calculating players to alert..."
                  : `${alertRecipientCount} player${alertRecipientCount === 1 ? "" : "s"} will be alerted`}
              </Text>
              <Text style={styles.alertFieldLabel}>MESSAGE</Text>
              <TextInput value={alertMessage} onChangeText={(value) => setAlertMessage(value.slice(0, 300))} placeholder="Enter a short team alert..." multiline maxLength={300} style={styles.alertInput} textAlignVertical="top" />
              <Text style={styles.characterCount}>{alertMessage.length} / 300</Text>
              {!!alertResult && <Text style={styles.alertResultText}>{alertResult}</Text>}
              <View style={styles.modalActions}>
                <Pressable style={styles.cancelAlertButton} onPress={closeAlertModal} disabled={alertSending}><Text style={styles.cancelAlertButtonText}>Cancel</Text></Pressable>
                <Pressable style={[styles.sendAlertButton, (!alertMessage.trim() || alertSending) && styles.sendAlertButtonDisabled]} onPress={sendTeamAlert} disabled={!alertMessage.trim() || alertSending}>
                  {alertSending ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.sendAlertButtonText}>Send Alert</Text>}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  content: {
    width: "100%",
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 50,
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
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroLogo: {
    width: 125,
    height: 125,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
  },
  heroTeam: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 3,
  },
  heroDivision: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },
  section: {
    width: "100%",
    alignSelf: "center",
    marginBottom: 18,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  gameCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: "#b8c4d4",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  gameType: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  resultBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  winBadge: {
    backgroundColor: "#dcfce7",
  },
  lossBadge: {
    backgroundColor: "#fee2e2",
  },
  tieBadge: {
    backgroundColor: "#fef3c7",
  },
  resultText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "900",
  },
  gameDate: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
  },
  gameTime: {
    color: "#334155",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
    marginBottom: 14,
  },
  matchupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 13,
  },
  matchupTextWrap: {
    flex: 1,
  },
  opponentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  opponentLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  homeAwayBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  homeBadge: {
    backgroundColor: "#dcfce7",
    borderColor: "#86d9a5",
  },
  awayBadge: {
    backgroundColor: "#334155",
    borderColor: "#334155",
  },
  homeAwayBadgeText: {
    color: "#334155",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  awayBadgeText: {
    color: "#ffffff",
  },
  opponentName: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  scoreBox: {
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  scoreText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 13,
  },
  detailText: {
    flex: 1,
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
  },
  locationLinkRow: {
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderRadius: 7,
  },
  locationLinkPressed: {
    opacity: 0.65,
  },
  locationLinkText: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
  notesBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: "#f8fafc",
    borderRadius: 9,
    padding: 10,
    marginTop: 11,
  },
  notesText: {
    flex: 1,
    color: "#475569",
    fontSize: 13,
  },
attendanceBox: {
  marginTop: 16,
  padding: 14,
  backgroundColor: "#e2e8f0",
  borderWidth: 1,
  borderColor: "#94a3b8",
  borderRadius: 12,
},
  attendanceLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  attendanceButtons: {
    flexDirection: "row",
    gap: 8,
  },
  attendanceButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  attendanceButtonText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "900",
  },
  attendanceButtonTextSelected: {
    color: "#ffffff",
  },
  attendanceYesSelected: {
    backgroundColor: "#15803d",
    borderColor: "#15803d",
  },
  attendanceMaybeSelected: {
    backgroundColor: "#ca8a04",
    borderColor: "#ca8a04",
  },
  attendanceNoSelected: {
    backgroundColor: "#b91c1c",
    borderColor: "#b91c1c",
  },
  managerAttendanceBox: {
    marginTop: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2d73ce",
    overflow: "hidden",
  },
  teamAttendanceButton: {
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  teamAttendanceTitle: {
    color: "#1e3a8a",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  teamAttendanceSummary: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  teamResponseList: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  teamResponseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  teamMemberName: {
    flex: 1,
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  teamMemberStatus: {
    fontSize: 11,
    fontWeight: "900",
  },
  statusYes: {
    color: "#15803d",
  },
  statusMaybe: {
    color: "#a16207",
  },
  statusNo: {
    color: "#b91c1c",
  },
  statusNone: {
    color: "#94a3b8",
  },
  gameLineupButton: { backgroundColor: "#1e3a8a", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#172554" },
  gameLineupButtonRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  gameLineupButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },
  gameLineupButtonSubtext: { color: "#dbeafe", fontSize: 10, fontWeight: "700", marginTop: 3 },
  alertTeamButton: { backgroundColor: "#fef9c3", paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#e7c94b" },
  alertTeamButtonRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  alertTeamButtonText: { color: "#334155", fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },
  alertTeamButtonSubtext: { color: "#475569", fontSize: 10, fontWeight: "700", marginTop: 3 },
  receivedAlertModal: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  receivedAlertHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  receivedAlertTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  receivedAlertTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },
  receivedAlertMessage: {
    color: "#334155",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600",
  },
  receivedAlertActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
  },
  receivedAlertOkButton: {
    minWidth: 90,
    backgroundColor: "#1d4ed8",
    borderRadius: 9,
    paddingHorizontal: 18,
    paddingVertical: 11,
    alignItems: "center",
  },
  receivedAlertOkButtonText: {
    color: "#ffffff",
    fontWeight: "900",
  },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.55)", alignItems: "center", justifyContent: "center", padding: 20 },
  alertModal: { width: "100%", maxWidth: 560, backgroundColor: "#ffffff", borderRadius: 18, padding: 18 },
  alertModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  alertModalTitle: { color: "#111827", fontSize: 22, fontWeight: "900" },
  alertModalGame: { color: "#64748b", fontSize: 13, fontWeight: "700", marginTop: 2 },
  alertRecipientCount: {
    marginTop: 10,
    marginBottom: 14,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },

  alertFieldLabel: { color: "#475569", fontSize: 11, fontWeight: "900", letterSpacing: 0.7, marginBottom: 7 },
  audienceRow: { flexDirection: "row", gap: 7, marginBottom: 16 },
  audienceButton: { flex: 1, minHeight: 40, borderRadius: 9, borderWidth: 1, borderColor: "#cbd5e1", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  audienceAllSelected: { backgroundColor: "#dbeafe", borderColor: "#93c5fd" },
  audienceRespondedSelected: { backgroundColor: "#dcfce7", borderColor: "#86d9a5" },
  audienceNotRepliedSelected: { backgroundColor: "#fee2e2", borderColor: "#fca5a5" },
  audienceButtonText: { color: "#334155", fontSize: 11, fontWeight: "800", textAlign: "center" },
  audienceButtonTextSelected: { color: "#1e40af" },
  audienceRespondedText: { color: "#166534" },
  audienceNotRepliedText: { color: "#991b1b" },
  alertInput: { minHeight: 120, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 12, color: "#111827", fontSize: 14, backgroundColor: "#f8fafc" },
  characterCount: { color: "#64748b", fontSize: 11, fontWeight: "700", textAlign: "right", marginTop: 5 },
  alertResultText: { color: "#1e3a8a", fontSize: 12, fontWeight: "700", marginTop: 8 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 9, marginTop: 16 },
  cancelAlertButton: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 9, paddingHorizontal: 16, paddingVertical: 11 },
  cancelAlertButtonText: { color: "#475569", fontWeight: "800" },
  sendAlertButton: { minWidth: 120, backgroundColor: "#16a34a", borderRadius: 9, paddingHorizontal: 18, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  sendAlertButtonDisabled: { opacity: 0.5 },
  sendAlertButtonText: { color: "#ffffff", fontWeight: "900" },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  stateText: {
    color: "#475569",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 12,
  },
  errorCard: {
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 14,
    padding: 20,
  },
  errorText: {
    color: "#991b1b",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: "#991b1b",
    borderRadius: 9,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 14,
  },
  retryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 26,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 9,
  },
  emptyText: {
    color: "#64748b",
    textAlign: "center",
    fontSize: 14,
    marginTop: 5,
  },
  sourceText: {
    color: "#94a3b8",
    textAlign: "center",
    fontSize: 11,
    marginTop: 4,
  },
});
