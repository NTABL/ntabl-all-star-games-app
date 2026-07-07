import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { clearManagerContext, getManagerContext } from "../stores/store";
import { API_BASE } from "../utils/appconfig";

type ManagerData = {
  role?: string;
  isAllStarManager?: boolean;
  email?: string;
  managerEmail?: string;
  managerName?: string;
  teamName?: string;
  division?: string;
  league?: string;
  rules?: {
    maxTotal?: number;
    maxPitchers?: number;
    maxPositionPlayers?: number;
  };
  allStarManagerAccess?: {
    username: string;
    displayName: string;
    squad: string;
    divisionIds: string[];
  };
};

const teamLogoImages: Record<string, any> = {
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

function getDivisionLogo(division: string) {
  if (division.includes("Open")) return require("../assets/OpenACP.png");
  if (division.includes("Veterans")) return require("../assets/VeteransACP.png");
  if (division.includes("Masters")) return require("../assets/MastersACP.png");
  if (division.includes("Regency")) return require("../assets/RegencyACP.png");
  if (division.includes("Rookie")) return require("../assets/RookieACP.png");
  return null;
}

export default function Dashboard() {
  const [status, setStatus] = useState("Not Submitted");
  const [managerData, setManagerData] = useState<ManagerData | null>(null);
  const { width, height } = useWindowDimensions();

  const isTabletLayout = width >= 700;
  const isShortScreen = height < 760;
  const isPlayer =
    String(managerData?.role || "").trim().toLowerCase() === "player";
  const isShawn =
    String(managerData?.email || managerData?.managerEmail || "")
      .trim()
      .toLowerCase() === "slee@dallasmsbl.com";

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [])
  );

