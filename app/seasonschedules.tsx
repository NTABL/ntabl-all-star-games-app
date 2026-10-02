import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
  team1Id?: string;
  team1Name?: string;
  team2Id?: string;
  team2Name?: string;
  opponentId?: string;
  opponentName?: string;
  team1Score?: number | null;
  team2Score?: number | null;
  locationName?: string;
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
  return new Date(startTime).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
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

    setAttendanceSaving((prev) => ({ ...prev, [game.gameId]: true }));

    try {
      const response = await fetch(
        `${API_BASE}/api/team-attendance/${encodeURIComponent(
          programId
        )}/${encodeURIComponent(teamId)}/${encodeURIComponent(game.gameId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personId, status, note: "" }),
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

  function renderGame(game: ScheduleGame, past: boolean) {
    const result = past ? getResult(game, teamId) : null;
    const score = getScore(game, teamId);
    const location = [game.locationName, game.subLocationName]
      .filter(Boolean)
      .join(" • ");

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
            <Text style={styles.opponentLabel}>OPPONENT</Text>
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
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={18} color="#475569" />
            <Text style={styles.detailText}>{location}</Text>
          </View>
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
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={25} color="#ffffff" />
          </Pressable>

          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>TEAM SCHEDULE</Text>
            <Text style={styles.headerTeam}>
              {manager?.teamName || "Your Team"}
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

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
            {!!manager?.division && (
              <Text style={styles.divisionText}>{manager.division}</Text>
            )}

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
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  header: {
    backgroundColor: "#111827",
    paddingTop: 54,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerSpacer: {
    width: 42,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  headerTeam: {
    color: "#d1d5db",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 3,
  },
  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 40,
  },
  divisionText: {
    textAlign: "center",
    color: "#475569",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 14,
  },
  section: {
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
    borderWidth: 1,
    borderColor: "#e2e8f0",
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
  opponentLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
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
  backgroundColor: "#f8fafc",
  borderWidth: 1,
  borderColor: "#cbd5e1",
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
    backgroundColor: "#a16207",
    borderColor: "#a16207",
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
    borderColor: "#e2e8f0",
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
