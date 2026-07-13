import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { getManagerContext } from "../stores/store";
import { API_BASE } from "../utils/appconfig";
import { modalStyles } from "../utils/modalStyles";

const DEFAULT_MAX_POSITION_PLAYERS = 5;
const DEFAULT_MAX_PITCHERS = 2;
const FIELD_WIDTH = 58;
const FIELD_HEIGHT = 42;

const POSITION_OPTIONS = [
  "C",
  "P",
  "1B",
  "2B",
  "SS",
  "3B",
  "LF",
  "CF",
  "RF",
  "IF",
  "OF",
  "DH",
];

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

type Player = {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  jerseyNumber?: string;
  number?: string;
  playerNumber?: string;
  uniformNumber?: string;
  preferredPosition?: string;
  email?: string;
  ["Player Number"]?: string;
  ["Preferred Position"]?: string;
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

export default function RosterScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [jerseys, setJerseys] = useState<{ [key: string]: string }>({});
  const [positions, setPositions] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);

  const [positionModalVisible, setPositionModalVisible] = useState(false);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [showSubmittedSplash, setShowSubmittedSplash] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isPlayer, setIsPlayer] = useState(false);
  const [teamLogoSource, setTeamLogoSource] = useState<any>(
    require("../assets/NTABL-Logo.png")
  );
  const [teamName, setTeamName] = useState("");
  const [divisionName, setDivisionName] = useState("");
  const [managerData, setManagerData] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "warning">(
    "success"
  );

  const { width, height } = useWindowDimensions();
  const isTabletLayout = width >= 700;
  const isShortScreen = height < 760;
  const maxPositionPlayers = Number(
    managerData?.rules?.maxPositionPlayers ?? DEFAULT_MAX_POSITION_PLAYERS
  );

  const maxPitchers = Number(
    managerData?.rules?.maxPitchers ?? DEFAULT_MAX_PITCHERS
  );

const maxTotal = maxPositionPlayers + maxPitchers;

const selectedPlayers = selected
  .map((id) => players.find((player) => String(player.id) === String(id)))
  .filter((player): player is Player => !!player);

const selectedPitchers = selectedPlayers.filter(
  (player) => (positions[player.id] || getPlayerPosition(player)).toUpperCase() === "P"
).length;

const selectedPositionPlayers = selected.length - selectedPitchers;

