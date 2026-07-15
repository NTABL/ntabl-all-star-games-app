import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  clearManagerContext,
  exitImpersonation,
  getManagerContext,
  switchManagerAssignment,
} from "../stores/store";
import { API_BASE } from "../utils/appconfig";
import { modalStyles } from "../utils/modalStyles";

type ManagerData = {
  role?: string;
  isAllStarManager?: boolean;
  isSelectedAllStar?: boolean;
  isLeagueAppsAdmin?: boolean;
  divisionId?: string;
  selectedAllStarIds?: string[];
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
  assignmentKey?: string;
  activeAssignmentKey?: string;
  assignments?: ManagerData[];
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
  const [waiverSigned, setWaiverSigned] = useState(false);
  const [showWaiverPrompt, setShowWaiverPrompt] = useState(false);
  const { width, height } = useWindowDimensions();
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpMessage, setHelpMessage] = useState("");
  const [helpSending, setHelpSending] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [supportModalType, setSupportModalType] = useState<"success" | "error">("success");
  const [supportModalTitle, setSupportModalTitle] = useState("");
  const [supportModalMessage, setSupportModalMessage] = useState("");
  const [showTeamSwitcher, setShowTeamSwitcher] = useState(false);
  const [switchingTeam, setSwitchingTeam] = useState(false);
  const isTabletLayout = width >= 700;
  const isShortScreen = height < 760;
  const isPlayer =
    String(managerData?.role || "").trim().toLowerCase() === "player";
  const shouldShowWaiver =
    !!managerData?.isAllStarManager || !!managerData?.isSelectedAllStar;
  const canViewSchedule =
    !!managerData?.isAllStarManager || !!managerData?.isLeagueAppsAdmin;
  const isShawn =
    String(managerData?.email || managerData?.managerEmail || "")
      .trim()
      .toLowerCase() === "slee@dallasmsbl.com";

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [])
  );

  function getWaiverPersonId(manager: any) {
  const loggedInPlayer = Array.isArray(manager?.roster)
    ? manager.roster.find(
        (player: any) =>
          String(player?.email || "").trim().toLowerCase() ===
          String(manager?.email || "").trim().toLowerCase()
      )
    : null;

  return String(loggedInPlayer?.id || manager?.email || "unknown");
}

async function checkWaiverStatus(manager: any) {
  try {
    const role = manager?.isAllStarManager
      ? "all-star-manager"
      : String(manager?.role || "player").toLowerCase();

    const squad = manager?.allStarManagerAccess?.squad || manager?.squad || "";

    const response = await fetch(
      `${API_BASE}/api/waivers/status?divisionId=${encodeURIComponent(
        manager?.division || ""
      )}&squad=${encodeURIComponent(squad)}&role=${encodeURIComponent(
        role
      )}&personId=${encodeURIComponent(getWaiverPersonId(manager))}`
    );

    const json = await response.json();

    if (response.ok && json?.ok && json?.signed) {
      setWaiverSigned(true);
      setShowWaiverPrompt(false);
      return;
    }

    setWaiverSigned(false);

    if (manager?.isAllStarManager || manager?.isSelectedAllStar) {
      setShowWaiverPrompt(true);
    }
} catch (e) {
  console.log(e);

  if (manager?.isAllStarManager || manager?.isSelectedAllStar) {
    setWaiverSigned(false);
    setShowWaiverPrompt(true);
  }
}
}

