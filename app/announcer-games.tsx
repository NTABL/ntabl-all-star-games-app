import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { API_BASE } from "../utils/appconfig";

type GameSchedule = {
  id: string;
  gameNumber: number;
  title: string;
  shortTitle: string;
  divisionIds: string[];
  accentColor: string;
  eastDugout: string;
  westDugout: string;
  items: Array<{
    id: string;
    time: string;
    title: string;
  }>;
};

type ScheduleConfig = {
  eventTitle: string;
  eventDate: string;
  location: string;
  games: GameSchedule[];
};

function getDivisionId(game: GameSchedule) {
  if (game.id === "game3") return "veterans";
  return String(game.divisionIds?.[0] || "");
}

function formatTime(value: string) {
  const [hourText, minute = "00"] = String(value || "").split(":");
  const hour = Number(hourText);

  if (!Number.isFinite(hour)) return value || "TBD";

  return `${hour % 12 || 12}:${minute.padStart(2, "0")} ${
    hour >= 12 ? "PM" : "AM"
  }`;
}

function getStartTime(game: GameSchedule) {
  const item = game.items.find((entry) =>
    entry.title.toLowerCase().includes("game begins")
  );

  return item ? formatTime(item.time) : "TBD";
}

export default function AnnouncerGamesScreen() {
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGames();
  }, []);

  async function loadGames() {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE}/api/schedules/active?all=true`
      );
      const json = await response.json();

      if (response.ok && json?.ok) {
        setSchedule(json.schedule);
      }
    } catch (error) {
      console.log("ANNOUNCER GAME SELECTOR LOAD ERROR:", error);
    } finally {
      setLoading(false);
    }
  }

  function openGame(game: GameSchedule) {
    router.replace({
      pathname: "/announcer",
      params: {
        gameId: game.id,
        divisionId: getDivisionId(game),
        gameTitle: game.title,
        eastDugout: game.eastDugout || "1B Dugout",
        westDugout: game.westDugout || "3B Dugout",
        accentColor: game.accentColor || "#1f4e9e",
      },
    });
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topRow}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.replace("/dashboard")}
            >
              <View style={styles.smallButtonRow}>
                <Ionicons
                  name="chevron-back-outline"
                  size={16}
                  color="#ffffff"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.backButtonText}>Back</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.heroCard}>
            <Image
              source={require("../assets/All-Star Logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Choose Game Below</Text>
            <Text style={styles.subtitle}>Select a game to open its live announcer board, current batter, score, lineups, and dugout assignments.</Text>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#1f4e9e" />
              <Text style={styles.loadingText}>Loading Games...</Text>
            </View>
          ) : (
            schedule?.games.map((game) => (
              <Pressable
                key={game.id}
                style={styles.gameCard}
                onPress={() => openGame(game)}
              >
                <View
                  style={[
                    styles.gameAccent,
                    { backgroundColor: game.accentColor || "#1f4e9e" },
                  ]}
                />

                <View style={styles.gameBody}>
                  <View style={styles.gameTopRow}>
                    <View
                      style={[
                        styles.gameBadge,
                        { backgroundColor: game.accentColor || "#1f4e9e" },
                      ]}
                    >
                      <Text style={styles.gameBadgeText}>
                        GAME {game.gameNumber}
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-forward-circle"
                      size={29}
                      color={game.accentColor || "#1f4e9e"}
                    />
                  </View>

                  <Text style={styles.gameTitle}>{game.title}</Text>
                  <Text style={styles.gameTime}>
                    First Pitch: {getStartTime(game)}
                  </Text>

                  <View style={styles.matchupRow}>
                    <View style={styles.team}>
                      <Image
                        source={require("../assets/East.png")}
                        style={styles.teamLogo}
                        resizeMode="contain"
                      />
                      <Text style={styles.eastText}>EAST</Text>
                      <Text style={styles.dugout}>
                        {game.eastDugout || "1B Dugout"}
                      </Text>
                    </View>

                    <Text style={styles.versusText}>VS</Text>

                    <View style={styles.team}>
                      <Image
                        source={require("../assets/West.png")}
                        style={styles.teamLogo}
                        resizeMode="contain"
                      />
                      <Text style={styles.westText}>WEST</Text>
                      <Text style={styles.dugout}>
                        {game.westDugout || "3B Dugout"}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.openButton,
                      { backgroundColor: game.accentColor || "#1f4e9e" },
                    ]}
                  >
                    <Ionicons
                      name="baseball-outline"
                      size={19}
                      color="#ffffff"
                      style={{ marginRight: 7 }}
                    />
                    <Text style={styles.openButtonText}>Open Game View</Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}

          <Text style={styles.footer}>
            NTABL All-Star App • Announcer
          </Text>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef2f7" },
  container: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 70,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  smallButtonRow: {
    flexDirection: "row",
    alignItems: "center",
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
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 17,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  logo: { width: 210, height: 140 },
  title: {
    color: "#1f4e9e",
    fontSize: 29,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center",
    marginTop: 5,
  },
  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 30,
    alignItems: "center",
  },
  loadingText: {
    color: "#6b7280",
    fontWeight: "800",
    marginTop: 10,
  },
  gameCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  gameAccent: { width: 8 },
  gameBody: { flex: 1, padding: 16 },
  gameTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gameBadge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  gameBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },
  gameTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 11,
  },
  gameTime: {
    color: "#1f4e9e",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },
  matchupRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    paddingVertical: 10,
    marginTop: 13,
  },
  team: { flex: 1, alignItems: "center" },
  teamLogo: { width: 92, height: 60 },
  eastText: {
    color: "#c62828",
    fontSize: 15,
    fontWeight: "900",
  },
  westText: {
    color: "#1565c0",
    fontSize: 15,
    fontWeight: "900",
  },
  dugout: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center",
  },
  versusText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "900",
  },
  openButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 13,
  },
  openButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  footer: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
});