function playerLabel(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

  useEffect(() => {
    loadScreen();
  }, []);

  function showToast(
    message: string,
    type: "success" | "error" | "warning" = "success"
  ) {
    setToastMessage(message);
    setToastType(type);

    setTimeout(() => {
      setToastMessage("");
    }, 1700);
  }

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/dashboard");
    }
  }

  function getPlayerName(player: Player) {
    if (player.name) return player.name;
    return [player.firstName, player.lastName].filter(Boolean).join(" ");
  }

  function getPlayerNumber(player: Player) {
    return String(
      player.jerseyNumber ??
        player.number ??
        player.playerNumber ??
        player.uniformNumber ??
        player["Player Number"] ??
        ""
    );
  }

  function getPlayerPosition(player: Player) {
    return String(player.preferredPosition ?? player["Preferred Position"] ?? "");
  }

  async function loadScreen() {
    try {
      const manager = await getManagerContext();
      setManagerData(manager);
      const nextTeamName = manager?.teamName || "";
      const nextDivisionName = manager?.division || "";

      setTeamName(nextTeamName);
      setDivisionName(nextDivisionName);
      setTeamLogoSource(getTeamLogo(nextTeamName, nextDivisionName));
      setIsPlayer(manager?.role === "player");

      const roster = Array.isArray(manager?.roster) ? manager.roster : [];
      setPlayers(roster);

      const apiJerseys: { [key: string]: string } = {};
      const apiPositions: { [key: string]: string } = {};

      roster.forEach((player: Player) => {
        apiJerseys[player.id] = getPlayerNumber(player);
        apiPositions[player.id] = getPlayerPosition(player);
      });

      const response = await fetch(`${API_BASE}/api/manager/submission-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamName: nextTeamName,
          division: nextDivisionName,
        }),
      });

      const json = await response.json();
      const backendPlayers = Array.isArray(json?.players) ? json.players : [];

      if (json?.ok && backendPlayers.length > 0 && manager?.role !== "player") {
        const backendJerseys: { [key: string]: string } = {};
        const backendPositions: { [key: string]: string } = {};

        backendPlayers.forEach((player: any) => {
          const playerId = String(player?.id || "");

          if (!playerId) return;

          backendJerseys[playerId] = String(player?.jerseyNumber || "");
          backendPositions[playerId] = String(player?.position || "");
        });

        setSelected(backendPlayers.map((player: any) => String(player?.id || "")).filter(Boolean));
        setJerseys({ ...apiJerseys, ...backendJerseys });
        setPositions({ ...apiPositions, ...backendPositions });
        return;
      }

      if (manager?.role === "player") {
        setSelected(
          Array.isArray(manager?.selectedAllStarIds)
            ? manager.selectedAllStarIds.map(String)
            : []
        );
} else {
  setSelected([]);
  setShowInstructions(manager?.role !== "player");
}

      setJerseys(apiJerseys);
      setPositions(apiPositions);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }

  function togglePlayer(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }

if (prev.length >= maxTotal) {
  showToast(`You have already selected ${maxTotal} players.`, "warning");
  return prev;
}

      return [...prev, id];
    });
  }

  function updateJersey(id: string, value: string) {
    setJerseys((prev) => ({ ...prev, [id]: value }));
  }

  function updatePosition(id: string, value: string) {
    setPositions((prev) => ({ ...prev, [id]: value }));
  }

  function openPositionModal(playerId: string) {
    setActivePlayerId(playerId);
    setPositionModalVisible(true);
  }

  function choosePosition(value: string) {
    if (activePlayerId) {
      updatePosition(activePlayerId, value);
    }

    setPositionModalVisible(false);
    setActivePlayerId(null);
  }

  function buildSubmissionPlayers() {
    return selected.map((playerId) => {
      const player = players.find((p) => String(p.id) === String(playerId));

      return {
        id: String(playerId),
        name: player ? getPlayerName(player) : "",
        jerseyNumber: jerseys[playerId] || "",
        position: positions[playerId] || "",
      };
    });
  }

async function saveDraft() {
  try {
    const manager = await getManagerContext();

    const response = await fetch(`${API_BASE}/api/manager/save-draft`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teamName: manager?.teamName,
        division: manager?.division,
        managerName: manager?.managerName,
        players: buildSubmissionPlayers(),
      }),
    });

    const json = await response.json();

    if (!response.ok || !json?.ok) {
      throw new Error(json?.message || json?.error || "Draft save failed.");
    }

    showToast(selected.length === 0 ? "Draft Cleared!" : "Draft Saved!");
  } catch (e) {
    console.log(e);
    showToast("Draft could not be saved.", "error");
  }
}

  async function submitRoster() {
if (selected.length !== maxTotal) {
  showToast(`Select ${maxTotal} total players.`, "warning");
  return;
}

if (selectedPitchers !== maxPitchers) {
  showToast(
    `Select ${maxPitchers} ${playerLabel(maxPitchers, "pitcher", "pitchers")}.`,
    "warning"
  );
  return;
}

if (selectedPositionPlayers !== maxPositionPlayers) {
  showToast(
    `Select ${maxPositionPlayers} ${playerLabel(
      maxPositionPlayers,
      "position player",
      "position players"
    )}.`,
    "warning"
  );
  return;
}

    try {
      const manager = await getManagerContext();

      const response = await fetch(`${API_BASE}/api/manager/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamName: manager?.teamName,
          division: manager?.division,
          managerName: manager?.managerName,
          players: buildSubmissionPlayers(),
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Submission failed.");
      }

      setShowSubmittedSplash(true);

      setTimeout(() => {
        setShowSubmittedSplash(false);
        router.replace("/appsubmitted");
      }, 2500);
    } catch (e) {
      console.log(e);
      showToast("Submission failed. Please try again.", "error");
    }
  }

