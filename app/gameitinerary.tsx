import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
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

export default function GameItineraryScreen() {
  const { gameId } = useLocalSearchParams<{ gameId?: string }>();
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [game, setGame] = useState<GameSchedule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGame();
  }, [gameId]);

  async function loadGame() {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE}/api/schedules/active?all=true`
      );
      const json = await response.json();

      if (response.ok && json?.ok) {
        const nextSchedule = json.schedule as ScheduleConfig;
        setSchedule(nextSchedule);
        setGame(
          nextSchedule.games.find((item) => item.id === String(gameId || "")) ||
            null
        );
      }
    } catch (error) {
      console.log("GAME ITINERARY LOAD ERROR:", error);
    } finally {
      setLoading(false);
    }
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
                <Text style={styles.backButtonText}>Schedules</Text>
              </View>
            </Pressable>

            <Pressable style={styles.refreshButton} onPress={loadGame}>
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

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#166534" />
              <Text style={styles.loadingText}>Loading Itinerary...</Text>
            </View>
          ) : !game ? (
            <View style={styles.loadingCard}>
              <Ionicons
                name="calendar-clear-outline"
                size={52}
                color="#6b7280"
              />
              <Text style={styles.missingTitle}>Game Not Found</Text>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.heroCard,
                  { borderTopColor: game.accentColor || "#1d4ed8" },
                ]}
              >
                <Image
                  source={require("../assets/All-Star Logo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />

                <View
                  style={[
                    styles.gameBadge,
                    { backgroundColor: game.accentColor || "#1d4ed8" },
                  ]}
                >
                  <Text style={styles.gameBadgeText}>
                    GAME {game.gameNumber}
                  </Text>
                </View>

                <Text style={styles.title}>{game.title}</Text>
                <Text style={styles.divisionText}>
                  {game.divisionIds.join(" • ").toUpperCase()}
                </Text>

                <View style={styles.eventMeta}>
                  <View style={styles.eventMetaRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color="#1f4e9e"
                    />
                    <Text style={styles.eventMetaText}>
                      {formatEventDate(schedule?.eventDate || "")}
                    </Text>
                  </View>

                  <View style={styles.eventMetaRow}>
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color="#c62828"
                    />
                    <Text style={styles.eventMetaText}>
                      {schedule?.location || "Riders Field"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.itineraryCard}>
                <Text style={styles.itineraryHeading}>Game Day Itinerary</Text>
                <Text style={styles.itinerarySubtitle}>
                  Follow this timeline to keep your game running on schedule.
                </Text>

                {game.items.map((item, index) => (
                  <View key={item.id} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View
                        style={[
                          styles.timelineIcon,
                          { backgroundColor: game.accentColor || "#1d4ed8" },
                        ]}
                      >
                        <Ionicons
                          name={item.icon || "time-outline"}
                          size={25}
                          color="#ffffff"
                        />
                      </View>

                      {index < game.items.length - 1 && (
                        <View
                          style={[
                            styles.timelineLine,
                            { backgroundColor: game.accentColor || "#1d4ed8" },
                          ]}
                        />
                      )}
                    </View>

                    <View style={styles.timelineContent}>
                      <Text
                        style={[
                          styles.timelineTime,
                          { color: game.accentColor || "#1d4ed8" },
                        ]}
                      >
                        {formatTime(item.time)}
                      </Text>

                      <Text style={styles.timelineTitle}>{item.title}</Text>

                      {!!item.location && (
                        <View style={styles.locationRow}>
                          <Ionicons
                            name="location-outline"
                            size={15}
                            color="#6b7280"
                            style={{ marginRight: 5 }}
                          />
                          <Text style={styles.timelineLocation}>
                            {item.location}
                          </Text>
                        </View>
                      )}

                      {!!item.details && (
                        <Text style={styles.timelineDetails}>
                          {item.details}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.noticeCard}>
                <Ionicons
                  name="information-circle-outline"
                  size={23}
                  color="#0369a1"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.noticeText}>
                  All times are approximate and may shift based on the previous
                  game. Please arrive by the listed team arrival time.
                </Text>
              </View>
            </>
          )}

          <Text style={styles.footer}>
            NTABL All-Star App • Game Itinerary
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
  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
  },
  loadingText: {
    color: "#6b7280",
    fontWeight: "800",
    marginTop: 10,
  },
  missingTitle: {
    color: "#1f4e9e",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 10,
  },
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderTopWidth: 8,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  logo: { width: 210, height: 140 },
  gameBadge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 2,
  },
  gameBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 10,
  },
  divisionText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 5,
  },
  eventMeta: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: 13,
    padding: 12,
    marginTop: 15,
  },
  eventMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 3,
    gap: 6,
  },
  eventMetaText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "800",
  },
  itineraryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  itineraryHeading: {
    color: "#1f4e9e",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  itinerarySubtitle: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 5,
    marginBottom: 20,
  },
  timelineRow: {
    flexDirection: "row",
    minHeight: 118,
  },
  timelineRail: {
    width: 58,
    alignItems: "center",
  },
  timelineIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: 4,
    flex: 1,
    opacity: 0.25,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 11,
    paddingBottom: 23,
  },
  timelineTime: {
    fontSize: 21,
    fontWeight: "900",
  },
  timelineTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },
  timelineLocation: {
    flex: 1,
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "800",
  },
  timelineDetails: {
    color: "#4b5563",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 7,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0f2fe",
    borderRadius: 14,
    padding: 14,
  },
  noticeText: {
    flex: 1,
    color: "#075985",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  footer: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 18,
  },
});
