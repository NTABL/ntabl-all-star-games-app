import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ScrollView,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { getManagerContext } from "../stores/store";
import { API_BASE } from "../utils/appconfig";
import { modalStyles } from "../utils/modalStyles";

const teamLogoImages: Record<string, any> = {
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

  if (key.includes("dallasorioles")) {
    return teamLogoImages.dallasorioles30;
  }

  if (key.includes("redsox") && divisionKey.includes("60")) {
    return teamLogoImages.redsox60;
  }

  if (key.includes("redsox")) {
    return teamLogoImages.redsox45;
  }

  return teamLogoImages[key] || require("../assets/NTABL-Logo.png");
}

export default function AppSubmittedScreen() {
  const [players, setPlayers] = useState<any[]>([]);
  const [teamName, setTeamName] = useState("");
  const [division, setDivision] = useState("");
  const [teamLogoSource, setTeamLogoSource] = useState<any>(
    require("../assets/NTABL-Logo.png")
  );
  const [loading, setLoading] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);
  const { width, height } = useWindowDimensions();
  const isTabletLayout = width >= 700;
  const isShortScreen = height < 760;

  useEffect(() => {
    loadSubmitted();
  }, []);

  async function loadSubmitted() {
    try {
      const manager = await getManagerContext();

      const managerTeamName = manager?.teamName || "";
      const managerDivision = manager?.division || "";

      setTeamName(managerTeamName);
      setDivision(managerDivision);
      setTeamLogoSource(getTeamLogo(managerTeamName, managerDivision));

      const response = await fetch(`${API_BASE}/api/manager/submission-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamName: managerTeamName,
          division: managerDivision,
        }),
      });

      const json = await response.json();

      if (!json?.ok || json?.status !== "Submitted") {
        setPlayers([]);
        return;
      }

      setPlayers(Array.isArray(json.players) ? json.players : []);
    } catch (e) {
      console.log("APP SUBMITTED LOAD ERROR:", e);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }

  function renderPlayerCard({ item, index }: { item: any; index: number }) {
    return (
      <View
        style={[
          styles.playerCard,
          isTabletLayout && styles.playerCardTablet,
        ]}
      >
        <View style={styles.playerOrderBadge}>
          <Text style={styles.playerOrderText}>{index + 1}</Text>
        </View>

        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{item.name}</Text>

<View style={styles.playerDetailRow}>
  <View style={styles.detailPill}>
    <Text style={styles.detailPillText}>#{item.jerseyNumber || "-"}</Text>
  </View>

  <View style={styles.detailPill}>
    <Text style={styles.detailPillText}>{item.position || "POS"}</Text>
  </View>
</View>
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            isTabletLayout && styles.containerTablet,
            isShortScreen && styles.containerShort,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.replace("/dashboard")}
              style={styles.backButton}
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
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowInstructions(true)}
              style={styles.helpButton}
            >
              <View style={styles.smallButtonRow}>
                <Ionicons
                  name="help-circle-outline"
                  size={17}
                  color="#ffffff"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.helpButtonText}>Help</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.summaryCard,
              isTabletLayout && styles.summaryCardTablet,
            ]}
          >
            <Image
              source={teamLogoSource}
              style={[
                styles.teamLogo,
                isTabletLayout && styles.teamLogoTablet,
              ]}
              resizeMode="contain"
            />

            <View style={styles.submittedTitleRow}>
              <Ionicons
                name="checkmark-circle"
                size={isTabletLayout ? 38 : 42}
                color="#15803d"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.title}>All-Stars Submitted</Text>
            </View>

            <Text style={styles.teamName}>{teamName}</Text>
            {!!division && <Text style={styles.divisionText}>{division}</Text>}

            <View style={styles.successBadge}>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color="#ffffff"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.successBadgeText}>
                {players.length} Players Submitted Successfully
              </Text>
            </View>

            <Text style={styles.readyText}>Roster Ready for Review</Text>
          </View>

          <Text style={styles.sectionTitle}>Submitted Players</Text>

          {loading ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Loading submitted players...</Text>
            </View>
          ) : players.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Submitted roster could not be displayed.
              </Text>
            </View>
          ) : (
            players.map((item, index) => (
              <View key={String(item.id || index)}>
                {renderPlayerCard({ item, index })}
              </View>
            ))
          )}

          <View style={styles.buttonArea}>
            <TouchableOpacity
              style={styles.editRosterButton}
              onPress={() => router.replace("/roster")}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="create-outline"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.editRosterButtonText}>
                  Edit All-Star Roster
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dashboardButton}
              onPress={() => router.replace("/dashboard")}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="home-outline"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.dashboardButtonText}>
                  Back to Dashboard
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.versionFooter}>
              NTABL All-Star App • Version 1.0
            </Text>
          </View>
        </ScrollView>

        <Modal
          visible={showInstructions}
          transparent
          animationType="fade"
          onRequestClose={() => setShowInstructions(false)}
        >
          <View style={styles.instructionsOverlay}>
            <View style={styles.instructionsModalCard}>
              <Image
                source={require("../assets/NTABL-Logo.png")}
                style={styles.instructionsLogo}
                resizeMode="contain"
              />

              <Text style={styles.instructionsTitle}>Instructions</Text>

              <Text style={styles.instructionsText}>
                1. To <Text style={styles.boldText}>Edit</Text>, use your finger
                or a mouse to scroll down to the bottom of your players list.
              </Text>

              <Text style={styles.instructionsText}>
                2. Select the{" "}
                <Text style={styles.blueBoldText}>Edit All-Star Roster</Text>{" "}
                button to edit your <Text style={styles.boldText}>All-Star Selections</Text>.
              </Text>

              <Text style={styles.instructionsText}>
                3. Be sure to scroll down after making edits to{" "}
                <Text style={styles.greenBoldText}>Submit All-Stars</Text> when
                completed.
              </Text>

              <Pressable
                style={styles.instructionsOkButton}
                onPress={() => setShowInstructions(false)}
              >
                <Text style={styles.instructionsOkButtonText}>OK, Got It!</Text>
              </Pressable>
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
    backgroundColor: "#eef2f7",
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },

  containerTablet: {
    paddingTop: 30,
    paddingBottom: 30,
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
    fontWeight: "800",
    fontSize: 14,
  },

  smallButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryCard: {
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

  summaryCardTablet: {
    paddingVertical: 16,
  },

  teamLogo: {
    width: 175,
    height: 115,
    alignSelf: "center",
    marginBottom: 4,
  },

  teamLogoTablet: {
    width: 180,
    height: 110,
  },

  submittedTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 4,
  },

  teamName: {
    fontSize: 23,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
    marginTop: 4,
  },

  divisionText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6b7280",
    textAlign: "center",
    marginTop: 2,
    marginBottom: 12,
  },

  successBadge: {
    backgroundColor: "#15803d",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  successBadgeText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },

  readyText: {
    color: "#4b5563",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 10,
  },

  sectionTitle: {
    color: "#1f4e9e",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
    textAlign: "center",
  },

  listContent: {
    paddingBottom: 26,
  },

  listContentTablet: {
    paddingBottom: 36,
  },

  playerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 5,
  },

  playerCardTablet: {
    paddingVertical: 16,
    paddingHorizontal: 18,
  },

  playerOrderBadge: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#1f4e9e",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  playerOrderText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  playerInfo: {
    flex: 1,
    minWidth: 0,
  },

  playerName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
  },

  playerDetailRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 7,
  },

detailPill: {
  backgroundColor: "#eef2f7",
  minWidth: 54,
  height: 34,
  borderRadius: 999,
  marginRight: 8,
  alignItems: "center",
  justifyContent: "center",
},

detailPillText: {
  color: "#374151",
  fontSize: 13,
  fontWeight: "900",
  lineHeight: 16,
},

  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    marginBottom: 10,
  },

  emptyText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },

  buttonArea: {
    marginTop: 6,
    marginBottom: 20,
  },

  editRosterButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },

  editRosterButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  dashboardButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  dashboardButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  versionFooter: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 24,
    marginBottom: 18,
  },

  helpButton: {
  backgroundColor: "#6b7280",
  borderRadius: 9,
  paddingVertical: 7,
  paddingHorizontal: 13,
},

helpButtonText: {
  color: "#ffffff",
  fontWeight: "800",
  fontSize: 14,
},

instructionsOverlay: {
  ...modalStyles.overlay,
},

instructionsModalCard: {
  ...modalStyles.compactCard,
},

instructionsLogo: {
  width: 110,
  height: 70,
  alignSelf: "center",
  marginBottom: 6,
},

instructionsTitle: {
  fontSize: 24,
  fontWeight: "900",
  color: "#1f4e9e",
  textAlign: "center",
  marginBottom: 14,
},

instructionsText: {
  fontSize: 16,
  color: "#374151",
  lineHeight: 24,
  marginBottom: 10,
  fontWeight: "700",
},

boldText: {
  fontWeight: "900",
  color: "#111827",
},

blueBoldText: {
  fontWeight: "900",
  color: "#1d4ed8",
},

greenBoldText: {
  fontWeight: "900",
  color: "#15803d",
},

instructionsOkButton: {
  backgroundColor: "#15803d",
  borderRadius: 12,
  paddingVertical: 14,
  alignItems: "center",
  marginTop: 12,
},

instructionsOkButtonText: {
  color: "#ffffff",
  fontSize: 16,
  fontWeight: "900",
},
});