async function clearRoster() {
  try {
    const manager = await getManagerContext();
    const response = await fetch(`${API_BASE}/api/manager/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teamName: manager?.teamName,
        division: manager?.division,
      }),
    });

    console.log("CLEAR STATUS:", response.status);
    console.log("CLEAR CONTENT TYPE:", response.headers.get("content-type"));

    const text = await response.text();
    console.log("CLEAR RESPONSE:", text);

    const json = JSON.parse(text);

    if (!response.ok || !json?.ok) {
      throw new Error(json?.message || json?.error || "Clear failed.");
    }

    // ...rest of your existing success code...

    if (!response.ok || !json?.ok) {
      throw new Error(json?.message || json?.error || "Clear failed.");
    }

    const resetJerseys: { [key: string]: string } = {};
    const resetPositions: { [key: string]: string } = {};

    players.forEach((player: Player) => {
      resetJerseys[player.id] = getPlayerNumber(player);
      resetPositions[player.id] = getPlayerPosition(player);
    });

setSelected([]);
setJerseys(resetJerseys);
setPositions(resetPositions);
setShowInstructions(true);

showToast("Roster Cleared!");
  } catch (e) {
    console.log(e);
    showToast("Roster could not be cleared.", "error");
  }
}

    function renderHeader() {
    return (
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={goBack} style={styles.topButton}>
          <View style={styles.smallButtonRow}>
            <Ionicons
              name="chevron-back-outline"
              size={16}
              color="#ffffff"
              style={{ marginRight: 3 }}
            />

            <Text style={styles.topButtonText}>Back</Text>
          </View>
        </TouchableOpacity>

        {!isPlayer && (
          <TouchableOpacity
            onPress={() => setShowClearConfirm(true)}
            style={styles.clearTopButton}
          >
            <View style={styles.smallButtonRow}>
              <Ionicons
                name="trash-outline"
                size={16}
                color="#ffffff"
                style={{ marginRight: 4 }}
              />

              <Text style={styles.clearTopButtonText}>Clear</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function renderTeamHeader() {
    return (
      <View
        style={[
          styles.teamHeaderCard,
          isTabletLayout && styles.teamHeaderCardTablet,
          isShortScreen && styles.teamHeaderCardShort,
        ]}
      >
        <Image
          source={teamLogoSource}
          style={[
            styles.teamLogo,
            isTabletLayout && styles.teamLogoTablet,
            isShortScreen && styles.teamLogoShort,
          ]}
          resizeMode="contain"
        />

        <Text style={styles.teamName}>{teamName}</Text>

        {!!divisionName && (
          <Text style={styles.divisionName}>{divisionName}</Text>
        )}

        <Text style={styles.title}>
          {isPlayer ? "Team Roster" : "2026 All-Star Selections"}
        </Text>

<Text style={styles.subtitle}>
  {isPlayer
    ? "View Current Team Roster"
    : `Select ${maxPositionPlayers} ${playerLabel(
    maxPositionPlayers,
    "Position Player",
    "Position Players"
  )} and ${maxPitchers} ${playerLabel(maxPitchers, "Pitcher", "Pitchers")}`}
</Text>
      </View>
    );
  }

  function renderProgressBar() {
    const percent = Math.min(selected.length / maxTotal, 1);

    return (
      <View style={styles.progressCard}>
        <View style={styles.progressHeaderRow}>
          <Text style={styles.progressTitle}>Selection Progress</Text>

          <Text
            style={[
              styles.progressCount,
              selected.length === maxTotal && styles.progressCompleteText,
            ]}
          >
            {selected.length} / {maxTotal}
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${percent * 100}%`,
                backgroundColor:
                  selected.length === maxTotal ? "#15803d" : "#1d4ed8",
              },
            ]}
          />
        </View>

        <Text
          style={[
            styles.progressSubText,
            selected.length === maxTotal && styles.progressCompleteText,
          ]}
        >
          {selected.length === maxTotal
            ? "Ready to Submit"
            : `${maxTotal - selected.length} player${
                maxTotal - selected.length === 1 ? "" : "s"
              } remaining`}
        </Text>
      </View>
    );
  }

  function renderPlayerCard(item: Player) {
    const isSelected = selected.includes(item.id);
    const currentJersey = jerseys[item.id] || "";
    const currentPosition = positions[item.id] || "";
    const playerName = getPlayerName(item);

    if (isPlayer) {
      return (
        <View
          style={[
            styles.playerCard,
            isSelected && styles.selectedPlayerCard,
            isTabletLayout && styles.playerCardTablet,
          ]}
        >
          <View style={styles.playerMainInfo}>
            <View style={styles.playerNameRow}>
              <Text style={styles.playerNameText}>{playerName}</Text>

              {!!currentJersey && (
                <Text style={styles.jerseyBadge}>#{currentJersey}</Text>
              )}
            </View>

            {!!currentPosition && (
              <Text style={styles.playerMetaText}>
                Position: {currentPosition}
              </Text>
            )}
          </View>

          {isSelected && (
            <Image
              source={require("../assets/Selected.png")}
              style={styles.selectedImage}
              resizeMode="contain"
            />
          )}
        </View>
      );
    }

    return (
      <View
        style={[
          styles.playerCard,
          isSelected && styles.selectedPlayerCard,
          isTabletLayout && styles.playerCardTablet,
        ]}
      >
        <View style={styles.playerTopRow}>
          <View style={styles.playerMainInfo}>
            <View style={styles.playerNameRow}>
              <Text style={styles.playerNameText}>{playerName}</Text>

              {!!currentJersey && (
                <Text style={styles.jerseyBadge}>#{currentJersey}</Text>
              )}
            </View>

            <Text style={styles.playerMetaText}>
              Preferred Position: {currentPosition || "Not Listed"}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.selectButton,
              isSelected && styles.removeButton,
            ]}
            onPress={() => togglePlayer(item.id)}
          >
            <View style={styles.buttonContentRow}>
              <Ionicons
                name={isSelected ? "trash-outline" : "person-add-outline"}
                size={16}
                color="#ffffff"
                style={{ marginRight: 4 }}
              />

              <Text style={styles.selectButtonText}>
                {isSelected ? "Remove" : "Select"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {isSelected && (
          <View style={styles.selectedControls}>
            <View style={styles.controlGroup}>
              <Text style={styles.fieldLabel}>Jersey #</Text>

              <TextInput
                style={styles.input}
                value={currentJersey}
                onChangeText={(val) => updateJersey(item.id, val)}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.controlGroup}>
              <Text style={styles.fieldLabel}>Position</Text>

              <Pressable
                style={styles.selectorBox}
                onPress={() => openPositionModal(item.id)}
              >
                <Text
                  style={[
                    styles.selectorText,
                    !currentPosition && styles.selectorPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {currentPosition || "Select"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    );
  }

  function renderActionFooter() {
    if (isPlayer) return null;

    return (
      <View style={styles.actionFooter}>
        <Text style={styles.footerCounter}>
          {selected.length} of {maxTotal} Players Selected
        </Text>

        <TouchableOpacity style={styles.saveDraftButton} onPress={saveDraft}>
          <View style={styles.buttonContentRow}>
            <Ionicons
              name="document-text-outline"
              size={22}
              color="#111827"
              style={{ marginRight: 8 }}
            />

            <Text style={styles.saveDraftButtonText}>Save Draft</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitButton} onPress={submitRoster}>
          <View style={styles.buttonContentRow}>
            <Ionicons
              name="cloud-upload-outline"
              size={22}
              color="#ffffff"
              style={{ marginRight: 8 }}
            />

            <Text style={styles.submitButtonText}>Submit All-Stars</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  function renderToast() {
    if (!toastMessage) return null;

    const isError = toastType === "error";
    const isWarning = toastType === "warning";

    return (
      <View pointerEvents="none" style={styles.toastOverlay}>
        <View
          style={[
            styles.saveToast,
            isError && styles.errorToast,
            isWarning && styles.warningToast,
          ]}
        >
          <Ionicons
            name={isError ? "alert-circle" : isWarning ? "warning" : "checkmark-circle"}
            size={52}
            color={isError ? "#c62828" : isWarning ? "#f97316" : "#15803d"}
            style={{ marginBottom: 8 }}
          />

          <Text
            style={[
              styles.saveToastText,
              isError && { color: "#c62828" },
              isWarning && { color: "#f97316" },
            ]}
          >
            {toastMessage}
          </Text>
        </View>
      </View>
    );
  }

    if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.screen}>
          <View
            style={[
              styles.container,
              isTabletLayout && styles.containerTablet,
              isShortScreen && styles.containerShort,
            ]}
          >
            {renderHeader()}
            {renderTeamHeader()}

            <Text style={styles.loadingText}>Loading roster...</Text>

            {showClearConfirm && (
              <View style={styles.confirmOverlay}>
                <View style={styles.confirmCard}>
                  <Ionicons
                    name="trash-outline"
                    size={46}
                    color="#c62828"
                    style={{ marginBottom: 8 }}
                  />

                  <Text style={styles.confirmTitle}>
                    Clear All-Star Selections?
                  </Text>

                  <Text style={styles.confirmMessage}>
                    This will remove every selected player and reset the roster
                    draft.
                  </Text>

                  <View style={styles.confirmButtonRow}>
                    <TouchableOpacity
                      style={styles.cancelConfirmButton}
                      onPress={() => setShowClearConfirm(false)}
                    >
                      <View style={styles.buttonContentRow}>
                        <Ionicons
                          name="close-circle-outline"
                          size={18}
                          color="#ffffff"
                          style={{ marginRight: 6 }}
                        />

                        <Text style={styles.cancelConfirmText}>Cancel</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.clearConfirmButton}
                      onPress={async () => {
                        setShowClearConfirm(false);
                        await clearRoster();
                      }}
                    >
                      <View style={styles.buttonContentRow}>
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color="#ffffff"
                          style={{ marginRight: 6 }}
                        />

                        <Text style={styles.clearConfirmText}>Clear</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {renderToast()}
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <View
          style={[
            styles.container,
            isTabletLayout && styles.containerTablet,
            isShortScreen && styles.containerShort,
          ]}
        >
          {renderHeader()}
          {renderTeamHeader()}

          {!isPlayer && renderProgressBar()}

          <FlatList
            data={players}
            extraData={{ selected, jerseys, positions }}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={[
              styles.listContent,
              isTabletLayout && styles.listContentTablet,
            ]}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No roster players found.</Text>
            }
            renderItem={({ item }) => renderPlayerCard(item)}
            ListFooterComponent={renderActionFooter}
            showsVerticalScrollIndicator={false}
          />
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
        1. Select players from your team roster below who will participate in the{" "}
        <Text style={styles.boldText}>All-Star Game</Text> by clicking the{" "}
        <Text style={styles.boldText}>Select</Text> button next to each All-Star
        player&apos;s name.
      </Text>

<Text style={styles.instructionsText}>
  2. Your division uses{" "}
  <Text style={styles.redBoldText}>
    {managerData?.rules?.maxPositionPlayers ?? ""}
  </Text>{" "}
  <Text style={styles.boldText}>Position Players</Text> and{" "}
  <Text style={styles.redBoldText}>
    {managerData?.rules?.maxPitchers ?? ""}
  </Text>{" "}
  <Text style={styles.boldText}>Pitchers</Text>.
</Text>

      <Text style={styles.instructionsText}>
        3. Use your finger or mouse to{" "}
        <Text style={styles.underlineText}>scroll down</Text> your team&apos;s
        roster to select additional players.
      </Text>

      <Text style={styles.instructionsText}>
        4. Please be sure to verify{" "}
        <Text style={styles.boldText}>Jersey Number</Text> and{" "}
        <Text style={styles.boldText}>Position</Text> for{" "}
        <Text style={styles.underlineText}>each player</Text>.
      </Text>

      <Text style={styles.instructionsText}>
        5. Once completed, scroll down to select{" "}
        <Text style={styles.greenBoldText}>Submit All-Stars</Text>.
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
          <Modal
            visible={positionModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setPositionModalVisible(false);
              setActivePlayerId(null);
            }}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => {
                setPositionModalVisible(false);
                setActivePlayerId(null);
              }}
            >
              <Pressable style={styles.modalCard}>
                <Text style={styles.modalTitle}>Select Position</Text>

                {POSITION_OPTIONS.map((pos) => (
                  <TouchableOpacity
                    key={pos}
                    style={styles.modalOption}
                    onPress={() => choosePosition(pos)}
                  >
                    <Text style={styles.modalOptionText}>{pos}</Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => {
                    setPositionModalVisible(false);
                    setActivePlayerId(null);
                  }}
                >
                  <View style={styles.buttonContentRow}>
                    <Ionicons
                      name="close-circle-outline"
                      size={18}
                      color="#ffffff"
                      style={{ marginRight: 6 }}
                    />

                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </View>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>
        </View>

        {showSubmittedSplash && (
          <View style={styles.submittedSplash}>
            <View style={styles.submittedSplashCard}>
              <Image
                source={require("../assets/All-Star Logo.png")}
                style={styles.submittedSplashLogo}
                resizeMode="contain"
              />

              <Ionicons
                name="checkmark-circle"
                size={42}
                color="#15803d"
                style={{ marginBottom: 8 }}
              />

              <Text style={styles.submittedSplashText}>All-Stars Submitted</Text>

              <Text style={styles.submittedSplashSubText}>
                Roster saved successfully.
              </Text>
            </View>
          </View>
        )}

        {showClearConfirm && (
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <Ionicons
                name="trash-outline"
                size={46}
                color="#c62828"
                style={{ marginBottom: 8 }}
              />

              <Text style={styles.confirmTitle}>Clear All-Star Selections?</Text>

              <Text style={styles.confirmMessage}>
                This will remove every selected player and reset the roster draft.
              </Text>

              <View style={styles.confirmButtonRow}>
                <TouchableOpacity
                  style={styles.cancelConfirmButton}
                  onPress={() => setShowClearConfirm(false)}
                >
                  <View style={styles.buttonContentRow}>
                    <Ionicons
                      name="close-circle-outline"
                      size={18}
                      color="#ffffff"
                      style={{ marginRight: 6 }}
                    />

                    <Text style={styles.cancelConfirmText}>Cancel</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.clearConfirmButton}
                  onPress={async () => {
                    setShowClearConfirm(false);
                    await clearRoster();
                  }}
                >
                  <View style={styles.buttonContentRow}>
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color="#ffffff"
                      style={{ marginRight: 6 }}
                    />

                    <Text style={styles.clearConfirmText}>Clear</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {renderToast()}
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
    flex: 1,
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
    marginBottom: 10,
  },

  topButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },

  topButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },

  clearTopButton: {
    backgroundColor: "#6b7280",
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },

  clearTopButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },

  teamHeaderCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },

  teamHeaderCardTablet: {
    paddingVertical: 18,
    marginBottom: 16,
  },

  teamHeaderCardShort: {
    paddingVertical: 10,
  },

  teamLogo: {
    width: 170,
    height: 110,
    alignSelf: "center",
    marginBottom: 4,
  },

  teamLogoTablet: {
    width: 200,
    height: 130,
  },

  teamLogoShort: {
    width: 145,
    height: 95,
  },

  teamName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginTop: 2,
  },

  divisionName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6b7280",
    textAlign: "center",
    marginTop: 2,
  },

  title: {
    fontSize: 21,
    fontWeight: "900",
    marginTop: 8,
    color: "#111827",
    textAlign: "center",
  },

  subtitle: {
    marginTop: 4,
    color: "#4b5563",
    textAlign: "center",
    fontWeight: "700",
  },

  loadingText: {
    marginTop: 20,
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },

  progressCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 5,
  },

  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  progressTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1f4e9e",
  },

  progressCount: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1d4ed8",
  },

  progressTrack: {
    height: 12,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  progressSubText: {
    marginTop: 8,
    color: "#4b5563",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  progressCompleteText: {
    color: "#15803d",
  },

  listContent: {
    paddingBottom: 20,
  },

  listContentTablet: {
    paddingBottom: 30,
  },

  playerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
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

  selectedPlayerCard: {
    backgroundColor: "#ecfdf3",
    borderWidth: 2,
    borderColor: "#15803d",
  },

  playerTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  playerMainInfo: {
    flex: 1,
    minWidth: 0,
  },

  playerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },

  playerNameText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
    flexShrink: 1,
    marginRight: 8,
  },

  jerseyBadge: {
    backgroundColor: "#1f4e9e",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },

  playerMetaText: {
    marginTop: 5,
    color: "#4b5563",
    fontSize: 13,
    fontWeight: "700",
  },

  selectedControls: {
    flexDirection: "row",
    marginTop: 12,
    gap: 12,
    flexWrap: "wrap",
  },

  controlGroup: {
    flexDirection: "column",
  },

  fieldLabel: {
    fontWeight: "900",
    fontSize: 13,
    color: "#1d4ed8",
    marginBottom: 5,
  },

  input: {
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 9,
    backgroundColor: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    color: "#111827",
  },

  selectorBox: {
    minWidth: 82,
    height: FIELD_HEIGHT,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 9,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  selectorText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },

  selectorPlaceholder: {
    color: "#6b7280",
  },

  selectButton: {
    backgroundColor: "#1d4ed8",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: "center",
    marginLeft: 10,
  },

  removeButton: {
    backgroundColor: "#c62828",
  },

  selectButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
  },

  actionFooter: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    marginTop: 6,
    marginBottom: 22,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 5,
  },

  footerCounter: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },

  saveDraftButton: {
    backgroundColor: "#facc15",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },

  saveDraftButtonText: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 16,
  },

  submitButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  submitButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
  },

  emptyText: {
    textAlign: "center",
    color: "#6b7280",
    fontWeight: "800",
    marginTop: 20,
  },

  selectedImage: {
    width: 70,
    height: 70,
    marginLeft: 10,
  },

