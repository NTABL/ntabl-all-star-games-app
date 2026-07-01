import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";

import { adminFetch, API_BASE } from "../../utils/appconfig";

type Squad = "East" | "West";

type SquadManager = {
  managerName: string;
  managerEmail: string;
  source: string;
  username: string;
  password: string;
};

type GameConfig = {
  id: string;
  gameLabel: string;
  title: string;
  divisionId: string;
};

type PickerOption = {
  label: string;
  name: string;
  email: string;
};

const GAMES: Record<string, GameConfig> = {
  regency: {
    id: "game1",
    gameLabel: "Game 1",
    title: "60+ All-Stars",
    divisionId: "regency",
  },
  masters: {
    id: "game2",
    gameLabel: "Game 2",
    title: "45+ All-Stars",
    divisionId: "masters",
  },
  veterans: {
    id: "game3",
    gameLabel: "Game 3",
    title: "30+ / Rookie Prospects",
    divisionId: "veterans",
  },
  open: {
    id: "game4",
    gameLabel: "Game 4",
    title: "18+ All-Stars",
    divisionId: "open",
  },
};

function defaultUsername(gameId: string, squad: Squad) {
  const gameNumber = gameId.replace("game", "Game");
  return `${gameNumber}${squad}Manager`;
}

function defaultManager(game: GameConfig, squad: Squad): SquadManager {
  return {
    managerName: "",
    managerEmail: "",
    source: "manual",
    username: defaultUsername(game.id, squad),
    password: "",
  };
}

function renderGameLogo(divisionId: string) {
  if (divisionId === "regency") {
    return (
      <Image
        source={require("../../assets/RegencyACP.png")}
        style={styles.divisionLogo}
        resizeMode="contain"
      />
    );
  }

  if (divisionId === "masters") {
    return (
      <Image
        source={require("../../assets/MastersACP.png")}
        style={styles.divisionLogo}
        resizeMode="contain"
      />
    );
  }

  if (divisionId === "open") {
    return (
      <Image
        source={require("../../assets/OpenACP.png")}
        style={styles.divisionLogo}
        resizeMode="contain"
      />
    );
  }

  if (divisionId === "veterans") {
    return (
      <View style={styles.dualLogoRow}>
        <Image
          source={require("../../assets/VeteransACP.png")}
          style={styles.dualDivisionLogo}
          resizeMode="contain"
        />

        <Image
          source={require("../../assets/RookieACP.png")}
          style={styles.dualDivisionLogo}
          resizeMode="contain"
        />
      </View>
    );
  }

  return null;
}

