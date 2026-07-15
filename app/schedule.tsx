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

type ScheduleItem = {
  id: string;
  time: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  location: string;
  details: string;
};

type GameSchedule = {
  id: string;
  gameNumber: number;
  title: string;
  shortTitle: string;
  divisionIds: string[];
  accentColor: string;
  eastDugout: string;
  westDugout: string;
  items: ScheduleItem[];
};

type ScheduleConfig = {
  activeYear: string;
  eventTitle: string;
  eventDate: string;
  location: string;
  games: GameSchedule[];
};

function formatTime(value: string) {
  const [hoursText, minutes = "00"] = String(value || "").split(":");
  const hours = Number(hoursText);

  if (!Number.isFinite(hours)) return value;

  return `${hours % 12 || 12}:${minutes.padStart(2, "0")} ${
    hours >= 12 ? "PM" : "AM"
  }`;
}

function formatEventDate(value: string) {
  if (!value) return "";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function findItem(game: GameSchedule, term: string) {
  return game.items.find((item) =>
    item.title.toLowerCase().includes(term.toLowerCase())
  );
}

export default function ScheduleScreen() {
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
  }, []);

  async function loadSchedule() {
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
      console.log("SCHEDULE LOAD ERROR:", error);
    } finally {
      setLoading(false);
    }
  }

  function openGame(gameId: string) {
    router.push({
      pathname: "/gameitinerary",
      params: { gameId },
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
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
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

            <Pressable style={styles.refreshButton} onPress={loadSchedule}>
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
              source={require("../assets/All-Star Logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.title}>Game Schedules</Text>
            <Text style={styles.subtitle}>
              {schedule?.eventTitle || "NTABL Charity All-Star Games"}
            </Text>

            {!!schedule?.eventDate && (
              <View style={styles.metaRow}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color="#1f4e9e"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.metaText}>
                  {formatEventDate(schedule.eventDate)}
                </Text>
              </View>
            )}

            {!!schedule?.location && (
              <View style={styles.metaRow}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color="#c62828"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.metaText}>{schedule.location}</Text>
              </View>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#166534" />
              <Text style={styles.loadingText}>Loading Game Schedules...</Text>
            </View>
          ) : (
            schedule?.games.map((game) => {
              const arrival = findItem(game, "arrive");
              const start = findItem(game, "game begins");
              const end = findItem(game, "game end");

              return (
                <Pressable
                  key={game.id}
                  style={styles.gameCard}
                  onPress={() => openGame(game.id)}
                >
                  <View
                    style={[
                      styles.gameAccent,
                      { backgroundColor: game.accentColor || "#1d4ed8" },
                    ]}
                  />

                  <View style={styles.gameCardBody}>
                    <View style={styles.gameCardHeader}>
                      <View
                        style={[
                          styles.gameNumberBadge,
                          { backgroundColor: game.accentColor || "#1d4ed8" },
                        ]}
                      >
                        <Text style={styles.gameNumberText}>
                          GAME {game.gameNumber}
                        </Text>
                      </View>

                      <Ionicons
                        name="chevron-forward-circle"
                        size={29}
                        color={game.accentColor || "#1d4ed8"}
                      />
                    </View>

                    <Text style={styles.gameTitle}>{game.title}</Text>
                    <Text style={styles.divisionText}>
                      {game.divisionIds.join(" • ").toUpperCase()}
                    </Text>

                    <View style={styles.dugoutRow}>
                      <View style={styles.dugoutItem}>
                        <Text style={styles.dugoutLabel}>EAST</Text>
                        <Text style={styles.dugoutValue}>
                          {game.eastDugout || "1B Dugout"}
                        </Text>
                      </View>

                      <View style={styles.dugoutDivider} />

                      <View style={styles.dugoutItem}>
                        <Text style={styles.dugoutLabel}>WEST</Text>
                        <Text style={styles.dugoutValue}>
                          {game.westDugout || "3B Dugout"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.quickTimes}>
                      <View style={styles.quickTimeItem}>
                        <Ionicons name="car-outline" size={18} color="#4b5563" />
                        <Text style={styles.quickTimeLabel}>Arrival</Text>
                        <Text style={styles.quickTimeValue}>
                          {arrival ? formatTime(arrival.time) : "TBD"}
                        </Text>
                      </View>

                      <View style={styles.quickTimeDivider} />

                      <View style={styles.quickTimeItem}>
                        <Ionicons
                          name="baseball-outline"
                          size={18}
                          color="#4b5563"
                        />
                        <Text style={styles.quickTimeLabel}>First Pitch</Text>
                        <Text style={styles.quickTimeValue}>
                          {start ? formatTime(start.time) : "TBD"}
                        </Text>
                      </View>

                      <View style={styles.quickTimeDivider} />

                      <View style={styles.quickTimeItem}>
                        <Ionicons name="flag-outline" size={18} color="#4b5563" />
                        <Text style={styles.quickTimeLabel}>Est. End</Text>
                        <Text style={styles.quickTimeValue}>
                          {end ? formatTime(end.time) : "TBD"}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.viewButton,
                        { backgroundColor: game.accentColor || "#1d4ed8" },
                      ]}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={19}
                        color="#ffffff"
                        style={{ marginRight: 7 }}
                      />
                      <Text style={styles.viewButtonText}>
                        View Game Itinerary
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}

          <View style={styles.noticeCard}>
            <Ionicons
              name="information-circle-outline"
              size={22}
              color="#0369a1"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.noticeText}>
              All times are approximate and may change based on game length.
            </Text>
          </View>

          <Text style={styles.footer}>
            NTABL All-Star App • Game Schedules
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
  backButtonText: { color: "#ffffff", fontWeight: "800" },
  refreshButton: {
    backgroundColor: "#6b7280",
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  refreshButtonText: { color: "#ffffff", fontWeight: "800" },
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  logo: { width: 210, height: 145, marginBottom: 3 },
  title: {
    color: "#1f4e9e",
    fontSize: 29,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "#4b5563",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 9,
  },
  metaText: { color: "#374151", fontSize: 15, fontWeight: "800" },
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
  gameCardBody: { flex: 1, padding: 16 },
  gameCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gameNumberBadge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  gameNumberText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },
  gameTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 12,
  },
  divisionText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
  },
  dugoutRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#eef2f7",
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  dugoutItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 6,
  },
  dugoutDivider: {
    width: 1,
    backgroundColor: "#cbd5e1",
  },
  dugoutLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "900",
  },
  dugoutValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 3,
  },
  quickTimes: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#f8fafc",
    borderRadius: 13,
    paddingVertical: 12,
    marginTop: 14,
  },
  quickTimeItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  quickTimeDivider: {
    width: 1,
    backgroundColor: "#d1d5db",
  },
  quickTimeLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 3,
    textTransform: "uppercase",
  },
  quickTimeValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 3,
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
  },
  viewButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0f2fe",
    borderRadius: 14,
    padding: 13,
  },
  noticeText: {
    flex: 1,
    color: "#075985",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  footer: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 18,
  },
});
