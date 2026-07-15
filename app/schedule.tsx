import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${minutes.padStart(2, "0")} ${suffix}`;
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

export default function ScheduleScreen() {
  const params = useLocalSearchParams<{
    all?: string;
    divisionIds?: string;
  }>();

  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const showAll = params.all === "true";

  const divisionIds = useMemo(() => {
    try {
      const parsed = JSON.parse(String(params.divisionIds || "[]"));
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }, [params.divisionIds]);

  useEffect(() => {
    loadSchedule();
  }, [params.all, params.divisionIds]);

  async function loadSchedule() {
    try {
      setLoading(true);

      const query = new URLSearchParams({
        all: showAll ? "true" : "false",
        divisionIds: divisionIds.join(","),
      });

      const response = await fetch(
        `${API_BASE}/api/schedules/active?${query.toString()}`
      );

      const json = await response.json();

      if (response.ok && json?.ok) {
        const nextSchedule = json.schedule as ScheduleConfig;
        setSchedule(nextSchedule);

        if (!showAll && nextSchedule.games.length === 1) {
          setExpandedGameId(nextSchedule.games[0].id);
        }
      }
    } catch (error) {
      console.log("SCHEDULE LOAD ERROR:", error);
    } finally {
      setLoading(false);
    }
  }

  function renderTimeline(game: GameSchedule) {
    return (
      <View style={styles.timeline}>
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
                  size={20}
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
                    size={14}
                    color="#6b7280"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.timelineLocation}>{item.location}</Text>
                </View>
              )}

              {!!item.details && (
                <Text style={styles.timelineDetails}>{item.details}</Text>
              )}
            </View>
          </View>
        ))}
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
              <View style={styles.eventMetaRow}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color="#1f4e9e"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.eventMetaText}>
                  {formatEventDate(schedule.eventDate)}
                </Text>
              </View>
            )}

            {!!schedule?.location && (
              <View style={styles.eventMetaRow}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color="#c62828"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.eventMetaText}>{schedule.location}</Text>
              </View>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#0369a1" />
              <Text style={styles.loadingText}>Loading Game Schedule...</Text>
            </View>
          ) : !schedule || schedule.games.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons
                name="calendar-clear-outline"
                size={52}
                color="#6b7280"
              />
              <Text style={styles.emptyTitle}>No Schedule Available</Text>
              <Text style={styles.emptyText}>
                A game schedule has not been assigned to this account.
              </Text>
            </View>
          ) : (
            schedule.games.map((game) => {
              const expanded =
                !showAll ||
                schedule.games.length === 1 ||
                expandedGameId === game.id;

              return (
                <View key={game.id} style={styles.gameCard}>
                  <Pressable
                    style={[
                      styles.gameHeader,
                      { backgroundColor: game.accentColor || "#1d4ed8" },
                    ]}
                    onPress={() =>
                      showAll &&
                      setExpandedGameId(expanded ? null : game.id)
                    }
                  >
                    <View style={styles.gameNumberBadge}>
                      <Text style={styles.gameNumberText}>
                        GAME {game.gameNumber}
                      </Text>
                    </View>

                    <View style={styles.gameHeaderText}>
                      <Text style={styles.gameTitle}>{game.title}</Text>
                      <Text style={styles.gameDivisionText}>
                        {game.divisionIds.join(" • ").toUpperCase()}
                      </Text>
                    </View>

                    {showAll && schedule.games.length > 1 && (
                      <Ionicons
                        name={
                          expanded
                            ? "chevron-up-outline"
                            : "chevron-down-outline"
                        }
                        size={24}
                        color="#ffffff"
                      />
                    )}
                  </Pressable>

                  {expanded && (
                    <View style={styles.gameBody}>{renderTimeline(game)}</View>
                  )}
                </View>
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
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  logo: {
    width: 210,
    height: 145,
    marginBottom: 4,
  },
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
  eventMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 9,
  },
  eventMetaText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "800",
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
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#1f4e9e",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 9,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
  },
  gameCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  gameHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  gameNumberBadge: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  gameNumberText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },
  gameHeaderText: {
    flex: 1,
  },
  gameTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
  },
  gameDivisionText: {
    color: "#e0f2fe",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  gameBody: {
    padding: 16,
  },
  timeline: {
    width: "100%",
  },
  timelineRow: {
    flexDirection: "row",
    minHeight: 92,
  },
  timelineRail: {
    width: 48,
    alignItems: "center",
  },
  timelineIcon: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: 3,
    flex: 1,
    opacity: 0.28,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 18,
  },
  timelineTime: {
    fontSize: 17,
    fontWeight: "900",
  },
  timelineTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  timelineLocation: {
    flex: 1,
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "800",
  },
  timelineDetails: {
    color: "#4b5563",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 5,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0f2fe",
    borderRadius: 14,
    padding: 13,
    marginTop: 2,
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