export default function ManagerConfigScreen() {
  const params = useLocalSearchParams();
  const division = String(params.division || "");
  const game = GAMES[division];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [eastManager, setEastManager] = useState<SquadManager | null>(null);
  const [westManager, setWestManager] = useState<SquadManager | null>(null);

  const [teams, setTeams] = useState<any[]>([]);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>(
    {}
  );

  const [pickerContext, setPickerContext] = useState<{
    squad: Squad;
    options: PickerOption[];
  } | null>(null);

  const [saveMessage, setSaveMessage] = useState("");
  const [saveToast, setSaveToast] = useState("");

  const { width, height } = useWindowDimensions();
  const isTabletLayout = width >= 700;
  const isShortScreen = height < 760;

  useEffect(() => {
    if (game) {
      loadGameManagers();
    }
  }, [division]);

  async function loadGameManagers() {
    try {
      setLoading(true);

      const [managerResponse, teamResponse] = await Promise.all([
        adminFetch(`${API_BASE}/api/admin/divisions/${game.divisionId}/managers`),
        adminFetch(`${API_BASE}/api/admin/divisions/${game.divisionId}/teams`),
      ]);

      const managerJson = await managerResponse.json();
      const teamJson = await teamResponse.json();

      const saved = managerJson?.managers || {};

      setEastManager({
        ...defaultManager(game, "East"),
        ...(saved.East || {}),
        username: saved.East?.username || defaultUsername(game.id, "East"),
        password: "",
      });

      setWestManager({
        ...defaultManager(game, "West"),
        ...(saved.West || {}),
        username: saved.West?.username || defaultUsername(game.id, "West"),
        password: "",
      });

      setTeams(teamJson?.data || []);
    } catch (e) {
      console.log("LOAD MANAGER CONFIG ERROR:", e);
      setSaveMessage("Manager configuration could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function updateManagerField(
    squad: Squad,
    field: keyof SquadManager,
    value: string
  ) {
    if (squad === "East" && eastManager) {
      setEastManager({
        ...eastManager,
        [field]: value,
        source: "manual",
      });
    }

    if (squad === "West" && westManager) {
      setWestManager({
        ...westManager,
        [field]: value,
        source: "manual",
      });
    }
  }

  function getCaptainOptions() {
    return teams.flatMap((team) => {
      const options: PickerOption[] = [];

      if (team.captainName) {
        options.push({
          label: `${team.captainName} - ${team.name}`,
          name: team.captainName,
          email: team.captainEmail || "",
        });
      }

      if (Array.isArray(team.coCaptains)) {
        team.coCaptains.forEach((captain: any) => {
          options.push({
            label: `${captain.name} - ${team.name} Co-Captain`,
            name: captain.name,
            email: captain.email || "",
          });
        });
      }

      return options;
    });
  }

  function selectManagerFromPicker(squad: Squad, option: PickerOption) {
    if (squad === "East" && eastManager) {
      setEastManager({
        ...eastManager,
        managerName: option.name,
        managerEmail: option.email,
        source: "manual",
      });
    }

    if (squad === "West" && westManager) {
      setWestManager({
        ...westManager,
        managerName: option.name,
        managerEmail: option.email,
        source: "manual",
      });
    }
  }

  async function saveManagers() {
    if (!eastManager || !westManager) return;

    try {
      setSaving(true);
      setSaveMessage("");

      const response = await adminFetch(
        `${API_BASE}/api/admin/divisions/${game.divisionId}/managers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            East: eastManager,
            West: westManager,
          }),
        }
      );

      const json = await response.json();

      if (!json?.ok) {
        setSaveMessage("Managers could not be saved.");
        return;
      }

      const savedTime = new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });

      setSaveMessage(`Managers saved successfully at ${savedTime}.`);
      setSaveToast("Saved!");

      setTimeout(() => {
        setSaveToast("");
      }, 1400);
    } catch (e) {
      console.log("SAVE MANAGER CONFIG ERROR:", e);
      setSaveMessage("Managers could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function clearManagers() {
    if (eastManager) {
      setEastManager({
        ...eastManager,
        managerName: "",
        managerEmail: "",
        password: "",
      });
    }

    if (westManager) {
      setWestManager({
        ...westManager,
        managerName: "",
        managerEmail: "",
        password: "",
      });
    }

    setSaveMessage("Selections cleared. Tap Save Managers to confirm.");
  }

  function renderManagerPicker(squad: Squad, selectedName: string) {
    return (
      <Pressable
        style={[
          styles.managerPickerButton,
          squad === "East" ? styles.eastPickerButton : styles.westPickerButton,
        ]}
        onPress={() =>
          setPickerContext({
            squad,
            options: getCaptainOptions(),
          })
        }
      >
        <Text style={styles.managerPickerButtonText}>
          {selectedName || `Select ${squad} Manager`}
        </Text>

        <Text style={styles.managerPickerArrow}>▼</Text>
      </Pressable>
    );
  }

  function renderPasswordInput(squad: Squad, value: string) {
    const key = `${division}-${squad}`;

    return (
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          value={value}
          placeholder="Optional lineup password"
          placeholderTextColor="#9ca3af"
          secureTextEntry={!showPasswords[key]}
          onChangeText={(text) => updateManagerField(squad, "password", text)}
        />

        <Pressable
          onPress={() =>
            setShowPasswords((current) => ({
              ...current,
              [key]: !current[key],
            }))
          }
          style={styles.eyeButton}
        >
          <Ionicons
            name={showPasswords[key] ? "eye-off-outline" : "eye-outline"}
            size={22}
            color="#6b7280"
          />
        </Pressable>
      </View>
    );
  }

  function renderSquadCard(squad: Squad, manager: SquadManager) {
    return (
      <View style={styles.squadCard}>
        <View
          style={[
            styles.squadHeader,
            squad === "East" ? styles.eastHeader : styles.westHeader,
          ]}
        >
          <Text style={styles.squadHeaderText}>{squad}</Text>
        </View>

        <View style={styles.squadContent}>
          <Text style={styles.label}>Manager</Text>
          {renderManagerPicker(squad, manager.managerName)}

          <Text style={styles.manualLabel}>Manager Name</Text>
          <TextInput
            style={[
              styles.input,
              squad === "East" ? styles.eastInput : styles.westInput,
            ]}
            value={manager.managerName}
            placeholder={`Enter ${squad} manager name`}
            placeholderTextColor="#9ca3af"
            onChangeText={(value) =>
              updateManagerField(squad, "managerName", value)
            }
          />

          <Text style={styles.manualLabel}>Lineup Login</Text>
          <TextInput
            style={styles.input}
            value={manager.username}
            placeholder={`${squad} lineup login`}
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            onChangeText={(value) =>
              updateManagerField(squad, "username", value)
            }
          />

          <Text style={styles.manualLabel}>Lineup Password</Text>
          {renderPasswordInput(squad, manager.password)}

          <Text style={styles.helperText}>
            Optional. Leave blank when the assigned manager should access the
            lineup builder using their normal NTABL Manager login.
          </Text>
        </View>
      </View>
    );
  }

  if (!game) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Game Not Found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            isTabletLayout && styles.containerTablet,
            isShortScreen && styles.containerShort,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
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

            <Pressable style={styles.clearTopButton} onPress={clearManagers}>
              <View style={styles.smallButtonRow}>
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color="#ffffff"
                  style={{ marginRight: 5 }}
                />

                <Text style={styles.clearTopButtonText}>Clear</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.gameLabel}>{game.gameLabel}</Text>
            <Text style={styles.title}>{game.title}</Text>

            <View style={styles.logoWrapper}>{renderGameLogo(game.divisionId)}</View>
          </View>

          {saveMessage ? (
            <View
              style={[
                styles.successBanner,
                saveMessage.includes("could not") && styles.errorBanner,
              ]}
            >
              <Ionicons
                name={
                  saveMessage.includes("could not")
                    ? "alert-circle-outline"
                    : "checkmark-circle-outline"
                }
                size={22}
                color="#ffffff"
                style={{ marginRight: 8 }}
              />

              <Text style={styles.successBannerText}>{saveMessage}</Text>
            </View>
          ) : null}

          {loading || !eastManager || !westManager ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#1d4ed8" />
              <Text style={styles.loadingText}>Loading managers...</Text>
            </View>
          ) : (
            <>
              {renderSquadCard("East", eastManager)}
              {renderSquadCard("West", westManager)}

              <Pressable
                style={[styles.saveButton, saving && styles.disabledButton]}
                onPress={saveManagers}
                disabled={saving}
              >
                <View style={styles.buttonContentRow}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons
                        name="save-outline"
                        size={22}
                        color="#ffffff"
                        style={{ marginRight: 8 }}
                      />

                      <Text style={styles.saveButtonText}>Save Managers</Text>
                    </>
                  )}
                </View>
              </Pressable>

              <Text style={styles.versionFooter}>
                NTABL All-Star App • Version 1.0
              </Text>
            </>
          )}
        </ScrollView>

        {saveToast ? (
          <View pointerEvents="none" style={styles.toastOverlay}>
            <View style={styles.saveToast}>
              <Ionicons
                name="checkmark-circle"
                size={54}
                color="#15803d"
                style={{ marginBottom: 10 }}
              />

              <Text style={styles.saveToastText}>{saveToast}</Text>

              <Text style={styles.saveToastSubText}>
                All-Star managers were saved successfully.
              </Text>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <Modal
        visible={!!pickerContext}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerContext(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModalCard}>
            <Text style={styles.modalTitle}>
              Select {pickerContext?.squad} Manager
            </Text>

            {pickerContext?.options.length ? (
              pickerContext.options.map((option) => (
                <Pressable
                  key={option.label}
                  style={styles.pickerOption}
                  onPress={() => {
                    if (!pickerContext) return;

                    selectManagerFromPicker(pickerContext.squad, option);
                    setPickerContext(null);
                  }}
                >
                  <Text style={styles.pickerOptionText}>{option.label}</Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.noCaptainText}>
                No assigned captain options found.
              </Text>
            )}

            <Pressable
              style={styles.cancelButton}
              onPress={() => setPickerContext(null)}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="close-circle-outline"
                  size={18}
                  color="#ffffff"
                  style={{ marginRight: 6 }}
                />

                <Text style={styles.cancelButtonText}>Cancel</Text>
              </View>
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

  containerTablet: {
    paddingTop: 30,
    paddingBottom: 50,
  },

  containerShort: {
    paddingTop: 28,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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

  clearTopButton: {
    backgroundColor: "#6b7280",
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },

  clearTopButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  smallButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: "center",
    marginBottom: 16,

    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },

  gameLabel: {
    fontSize: 26,
    fontWeight: "900",
    color: "#15803d",
    textAlign: "center",
    marginBottom: 2,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 12,
  },

  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },

  divisionLogo: {
    width: 145,
    height: 88,
  },

  dualLogoRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  dualDivisionLogo: {
    width: 98,
    height: 70,
    marginHorizontal: 6,
  },

  successBanner: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 5,
  },

  errorBanner: {
    backgroundColor: "#c62828",
  },

  successBannerText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    flex: 1,
  },

  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",

    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },

  loadingText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
  },

  squadCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 0,
    marginBottom: 18,
    overflow: "hidden",

    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },

  squadHeader: {
    paddingVertical: 13,
    paddingHorizontal: 14,
  },

  eastHeader: {
    backgroundColor: "#c62828",
  },

  westHeader: {
    backgroundColor: "#1d4ed8",
  },

  squadHeaderText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },

  squadContent: {
    padding: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: "900",
    color: "#1f4e9e",
    marginBottom: 6,
  },

  manualLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6b7280",
    marginBottom: 4,
  },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
    backgroundColor: "#ffffff",
    borderColor: "#d1d5db",
  },

  eastInput: {
    borderColor: "#fca5a5",
    backgroundColor: "#fee2e2",
  },

  westInput: {
    borderColor: "#93c5fd",
    backgroundColor: "#dbeafe",
  },

  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    marginBottom: 8,
  },

  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  helperText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginBottom: 4,
  },

  managerPickerButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  eastPickerButton: {
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
  },

  westPickerButton: {
    backgroundColor: "#dbeafe",
    borderColor: "#93c5fd",
  },

  managerPickerButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
    flex: 1,
    marginRight: 8,
  },

  managerPickerArrow: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },

  saveButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 2,

    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 5,
  },

  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  disabledButton: {
    opacity: 0.55,
  },

  versionFooter: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 22,
    marginBottom: 8,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  pickerModalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    width: "88%",
    maxWidth: 520,

    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 10,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 14,
  },

  pickerOption: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 8,
  },

  pickerOptionText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },

  noCaptainText: {
    color: "#6b7280",
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },

  cancelButton: {
    backgroundColor: "#c62828",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },

  cancelButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  toastOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
    zIndex: 99999,
  },

  saveToast: {
    width: "84%",
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    elevation: 12,
  },

  saveToastText: {
    color: "#15803d",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },

  saveToastSubText: {
    color: "#555555",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
});