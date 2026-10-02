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

      setGames(Array.isArray(data.games) ? data.games : []);
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
