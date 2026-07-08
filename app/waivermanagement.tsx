import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
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

const GAMES: GameOption[] = [
  { id: "game1", gameLabel: "Game 1", title: "60+ All-Stars", divisionId: "regency", logoType: "single" },
  { id: "game2", gameLabel: "Game 2", title: "45+ All-Stars", divisionId: "masters", logoType: "single" },
  { id: "game3", gameLabel: "Game 3", title: "30+ / Rookie Prospects", divisionId: "veterans", logoType: "dual" },
  { id: "game4", gameLabel: "Game 4", title: "18+ All-Stars", divisionId: "open", logoType: "single" },
];

function renderGameLogo(game: GameOption) {
  if (game.divisionId === "regency") return <Image source={require("../assets/RegencyACP.png")} style={styles.divisionLogo} resizeMode="contain" />;
  if (game.divisionId === "masters") return <Image source={require("../assets/MastersACP.png")} style={styles.divisionLogo} resizeMode="contain" />;
  if (game.divisionId === "open") return <Image source={require("../assets/OpenACP.png")} style={styles.divisionLogo} resizeMode="contain" />;

  if (game.divisionId === "veterans") {
    return (
      <View style={styles.dualLogoRow}>
        <Image source={require("../assets/VeteransACP.png")} style={styles.dualDivisionLogo} resizeMode="contain" />
        <Image source={require("../assets/RookieACP.png")} style={styles.dualDivisionLogo} resizeMode="contain" />
      </View>
    );
  }

  return null;
}

export default function WaiverManagementScreen() {
  const [config, setConfig] = useState<any>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [waiverYear, setWaiverYear] = useState("");
  const [waiverVersion, setWaiverVersion] = useState("");
  const [venueName, setVenueName] = useState("");
  const [hostName, setHostName] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    loadWaiverConfig();
  }, []);

  function openGame(game: GameOption) {
    router.push(`/waiverdivision/${game.divisionId}`);
  }

  async function loadWaiverConfig() {
    try {
      const response = await fetch(`${API_BASE}/api/waivers/config`);
      const json = await response.json();

      if (response.ok && json?.ok) {
        setConfig(json.config);
        setWaiverYear(String(json.config?.waiverYear || ""));
        setWaiverVersion(String(json.config?.waiverVersion || ""));
        setVenueName(String(json.config?.venueName || "Riders Field"));
        setHostName(String(json.config?.hostName || "Frisco RoughRiders"));
      }
    } catch (e) {
      console.log("WAIVER CONFIG LOAD ERROR:", e);
    }
  }

  async function saveWaiverConfig() {
    try {
      setSavingConfig(true);

      const response = await adminFetch(`${API_BASE}/api/admin/waivers/config`, {
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
      });

      const json = await response.json();

      if (response.ok && json?.ok) {
        setConfig(json.config);
        setShowConfigModal(false);
      }
    } catch (e) {
      console.log("WAIVER CONFIG SAVE ERROR:", e);
    } finally {
      setSavingConfig(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.replace("/admin")}>
              <View style={styles.buttonContentRow}>
                <Ionicons name="chevron-back-outline" size={16} color="#ffffff" style={{ marginRight: 3 }} />
                <Text style={styles.backButtonText}>Back</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.heroCard}>
            <Image source={require("../assets/NTABL-Logo.png")} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Waiver Management</Text>
            <Text style={styles.subtitle}>Select a Game to Review Waiver Status</Text>
          </View>

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
                  <Ionicons name="settings-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.editConfigButtonText}>Edit</Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.configInfoBox}>
              <Text style={styles.configLabel}>Waiver Year</Text>
              <Text style={styles.configValue}>{config?.waiverYear || "Not Listed"}</Text>

              <Text style={styles.configLabel}>Waiver Version</Text>
              <Text style={styles.configValue}>{config?.waiverVersion || "Not Listed"}</Text>

              <Text style={styles.configLabel}>Host</Text>
              <Text style={styles.configValue}>{config?.hostName || "Not Listed"}</Text>

              <Text style={styles.configLabel}>Venue</Text>
              <Text style={styles.configValue}>{config?.venueName || "Not Listed"}</Text>
            </View>
          </View>

          <View style={styles.grid}>
            {GAMES.map((game) => (
              <View key={game.id} style={styles.gameTile}>
                <View style={styles.gameHeader}>
                  <Text style={styles.gameLabel}>{game.gameLabel}</Text>
                  <Text style={styles.gameTitle}>{game.title}</Text>
                </View>

                <View style={styles.logoBox}>{renderGameLogo(game)}</View>

                <Pressable style={styles.selectButton} onPress={() => openGame(game)}>
                  <View style={styles.buttonContentRow}>
                    <Ionicons name="document-text-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.selectButtonText}>Review</Text>
                  </View>
                </Pressable>
              </View>
            ))}
          </View>

          <Text style={styles.versionFooter}>NTABL All-Star App • Version 1.0</Text>
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
              style={[styles.saveConfigButton, savingConfig && styles.disabledButton]}
              onPress={saveWaiverConfig}
              disabled={savingConfig}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons name="save-outline" size={20} color="#ffffff" style={{ marginRight: 6 }} />
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
    fontSize: 14,
    fontWeight: "800",
  },

  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 20,
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
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 2,
    minHeight: 32,
  },

  logoBox: {
    height: 92,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingTop: 8,
  },

  divisionLogo: {
    width: 112,
    height: 76,
  },

  dualLogoRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  dualDivisionLogo: {
    width: 68,
    height: 58,
    marginHorizontal: 3,
  },

  selectButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginBottom: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
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