modalOverlay: {
  ...modalStyles.overlay,
},

modalCard: {
  ...modalStyles.compactCard,
},

  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center",
    color: "#1f4e9e",
  },

  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },

  modalOptionText: {
    fontSize: 16,
    textAlign: "center",
    color: "#111827",
    fontWeight: "800",
  },

  modalCancel: {
    marginTop: 14,
    backgroundColor: "#c62828",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },

  modalCancelText: {
    color: "#ffffff",
    fontWeight: "900",
  },

submittedSplash: {
  ...modalStyles.overlay,
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 9999,
},

submittedSplashCard: {
  ...modalStyles.card,
  alignItems: "center",
},

  submittedSplashLogo: {
    width: 190,
    height: 190,
    marginBottom: 8,
  },

  submittedSplashText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
  },

  submittedSplashSubText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#4b5563",
    textAlign: "center",
    marginTop: 6,
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

  errorToast: {
    borderWidth: 3,
    borderColor: "#c62828",
  },

  warningToast: {
    borderWidth: 3,
    borderColor: "#f97316",
  },

  saveToastText: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    color: "#15803d",
  },

confirmOverlay: {
  ...modalStyles.overlay,
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 99998,
},

confirmCard: {
  ...modalStyles.card,
  alignItems: "center",
},

  confirmTitle: {
    color: "#1f4e9e",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },

  confirmMessage: {
    color: "#4b5563",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },

  confirmButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },

  cancelConfirmButton: {
    flex: 1,
    backgroundColor: "#c62828",
    borderRadius: 10,
    paddingVertical: 12,
    marginRight: 8,
    alignItems: "center",
  },

  clearConfirmButton: {
    flex: 1,
    backgroundColor: "#6b7280",
    borderRadius: 10,
    paddingVertical: 12,
    marginLeft: 8,
    alignItems: "center",
  },

  cancelConfirmText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  clearConfirmText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
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

redBoldText: {
  fontWeight: "900",
  color: "#c62828",
},

greenBoldText: {
  fontWeight: "900",
  color: "#15803d",
},

underlineText: {
  textDecorationLine: "underline",
  fontWeight: "900",
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
