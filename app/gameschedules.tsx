import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
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

type ScheduleItem = {
  id: string;
  time: string;
  title: string;
  icon: string;
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

export default function GameSchedulesAdminScreen() {
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [resultVisible, setResultVisible] = useState(false);
  const [resultType, setResultType] = useState<"success" | "error">("success");
  const [resultTitle, setResultTitle] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [emailGame, setEmailGame] = useState<GameSchedule | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailRecipientCount, setEmailRecipientCount] = useState(0);
  const [emailMissingCount, setEmailMissingCount] = useState(0);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    loadSchedule();
  }, []);

  async function loadSchedule() {
    try {
      setLoading(true);

      const response = await adminFetch(
        `${API_BASE}/api/admin/game-schedules`
      );

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || "Game schedules could not be loaded.");
      }

      setSchedule(json.schedule);
    } catch (error: any) {
      showResult(
        "error",
        "Load Failed",
        error?.message || "Game schedules could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  function showResult(
    type: "success" | "error",
    title: string,
    message: string
  ) {
    setResultType(type);
    setResultTitle(title);
    setResultMessage(message);
    setResultVisible(true);
  }

  function updateRoot<K extends keyof ScheduleConfig>(
    key: K,
    value: ScheduleConfig[K]
  ) {
    setSchedule((current) =>
      current ? { ...current, [key]: value } : current
    );
  }

  function updateGame(gameId: string, patch: Partial<GameSchedule>) {
    setSchedule((current) =>
      current
        ? {
            ...current,
            games: current.games.map((game) =>
              game.id === gameId ? { ...game, ...patch } : game
            ),
          }
        : current
    );
  }

  function updateItem(
    gameId: string,
    itemId: string,
    patch: Partial<ScheduleItem>
  ) {
    setSchedule((current) =>
      current
        ? {
            ...current,
            games: current.games.map((game) =>
              game.id === gameId
                ? {
                    ...game,
                    items: game.items.map((item) =>
                      item.id === itemId ? { ...item, ...patch } : item
                    ),
                  }
                : game
            ),
          }
        : current
    );
  }

  function addItem(gameId: string) {
    const itemId = `${gameId}-${Date.now()}`;

    setSchedule((current) =>
      current
        ? {
            ...current,
            games: current.games.map((game) =>
              game.id === gameId
                ? {
                    ...game,
                    items: [
                      ...game.items,
                      {
                        id: itemId,
                        time: "",
                        title: "New Schedule Item",
                        icon: "time-outline",
                        location: "",
                        details: "",
                      },
                    ],
                  }
                : game
            ),
          }
        : current
    );
  }

  function removeItem(gameId: string, itemId: string) {
    setSchedule((current) =>
      current
        ? {
            ...current,
            games: current.games.map((game) =>
              game.id === gameId
                ? {
                    ...game,
                    items: game.items.filter((item) => item.id !== itemId),
                  }
                : game
            ),
          }
        : current
    );
  }

  async function openGameEmail(game: GameSchedule) {
    setEmailGame(game);
    setEmailSubject(`NTABL All-Star Games - ${game.title} Schedule`);
    setEmailMessage(`Hello {FirstName},

Please review the updated itinerary for the ${game.title}.

Division: {Division}
Squad: {Squad}
Role: {Role}

Open the NTABL All-Star App and select View Game Schedules to review the complete timeline.

Thank you,
NTABL`);

    try {
      setLoadingRecipients(true);

      const params = new URLSearchParams({
        audience: "everyone",
        divisionIds: game.divisionIds.join(","),
        squad: "all",
      });

      const response = await adminFetch(
        `${API_BASE}/api/admin/communications/recipients?${params.toString()}`
      );

      const json = await response.json();

      if (response.ok && json?.ok) {
        setEmailRecipientCount(Number(json.summaries?.withEmail || 0));
        setEmailMissingCount(Number(json.summaries?.withoutEmail || 0));
      }
    } catch (error) {
      console.log("GAME EMAIL RECIPIENT LOAD ERROR:", error);
    } finally {
      setLoadingRecipients(false);
    }
  }

  async function sendGameEmail() {
    if (!emailGame) return;

    if (!emailSubject.trim() || !emailMessage.trim()) {
      showResult(
        "error",
        "Message Required",
        "Enter both an email subject and message."
      );
      return;
    }

    try {
      setSendingEmail(true);

      const response = await adminFetch(
        `${API_BASE}/api/admin/communications/email`,
        {
          method: "POST",
          body: JSON.stringify({
            audience: "everyone",
            divisionIds: emailGame.divisionIds,
            divisionId: "all",
            squad: "all",
            subject: emailSubject,
            message: emailMessage,
            sendTest: false,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || "Game email could not be sent.");
      }

      setEmailGame(null);
      showResult(
        json.failedCount > 0 ? "error" : "success",
        "Game Email Complete",
        json.message || `${json.sentCount || 0} emails sent.`
      );
    } catch (error: any) {
      showResult(
        "error",
        "Game Email Failed",
        error?.message || "The game email could not be sent."
      );
    } finally {
      setSendingEmail(false);
    }
  }

  async function saveSchedule() {
    if (!schedule) return;

    try {
      setSaving(true);

      const response = await adminFetch(
        `${API_BASE}/api/admin/game-schedules`,
        {
          method: "POST",
          body: JSON.stringify({ schedule }),
        }
      );

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || "Game schedules could not be saved.");
      }

      setSchedule(json.schedule);
      showResult(
        "success",
        "Schedules Saved",
        "The active game schedules have been updated."
      );
    } catch (error: any) {
      showResult(
        "error",
        "Save Failed",
        error?.message || "Game schedules could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.replace("/admin")}
            >
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
              Configure the annual schedule shown to All-Star managers and LeagueApps administrators.
            </Text>
          </View>

          {loading || !schedule ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#0369a1" />
              <Text style={styles.loadingText}>Loading Schedules...</Text>
            </View>
          ) : (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Event Information</Text>

                <Text style={styles.inputLabel}>Active Year</Text>
                <TextInput
                  style={styles.input}
                  value={schedule.activeYear}
                  onChangeText={(value) => updateRoot("activeYear", value)}
                  keyboardType="numeric"
                />

                <Text style={styles.inputLabel}>Event Title</Text>
                <TextInput
                  style={styles.input}
                  value={schedule.eventTitle}
                  onChangeText={(value) => updateRoot("eventTitle", value)}
                />

                <Text style={styles.inputLabel}>
                  Event Date (YYYY-MM-DD)
                </Text>
                <TextInput
                  style={styles.input}
                  value={schedule.eventDate}
                  onChangeText={(value) => updateRoot("eventDate", value)}
                  placeholder="2026-07-26"
                  placeholderTextColor="#9ca3af"
                />

                <Text style={styles.inputLabel}>Location</Text>
                <TextInput
                  style={styles.input}
                  value={schedule.location}
                  onChangeText={(value) => updateRoot("location", value)}
                />
              </View>

              {schedule.games.map((game) => {
                const expanded = expandedGameId === game.id;

                return (
                  <View key={game.id} style={styles.gameCard}>
                    <Pressable
                      style={[
                        styles.gameHeader,
                        { backgroundColor: game.accentColor || "#0369a1" },
                      ]}
                      onPress={() =>
                        setExpandedGameId(expanded ? null : game.id)
                      }
                    >
                      <View style={styles.gameHeaderText}>
                        <Text style={styles.gameLabel}>
                          GAME {game.gameNumber}
                        </Text>
                        <Text style={styles.gameTitle}>{game.title}</Text>
                        <Text style={styles.gameDivisions}>
                          Divisions: {game.divisionIds.join(", ")}
                        </Text>
                      </View>

                      <Ionicons
                        name={
                          expanded
                            ? "chevron-up-outline"
                            : "chevron-down-outline"
                        }
                        size={26}
                        color="#ffffff"
                      />
                    </Pressable>

                    {expanded && (
                      <View style={styles.gameBody}>
                        <Text style={styles.inputLabel}>Game Title</Text>
                        <TextInput
                          style={styles.input}
                          value={game.title}
                          onChangeText={(value) =>
                            updateGame(game.id, { title: value })
                          }
                        />

                        <Text style={styles.inputLabel}>Short Title</Text>
                        <TextInput
                          style={styles.input}
                          value={game.shortTitle}
                          onChangeText={(value) =>
                            updateGame(game.id, { shortTitle: value })
                          }
                        />

                        <Text style={styles.inputLabel}>
                          Division IDs (comma separated)
                        </Text>
                        <TextInput
                          style={styles.input}
                          value={game.divisionIds.join(", ")}
                          onChangeText={(value) =>
                            updateGame(game.id, {
                              divisionIds: value
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean),
                            })
                          }
                        />

                        <Pressable
                          style={styles.emailGameButton}
                          onPress={() => openGameEmail(game)}
                        >
                          <View style={styles.buttonRow}>
                            <Ionicons
                              name="mail-outline"
                              size={20}
                              color="#ffffff"
                              style={{ marginRight: 7 }}
                            />
                            <Text style={styles.emailGameButtonText}>
                              Email This Game
                            </Text>
                          </View>
                        </Pressable>

                        <Text style={styles.timelineHeading}>
                          Schedule Timeline
                        </Text>

                        {game.items.map((item, index) => (
                          <View key={item.id} style={styles.itemCard}>
                            <View style={styles.itemHeaderRow}>
                              <Text style={styles.itemNumber}>
                                Item {index + 1}
                              </Text>

                              <Pressable
                                style={styles.deleteItemButton}
                                onPress={() => removeItem(game.id, item.id)}
                              >
                                <Ionicons
                                  name="trash-outline"
                                  size={17}
                                  color="#ffffff"
                                />
                              </Pressable>
                            </View>

                            <Text style={styles.inputLabel}>
                              Time (24-hour HH:MM)
                            </Text>
                            <TextInput
                              style={styles.input}
                              value={item.time}
                              onChangeText={(value) =>
                                updateItem(game.id, item.id, { time: value })
                              }
                              placeholder="10:50"
                              placeholderTextColor="#9ca3af"
                            />

                            <Text style={styles.inputLabel}>Title</Text>
                            <TextInput
                              style={styles.input}
                              value={item.title}
                              onChangeText={(value) =>
                                updateItem(game.id, item.id, { title: value })
                              }
                            />

                            <Text style={styles.inputLabel}>Location</Text>
                            <TextInput
                              style={styles.input}
                              value={item.location}
                              onChangeText={(value) =>
                                updateItem(game.id, item.id, {
                                  location: value,
                                })
                              }
                            />

                            <Text style={styles.inputLabel}>Details</Text>
                            <TextInput
                              style={styles.detailsInput}
                              value={item.details}
                              onChangeText={(value) =>
                                updateItem(game.id, item.id, {
                                  details: value,
                                })
                              }
                              multiline
                              textAlignVertical="top"
                            />
                          </View>
                        ))}

                        <Pressable
                          style={styles.addItemButton}
                          onPress={() => addItem(game.id)}
                        >
                          <View style={styles.buttonRow}>
                            <Ionicons
                              name="add-circle-outline"
                              size={20}
                              color="#ffffff"
                              style={{ marginRight: 6 }}
                            />
                            <Text style={styles.addItemButtonText}>
                              Add Schedule Item
                            </Text>
                          </View>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}

              <Pressable
                style={[styles.saveButton, saving && styles.disabledButton]}
                onPress={saveSchedule}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <View style={styles.buttonRow}>
                    <Ionicons
                      name="save-outline"
                      size={22}
                      color="#ffffff"
                      style={{ marginRight: 7 }}
                    />
                    <Text style={styles.saveButtonText}>
                      Save Game Schedules
                    </Text>
                  </View>
                )}
              </Pressable>
            </>
          )}

          <Text style={styles.footer}>
            NTABL All-Star App • Schedule Administration
          </Text>
        </ScrollView>
      </View>

      <Modal
        visible={!!emailGame}
        transparent
        animationType="fade"
        onRequestClose={() => setEmailGame(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.emailModalCard}>
            <Ionicons
              name="mail-outline"
              size={52}
              color="#0369a1"
              style={{ marginBottom: 8 }}
            />

            <Text style={styles.modalTitle}>Email This Game</Text>
            <Text style={styles.emailGameTitle}>{emailGame?.title}</Text>

            <View style={styles.recipientSummary}>
              {loadingRecipients ? (
                <ActivityIndicator color="#0369a1" />
              ) : (
                <>
                  <Text style={styles.recipientReady}>
                    {emailRecipientCount} Email Ready
                  </Text>
                  {emailMissingCount > 0 && (
                    <Text style={styles.recipientMissing}>
                      {emailMissingCount} Missing Email
                    </Text>
                  )}
                </>
              )}
            </View>

            <ScrollView
              style={styles.emailModalScroll}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.inputLabel}>Subject</Text>
              <TextInput
                style={styles.input}
                value={emailSubject}
                onChangeText={setEmailSubject}
              />

              <Text style={styles.inputLabel}>Message</Text>
              <TextInput
                style={styles.emailMessageInput}
                value={emailMessage}
                onChangeText={setEmailMessage}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>

            <Pressable
              style={[
                styles.sendGameEmailButton,
                (sendingEmail || emailRecipientCount === 0) &&
                  styles.disabledButton,
              ]}
              onPress={sendGameEmail}
              disabled={sendingEmail || emailRecipientCount === 0}
            >
              {sendingEmail ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <View style={styles.buttonRow}>
                  <Ionicons
                    name="send-outline"
                    size={20}
                    color="#ffffff"
                    style={{ marginRight: 7 }}
                  />
                  <Text style={styles.sendGameEmailButtonText}>
                    Send to {emailRecipientCount} Recipient
                    {emailRecipientCount === 1 ? "" : "s"}
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelEmailButton}
              onPress={() => setEmailGame(null)}
              disabled={sendingEmail}
            >
              <View style={styles.buttonRow}>
                <Ionicons
                  name="close-circle-outline"
                  size={19}
                  color="#ffffff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.cancelEmailButtonText}>Cancel</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={resultVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResultVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.resultCard}>
            <Ionicons
              name={
                resultType === "success"
                  ? "checkmark-circle"
                  : "alert-circle"
              }
              size={58}
              color={resultType === "success" ? "#15803d" : "#c62828"}
              style={{ marginBottom: 8 }}
            />

            <Text style={styles.modalTitle}>{resultTitle}</Text>
            <Text style={styles.modalMessage}>{resultMessage}</Text>

            <Pressable
              style={styles.modalButton}
              onPress={() => setResultVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
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
  },
  title: {
    color: "#1f4e9e",
    fontSize: 29,
    fontWeight: "900",
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
  sectionTitle: {
    color: "#1f4e9e",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12,
  },
  inputLabel: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 11,
    backgroundColor: "#ffffff",
    paddingVertical: 11,
    paddingHorizontal: 12,
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  detailsInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 11,
    backgroundColor: "#ffffff",
    padding: 12,
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
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
    padding: 15,
  },
  gameHeaderText: {
    flex: 1,
  },
  gameLabel: {
    color: "#e0f2fe",
    fontSize: 11,
    fontWeight: "900",
  },
  gameTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 2,
  },
  gameDivisions: {
    color: "#e0f2fe",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  gameBody: {
    padding: 16,
  },
  emailGameButton: {
    backgroundColor: "#0f766e",
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 14,
  },
  emailGameButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  timelineHeading: {
    color: "#1f4e9e",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#dbe5f1",
    borderRadius: 14,
    padding: 13,
    marginBottom: 12,
  },
  itemHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  itemNumber: {
    color: "#0369a1",
    fontSize: 14,
    fontWeight: "900",
  },
  deleteItemButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#c62828",
    alignItems: "center",
    justifyContent: "center",
  },
  addItemButton: {
    backgroundColor: "#0369a1",
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: "center",
  },
  addItemButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  saveButton: {
    backgroundColor: "#15803d",
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 16,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
  },
  modalOverlay: {
    ...modalStyles.overlay,
  },
  emailModalCard: {
    ...modalStyles.card,
    maxHeight: "90%",
    alignItems: "center",
  },
  emailGameTitle: {
    color: "#4b5563",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 5,
  },
  recipientSummary: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 11,
    padding: 11,
    marginTop: 12,
    marginBottom: 10,
  },
  recipientReady: {
    color: "#15803d",
    fontSize: 13,
    fontWeight: "900",
  },
  recipientMissing: {
    color: "#c2410c",
    fontSize: 13,
    fontWeight: "900",
  },
  emailModalScroll: {
    width: "100%",
    maxHeight: 390,
  },
  emailMessageInput: {
    minHeight: 190,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 11,
    backgroundColor: "#ffffff",
    padding: 12,
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 12,
  },
  sendGameEmailButton: {
    width: "100%",
    backgroundColor: "#15803d",
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: "center",
  },
  sendGameEmailButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  cancelEmailButton: {
    width: "100%",
    backgroundColor: "#c62828",
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 10,
  },
  cancelEmailButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  resultCard: {
    ...modalStyles.compactCard,
    alignItems: "center",
  },
  modalTitle: {
    color: "#1f4e9e",
    fontSize: 23,
    fontWeight: "900",
    textAlign: "center",
  },
  modalMessage: {
    color: "#4b5563",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },
  modalButton: {
    width: "100%",
    backgroundColor: "#1d4ed8",
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 16,
  },
  modalButtonText: {
    color: "#ffffff",
    fontSize: 16,
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