async function loadScreen() {
  try {
    const manager = await getManagerContext();
    setManagerData(manager);
    console.log("MANAGER CONTEXT:", manager);

    const response = await fetch(`${API_BASE}/api/manager/submission-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teamName: manager?.teamName || "",
        division: manager?.division || "",
      }),
    });

    const responseText = await response.text();

let json: any = null;

try {
  json = JSON.parse(responseText);
} catch {
  console.log("DASHBOARD STATUS NON-JSON RESPONSE:", {
    status: response.status,
    url: `${API_BASE}/api/manager/submission-status`,
    bodyPreview: responseText.slice(0, 200),
  });

  setStatus("Not Submitted");
  return;
}

    if (json?.ok && json?.status) {
      setStatus(json.status);
      return;
    }

    setStatus("Not Submitted");
  } catch (e) {
    console.log(e);
    setStatus("Not Submitted");
  }
}

async function handleLogout() {
  try {
    await clearManagerContext();
    router.replace("/login");
  } catch (e) {
    console.log(e);
  }
}

  const divisionLogo = getDivisionLogo(managerData?.division || "");
  const teamLogo = getTeamLogo(managerData?.teamName || "", managerData?.division || "");

  function getStatusColor() {
    if (status === "Submitted") return "#15803d";
    if (status === "Not Submitted") return "#c62828";
    if (status === "Draft Saved") return "#eab308";
    return "#6b7280";
  }

  function handleOpenSelections() {
    if (status === "Submitted") {
      router.push("/appsubmitted");
      return;
    }

    router.push("/roster");
  }

  function handleAllStarManagerAccess() {
    const access = managerData?.allStarManagerAccess;
    if (!access) return;

    router.push({
      pathname: "/lineupbuilder",
      params: {
        username: access.username,
        displayName: access.displayName,
        squad: access.squad,
        divisionIds: JSON.stringify(access.divisionIds),
      },
    });
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
<ScrollView
  contentContainerStyle={[
    styles.container,
    isTabletLayout && styles.containerTablet,
  ]}
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
>
          <View style={styles.headerRow}>
            <Pressable onPress={handleLogout} style={styles.logoutButton}>
              <View style={styles.smallButtonRow}>
                <Ionicons
                  name="log-out-outline"
                  size={16}
                  color="#ffffff"
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.logoutText}>Logout</Text>
              </View>
            </Pressable>
          </View>

<View
  style={[
    styles.headerCard,
    isTabletLayout && styles.headerCardTablet,
  ]}
>
            <View style={styles.headerRowContent}>
              <View style={styles.headerTextWrap}>
<Text style={styles.welcome}>Welcome Back</Text>

<Text style={styles.managerName}>
  {managerData?.managerName || ""}
</Text>

<Text style={styles.teamHeader}>
  {managerData?.teamName || ""}
</Text>

<Text style={styles.divisionHeader}>
  {managerData?.division || ""}
</Text>

<Text style={styles.leagueName}>
  {managerData?.league || ""}
</Text>
              </View>

              <View style={styles.topLogoWrap}>
                <Image
                  source={require("../assets/NTABL-Logo.png")}
                  style={styles.headerLogo}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>

          <View
  style={[
    styles.card,
    isTabletLayout && styles.cardTablet,
  ]}
>
            <Text style={styles.cardTitle}>Team Information</Text>

            <View style={styles.teamInfoRow}>
              <View style={styles.teamInfoText}>
                <Text style={styles.label}>Team</Text>
                <Text style={styles.infoValue}>
                  {managerData?.teamName || ""}
                </Text>

<Text style={styles.label}>ALL-STAR SUBMISSION STATUS</Text>

<View
  style={[
    styles.statusBadge,
    {
      backgroundColor:
        status === "Submitted"
          ? "#15803d"
          : status === "Draft Saved"
          ? "#70700a"
          : "#c62828",
    },
  ]}
>
  <Text style={styles.statusBadgeText}>{status}</Text>
</View>
</View>

              <View style={styles.teamLogoWrap}>
                <Image
                  source={teamLogo}
                  style={styles.teamLogo}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>

          <View
  style={[
    styles.card,
    isTabletLayout && styles.cardTablet,
  ]}
>
            <Text style={styles.cardTitle}>Division Information</Text>

            <View style={styles.teamInfoRow}>
              <View style={styles.teamInfoText}>
                <Text style={styles.label}>Division</Text>
                <Text style={styles.infoValue}>
                  {managerData?.division || ""}
                </Text>
              </View>

              {divisionLogo && (
                <View style={styles.logoWrap}>
                  <Image
                    source={divisionLogo}
                    style={styles.divisionLogo}
                    resizeMode="contain"
                  />
                </View>
              )}
            </View>
          </View>

          <View
  style={[
    styles.card,
    isTabletLayout && styles.cardTablet,
  ]}
>
            <Text style={styles.cardTitle}>All-Star Selection Rules</Text>

            <View style={styles.ruleRow}>
              <Text style={styles.ruleLabel}>Total Players per Team</Text>
              <Text style={styles.ruleValue}>
                {managerData?.rules?.maxTotal ?? ""}
              </Text>
            </View>

            <View style={styles.ruleRow}>
              <Text style={styles.ruleLabel}>Pitchers per Team</Text>
              <Text style={styles.ruleValue}>
                {managerData?.rules?.maxPitchers ?? ""}
              </Text>
            </View>

            <View style={styles.ruleRow}>
              <Text style={styles.ruleLabel}>Position Players per Team</Text>
              <Text style={styles.ruleValue}>
                {managerData?.rules?.maxPositionPlayers ?? ""}
              </Text>
            </View>
          </View>

          <Pressable style={styles.primaryButton} onPress={handleOpenSelections}>
            <View style={styles.buttonContentRow}>
              <Ionicons
                name="people-outline"
                size={22}
                color="#ffffff"
                style={{ marginRight: 8 }}
              />

              <Text style={styles.primaryButtonText}>
                {isPlayer
                  ? "View All-Star Selections"
                  : status === "Submitted"
                  ? "View Submitted All-Stars"
                  : "Select All-Stars"}
              </Text>
            </View>
          </Pressable>

          {managerData?.isAllStarManager && managerData?.allStarManagerAccess && (
            <Pressable
              style={styles.allStarManagerButton}
              onPress={handleAllStarManagerAccess}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="person-outline"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.allStarManagerButtonText}>
                  All-Star Manager Access
                </Text>
              </View>
            </Pressable>
          )}

          <Pressable
            style={styles.changePasswordButton}
            onPress={() => router.push("/changepassword")}
          >
            <View style={styles.buttonContentRow}>
              <Ionicons
                name="lock-closed-outline"
                size={22}
                color="#ffffff"
                style={{ marginRight: 8 }}
              />

              <Text style={styles.changePasswordButtonText}>
                Change Password
              </Text>
            </View>
          </Pressable>

          {managerData && (
            <Pressable
              style={styles.announcerButton}
              onPress={() => router.push("/announcer")}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="mic-outline"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.announcerButtonText}>Announcer View</Text>
              </View>
            </Pressable>
          )}

          {isShawn && (
            <Pressable
              style={styles.adminButton}
              onPress={() => router.push("/adminlogin")}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="settings-outline"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.adminButtonText}>Admin</Text>
              </View>
            </Pressable>
          )}
          <Text style={styles.versionFooter}>
  NTABL All-Star App • Version 1.0
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
  flexGrow: 1,
  paddingHorizontal: 20,
  paddingTop: 50,
  paddingBottom: 70,
},

  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 8,
  },

  logoutButton: {
    backgroundColor: "#c62828",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  logoutText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },

headerCard: {
  backgroundColor: "#ffffff",
  borderRadius: 20,
  paddingTop: 14,
  paddingBottom: 16,
  paddingHorizontal: 20,
  marginBottom: 18,

  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: {
    width: 0,
    height: 4,
  },
  elevation: 6,
},

  headerRowContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerTextWrap: {
    flex: 1,
    paddingRight: 2,
  },

  topLogoWrap: {
    width: 105,
    alignItems: "flex-end",
    marginRight: 8,
  },

headerLogo: {
  width: 90,
  height: 90,
},

welcome: {
  fontSize: 15,
  fontWeight: "700",
  color: "#6b7280",
  marginBottom: 2,
},

  managerName: {
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 2,
    color: "#111827",
  },

  leagueName: {
    fontSize: 11,
    color: "#4b5563",
  },

card: {
  backgroundColor: "#ffffff",
  borderRadius: 20,
  padding: 20,
  marginBottom: 18,

  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: {
    width: 0,
    height: 4,
  },
  elevation: 6,
},

cardTitle: {
  fontSize: 21,
  fontWeight: "900",
  marginBottom: 16,
  color: "#1f4e9e",
  textAlign: "center",
},

  teamInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  teamInfoText: {
    flex: 1,
    paddingRight: 10,
  },

  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    marginTop: 10,
  },

  infoValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  teamLogoWrap: {
    width: 120,
    justifyContent: "center",
    alignItems: "flex-end",
  },

teamLogo: {
  width: 110,
  height: 110,
},

  logoWrap: {
    width: 120,
    justifyContent: "center",
    alignItems: "flex-end",
  },

divisionLogo: {
  width: 105,
  height: 105,
},

  ruleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },

  ruleLabel: {
    fontSize: 16,
    color: "#374151",
  },

  ruleValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  primaryButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },

  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  announcerButton: {
    marginTop: 12,
    backgroundColor: "#6b7280",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  announcerButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  changePasswordButton: {
    marginTop: 12,
    backgroundColor: "#c62828",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  changePasswordButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  adminButton: {
    marginTop: 12,
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  adminButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  allStarManagerButton: {
    marginTop: 12,
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  allStarManagerButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  smallButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  teamHeader: {
  fontSize: 18,
  fontWeight: "800",
  color: "#1f4e9e",
  marginTop: 4,
},

divisionHeader: {
  fontSize: 14,
  color: "#4b5563",
  marginTop: 2,
  marginBottom: 4,
},

statusBadge: {
  alignSelf: "flex-start",
  marginTop: 6,
  paddingHorizontal: 14,
  paddingVertical: 6,
  borderRadius: 999,
},

statusBadgeText: {
  color: "#ffffff",
  fontSize: 14,
  fontWeight: "900",
},

versionFooter: {
  color: "#6b7280",
  fontSize: 12,
  fontWeight: "700",
  textAlign: "center",
  marginTop: 26,
  marginBottom: 30,
},

containerTablet: {
  paddingTop: 30,
  paddingBottom: 40,
},

headerCardTablet: {
  minHeight: 140,
  justifyContent: "center",
},

cardTablet: {
  minHeight: 180,
},
});