async function loadScreen() {
  try {
    const manager = await getManagerContext();
    setManagerData(manager);
    await checkWaiverStatus(manager);
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


async function handleExitImpersonation() {
  try {
    await exitImpersonation();
    router.replace("/admin");
  } catch (e) {
    console.log(e);
  }
}


async function handleSwitchTeam(assignmentKey: string) {
  try {
    setSwitchingTeam(true);
    const nextManager = await switchManagerAssignment(assignmentKey);

    if (!nextManager) {
      showSupportMessage(
        "error",
        "Team Switch Failed",
        "That team assignment could not be loaded. Please log out and try again."
      );
      return;
    }

    setShowTeamSwitcher(false);
    setManagerData(nextManager);
    setStatus("Not Submitted");
    setWaiverSigned(false);
    setShowWaiverPrompt(false);
    await loadScreen();
  } catch (e) {
    console.log(e);
    showSupportMessage(
      "error",
      "Team Switch Failed",
      "The selected team could not be loaded. Please try again."
    );
  } finally {
    setSwitchingTeam(false);
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

  function showSupportMessage(
  type: "success" | "error",
  title: string,
  message: string
) {
  setSupportModalType(type);
  setSupportModalTitle(title);
  setSupportModalMessage(message);
  setSupportModalVisible(true);
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

  function handleOpenSchedule() {
    const divisionIds = managerData?.isLeagueAppsAdmin
      ? []
      : managerData?.allStarManagerAccess?.divisionIds ||
        [managerData?.divisionId || managerData?.division || ""].filter(Boolean);

    router.push({
      pathname: "/schedule",
      params: {
        all: managerData?.isLeagueAppsAdmin ? "true" : "false",
        divisionIds: JSON.stringify(divisionIds),
      },
    });
  }

async function sendHelpRequest() {
  const cleanMessage = helpMessage.trim();

  if (!cleanMessage) return;

  try {
    setHelpSending(true);

    const response = await fetch(`${API_BASE}/api/help-request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: managerData?.managerName || "",
        email: managerData?.email || managerData?.managerEmail || "",
        role: managerData?.role || "",
        team: managerData?.teamName || "",
        division: managerData?.division || "",
        appVersion: "1.0",
        platform: "web/app",
        message: cleanMessage,
      }),
    });

    const json = await response.json();

    if (!response.ok || !json?.ok) {
      showSupportMessage(
        "error",
        "Help Request Failed",
        json?.message || "Help request could not be sent."
      );
      return;
    }

    setHelpMessage("");
    setShowHelpModal(false);

    showSupportMessage(
      "success",
      "Help Request Sent",
      "Thank you! Your request has been sent to NTABL Support."
    );
  } catch (e) {
    console.log(e);

    showSupportMessage(
      "error",
      "Help Request Failed",
      "Help request could not be sent."
    );
  } finally {
    setHelpSending(false);
  }
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
          {managerData?.isImpersonating && (
            <View style={styles.impersonationBanner}>
              <View style={styles.impersonationBannerText}>
                <Text style={styles.impersonationLabel}>ADMIN IMPERSONATION</Text>
                <Text style={styles.impersonationName}>
                  Viewing as {managerData?.managerName || managerData?.email || "Member"}
                </Text>
              </View>

              <Pressable
                style={styles.exitImpersonationButton}
                onPress={handleExitImpersonation}
              >
                <Text style={styles.exitImpersonationButtonText}>Exit</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.headerRow}>
            <Pressable
              onPress={
                managerData?.isImpersonating
                  ? handleExitImpersonation
                  : handleLogout
              }
              style={styles.logoutButton}
            >
              <View style={styles.smallButtonRow}>
                <Ionicons
                  name="log-out-outline"
                  size={16}
                  color="#ffffff"
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.logoutText}>
                  {managerData?.isImpersonating ? "Exit Admin View" : "Logout"}
                </Text>
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

{Array.isArray(managerData?.assignments) && managerData.assignments.length > 1 && (
  <View
    style={[
      styles.teamSwitcherCard,
      isTabletLayout && styles.cardTablet,
    ]}
  >
    <View style={styles.teamSwitcherTextWrap}>
      <Text style={styles.teamSwitcherLabel}>CURRENT TEAM ASSIGNMENT</Text>
      <Text style={styles.teamSwitcherTeam}>{managerData?.teamName || ""}</Text>
      <Text style={styles.teamSwitcherDivision}>{managerData?.division || ""}</Text>
    </View>

    <Pressable
      style={styles.switchTeamButton}
      onPress={() => setShowTeamSwitcher(true)}
    >
      <View style={styles.buttonContentRow}>
        <Ionicons
          name="swap-horizontal-outline"
          size={20}
          color="#ffffff"
          style={{ marginRight: 6 }}
        />
        <Text style={styles.switchTeamButtonText}>Switch Team</Text>
      </View>
    </Pressable>
  </View>
)}

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

<Text style={styles.label}>PLAYER ALL-STAR WAIVER STATUS</Text>

<View
  style={[
    styles.statusBadge,
    {
      backgroundColor: !shouldShowWaiver
        ? "#6b7280"
        : waiverSigned
        ? "#15803d"
        : "#c62828",
    },
  ]}
>
  <Text style={styles.statusBadgeText}>
    {!shouldShowWaiver
      ? "Not Selected"
      : waiverSigned
      ? "Complete"
      : "Incomplete"}
  </Text>
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

{shouldShowWaiver && (
  <Pressable
    style={[
      styles.waiverButton,
      waiverSigned && styles.waiverButtonComplete,
    ]}
    onPress={() => router.push("/waiver")}
  >
    <View style={styles.buttonContentRow}>
      <Ionicons
        name={waiverSigned ? "checkmark-circle" : "document-text-outline"}
        size={22}
        color="#ffffff"
        style={{ marginRight: 8 }}
      />

      <Text style={styles.waiverButtonText}>
        {waiverSigned ? "Waiver Completed" : "Complete Waiver"}
      </Text>
    </View>
  </Pressable>
)}

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

          {canViewSchedule && (
            <Pressable
              style={styles.scheduleButton}
              onPress={handleOpenSchedule}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="calendar-outline"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.scheduleButtonText}>
                  {managerData?.isLeagueAppsAdmin
                    ? "View All Game Schedules"
                    : "View Game Schedule"}
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
{managerData && (
  <Pressable
    style={styles.helpButton}
    onPress={() => setShowHelpModal(true)}
  >
    <View style={styles.buttonContentRow}>
      <Ionicons
        name="help-circle-outline"
        size={22}
        color="#111827"
        style={{ marginRight: 8 }}
      />

      <Text style={styles.helpButtonText}>
        Contact Support
      </Text>
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
      <Modal
  visible={showTeamSwitcher}
  transparent
  animationType="fade"
  onRequestClose={() => setShowTeamSwitcher(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.teamSwitcherModal}>
      <Ionicons
        name="swap-horizontal-outline"
        size={52}
        color="#1d4ed8"
        style={{ marginBottom: 8 }}
      />

      <Text style={styles.teamSwitcherTitle}>Select Team</Text>
      <Text style={styles.teamSwitcherMessage}>
        Choose the team and division you want to manage.
      </Text>

      <View style={styles.assignmentList}>
        {(managerData?.assignments || []).map((assignment) => {
          const isActive =
            assignment.assignmentKey === managerData?.activeAssignmentKey ||
            (assignment.teamName === managerData?.teamName &&
              assignment.division === managerData?.division);

          return (
            <Pressable
              key={assignment.assignmentKey || `${assignment.division}-${assignment.teamName}`}
              style={[
                styles.assignmentOption,
                isActive && styles.assignmentOptionActive,
              ]}
              disabled={switchingTeam || isActive}
              onPress={() =>
                handleSwitchTeam(
                  assignment.assignmentKey || `${assignment.division}::${assignment.teamName}`
                )
              }
            >
              <View style={styles.assignmentOptionText}>
                <Text style={styles.assignmentTeamName}>
                  {assignment.teamName || "Team"}
                </Text>
                <Text style={styles.assignmentDivisionName}>
                  {assignment.division || "Division not listed"}
                </Text>
              </View>

              <Ionicons
                name={isActive ? "checkmark-circle" : "chevron-forward-circle-outline"}
                size={25}
                color={isActive ? "#15803d" : "#1d4ed8"}
              />
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={styles.teamSwitcherCancelButton}
        onPress={() => setShowTeamSwitcher(false)}
        disabled={switchingTeam}
      >
        <Text style={styles.teamSwitcherCancelText}>
          {switchingTeam ? "Switching..." : "Cancel"}
        </Text>
      </Pressable>
    </View>
  </View>
</Modal>

      <Modal
  visible={showWaiverPrompt}
  transparent
  animationType="fade"
  onRequestClose={() => setShowWaiverPrompt(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.waiverPromptModal}>
      <Ionicons
        name="document-text-outline"
        size={54}
        color="#1d4ed8"
        style={{ marginBottom: 10 }}
      />

      <Text style={styles.waiverPromptTitle}>Waiver Required</Text>

      <Text style={styles.waiverPromptMessage}>
        Please complete your Frisco RoughRiders Agreement and Release of Liability Waiver
        before participating in the NTABL Charity All-Star Games.
      </Text>

      <View style={styles.waiverPromptButtonRow}>
        <Pressable
          style={styles.waiverPromptLaterButton}
          onPress={() => setShowWaiverPrompt(false)}
        >
          <Text style={styles.waiverPromptButtonText}>Not Now</Text>
        </Pressable>

        <Pressable
          style={styles.waiverPromptContinueButton}
          onPress={() => {
            setShowWaiverPrompt(false);
            router.push("/waiver");
          }}
        >
          <Text style={styles.waiverPromptButtonText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  </View>
</Modal>
<Modal
  visible={showHelpModal}
  transparent
  animationType="fade"
  onRequestClose={() => setShowHelpModal(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.helpModal}>
      <Ionicons
        name="help-circle-outline"
        size={50}
        color="#1d4ed8"
        style={{ marginBottom: 8 }}
      />

<Text style={styles.helpTitle}>Need Assistance?</Text>

<Text style={styles.helpFieldLabel}>Name</Text>
<Text style={styles.helpDisplayValue}>
  {managerData?.managerName || "Not Listed"}
</Text>

<Text style={styles.helpFieldLabel}>Email</Text>
<Text style={styles.helpDisplayValue}>
  {managerData?.email || managerData?.managerEmail || "Not Listed"}
</Text>

<Text style={styles.helpFieldLabel}>Subject</Text>
<Text style={styles.helpDisplayValue}>NTABL App Assistance</Text>

<Text style={styles.helpFieldLabel}>How can we help you?</Text>

      <TextInput
        style={styles.helpInput}
        multiline
        maxLength={500}
        value={helpMessage}
        onChangeText={setHelpMessage}
        placeholder="Tell us what you need help with..."
        placeholderTextColor="#9ca3af"
      />

      <Text style={styles.helpCounter}>{helpMessage.length}/500</Text>

      <View style={styles.waiverPromptButtonRow}>
        <Pressable
          style={styles.waiverPromptLaterButton}
          onPress={() => {
            setShowHelpModal(false);
            setHelpMessage("");
          }}
        >
          <Text style={styles.waiverPromptButtonText}>Cancel</Text>
        </Pressable>

        <Pressable
          style={[
            styles.helpSendButton,
            (!helpMessage.trim() || helpSending) && { opacity: 0.5 },
          ]}
          onPress={sendHelpRequest}
          disabled={!helpMessage.trim() || helpSending}
        >
          <Text style={styles.waiverPromptButtonText}>
            {helpSending ? "Sending..." : "Send"}
          </Text>
        </Pressable>
      </View>
    </View>
  </View>
</Modal>

<Modal
  visible={supportModalVisible}
  transparent
  animationType="fade"
  onRequestClose={() => setSupportModalVisible(false)}
>
  <View style={styles.modalOverlay}>
    <View
      style={[
        styles.helpModal,
        supportModalType === "error" && styles.supportErrorModal,
      ]}
    >
      <Ionicons
        name={supportModalType === "error" ? "alert-circle" : "checkmark-circle"}
        size={54}
        color={supportModalType === "error" ? "#c62828" : "#15803d"}
        style={{ marginBottom: 10 }}
      />

      <Text
        style={[
          styles.helpTitle,
          supportModalType === "error" && styles.supportErrorText,
        ]}
      >
        {supportModalTitle}
      </Text>

      <Text style={styles.waiverPromptMessage}>{supportModalMessage}</Text>

      <Pressable
        style={[
          styles.modalOkButton,
          supportModalType === "error" && styles.supportErrorButton,
        ]}
        onPress={() => setSupportModalVisible(false)}
      >
        <View style={styles.buttonContentRow}>
          <Ionicons
            name="checkmark-circle-outline"
            size={20}
            color="#ffffff"
            style={{ marginRight: 6 }}
          />

          <Text style={styles.waiverPromptButtonText}>OK</Text>
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

  impersonationBanner: {
    backgroundColor: "#7c3aed",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 7,
  },

  impersonationBannerText: {
    flex: 1,
    paddingRight: 10,
  },

  impersonationLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  impersonationName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
  },

  exitImpersonationButton: {
    backgroundColor: "#ffffff",
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },

  exitImpersonationButtonText: {
    color: "#7c3aed",
    fontSize: 13,
    fontWeight: "900",
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
  marginTop: 12,
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

  helpButton: {
  marginTop: 12,
  backgroundColor: "#d1d5db",
  borderRadius: 12,
  paddingVertical: 14,
  alignItems: "center",
},

helpButtonText: {
  color: "#111827",
  fontSize: 16,
  fontWeight: "800",
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

  scheduleButton: {
    marginTop: 12,
    backgroundColor: "#166534",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  scheduleButtonText: {
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

waiverButton: {
  marginTop: 12,
  backgroundColor: "#1f4e9e",
  borderRadius: 12,
  paddingVertical: 14,
  alignItems: "center",
},

waiverButtonText: {
  color: "#ffffff",
  fontSize: 16,
  fontWeight: "700",
},

modalOverlay: {
  ...modalStyles.overlay,
},

waiverPromptModal: {
  ...modalStyles.card,
  alignItems: "center",
},

waiverPromptTitle: {
  color: "#1d4ed8",
  fontSize: 24,
  fontWeight: "900",
  textAlign: "center",
},

waiverPromptMessage: {
  color: "#555555",
  fontSize: 15,
  fontWeight: "700",
  textAlign: "center",
  marginTop: 8,
  lineHeight: 21,
},

waiverPromptButtonRow: {
  flexDirection: "row",
  marginTop: 18,
  width: "100%",
},

waiverPromptLaterButton: {
  flex: 1,
  backgroundColor: "#6b7280",
  borderRadius: 10,
  paddingVertical: 12,
  alignItems: "center",
  marginRight: 8,
},

waiverPromptContinueButton: {
  flex: 1,
  backgroundColor: "#1d4ed8",
  borderRadius: 10,
  paddingVertical: 12,
  alignItems: "center",
  marginLeft: 8,
},

waiverPromptButtonText: {
  color: "#ffffff",
  fontSize: 15,
  fontWeight: "900",
},

waiverButtonComplete: {
  backgroundColor: "#6b7280",
},

helpModal: {
  ...modalStyles.card,
  alignItems: "center",
},

helpTitle: {
  color: "#1d4ed8",
  fontSize: 24,
  fontWeight: "900",
  textAlign: "center",
},

helpEmail: {
  color: "#111827",
  fontSize: 14,
  fontWeight: "800",
  marginTop: 8,
  textAlign: "center",
},

helpSubject: {
  color: "#6b7280",
  fontSize: 13,
  fontWeight: "800",
  marginTop: 4,
  marginBottom: 10,
  textAlign: "center",
},

helpInput: {
  width: "100%",
  minHeight: 120,
  borderWidth: 1,
  borderColor: "#d1d5db",
  borderRadius: 12,
  padding: 12,
  color: "#111827",
  fontSize: 15,
  fontWeight: "700",
  textAlignVertical: "top",
  backgroundColor: "#ffffff",
},

helpCounter: {
  alignSelf: "flex-end",
  color: "#6b7280",
  fontSize: 12,
  fontWeight: "800",
  marginTop: 6,
},

helpSendButton: {
  flex: 1,
  backgroundColor: "#15803d",
  borderRadius: 10,
  paddingVertical: 12,
  alignItems: "center",
  marginLeft: 8,
},

helpFieldLabel: {
  alignSelf: "flex-start",
  color: "#6b7280",
  fontSize: 12,
  fontWeight: "900",
  textTransform: "uppercase",
  marginTop: 10,
  marginBottom: 4,
},

helpDisplayValue: {
  alignSelf: "flex-start",
  color: "#111827",
  fontSize: 15,
  fontWeight: "800",
  marginBottom: 4,
},

modalOkButton: {
  marginTop: 18,
  backgroundColor: "#15803d",
  borderRadius: 10,
  paddingVertical: 12,
  paddingHorizontal: 28,
  alignItems: "center",
},

supportErrorModal: {
  borderWidth: 3,
  borderColor: "#c62828",
},

supportErrorText: {
  color: "#c62828",
},

supportErrorButton: {
  backgroundColor: "#c62828",
},


teamSwitcherCard: {
  backgroundColor: "#ffffff",
  borderRadius: 20,
  padding: 16,
  marginBottom: 18,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
},

teamSwitcherTextWrap: {
  flex: 1,
  paddingRight: 12,
},

teamSwitcherLabel: {
  color: "#6b7280",
  fontSize: 11,
  fontWeight: "900",
  textTransform: "uppercase",
  marginBottom: 4,
},

teamSwitcherTeam: {
  color: "#111827",
  fontSize: 18,
  fontWeight: "900",
},

teamSwitcherDivision: {
  color: "#4b5563",
  fontSize: 13,
  fontWeight: "700",
  marginTop: 2,
},

switchTeamButton: {
  backgroundColor: "#1d4ed8",
  borderRadius: 11,
  paddingVertical: 11,
  paddingHorizontal: 14,
  alignItems: "center",
},

switchTeamButtonText: {
  color: "#ffffff",
  fontSize: 14,
  fontWeight: "900",
},

teamSwitcherModal: {
  ...modalStyles.card,
  alignItems: "center",
},

teamSwitcherTitle: {
  color: "#1d4ed8",
  fontSize: 25,
  fontWeight: "900",
  textAlign: "center",
},

teamSwitcherMessage: {
  color: "#555555",
  fontSize: 14,
  fontWeight: "700",
  textAlign: "center",
  marginTop: 5,
  marginBottom: 14,
},

assignmentList: {
  width: "100%",
},

assignmentOption: {
  width: "100%",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "#f4f8fd",
  borderWidth: 1,
  borderColor: "#dbe5f1",
  borderRadius: 14,
  paddingVertical: 13,
  paddingHorizontal: 14,
  marginBottom: 10,
},

assignmentOptionActive: {
  backgroundColor: "#ecfdf3",
  borderColor: "#15803d",
  borderWidth: 2,
},

assignmentOptionText: {
  flex: 1,
  paddingRight: 10,
},

assignmentTeamName: {
  color: "#111827",
  fontSize: 16,
  fontWeight: "900",
},

assignmentDivisionName: {
  color: "#6b7280",
  fontSize: 13,
  fontWeight: "700",
  marginTop: 2,
},

teamSwitcherCancelButton: {
  marginTop: 8,
  backgroundColor: "#6b7280",
  borderRadius: 11,
  paddingVertical: 12,
  paddingHorizontal: 24,
  alignItems: "center",
},

teamSwitcherCancelText: {
  color: "#ffffff",
  fontSize: 15,
  fontWeight: "900",
},
});
