import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { API_BASE } from "../utils/appconfig";
import { modalStyles } from "../utils/modalStyles";

type Squad = "East" | "West";

type Player = {
  id: string;
  poolPlayerId?: string;
  sourceDivisionId?: string;
  sourceDivisionName?: string;
  name: string;
  jerseyNumber: string;
  position: string;
  teamName: string;
  squad: Squad;
};

const POSITION_OPTIONS = [
  "P",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
  "IF",
  "OF",
  "DH",
];

export default function LineupBuilderScreen() {
  const params = useLocalSearchParams();

  const displayName = String(params.displayName || "All-Star Manager");
  const squad = String(params.squad || "East") as Squad;

  let divisionIds: string[] = ["masters"];

  try {
    divisionIds = params.divisionIds
      ? JSON.parse(String(params.divisionIds))
      : ["masters"];
  } catch {
    divisionIds = ["masters"];
  }

  const primaryDivisionId = divisionIds[0] || "masters";
  const opponentSquad: Squad = squad === "East" ? "West" : "East";
  const [showUnsavedExitModal, setShowUnsavedExitModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [divisionName, setDivisionName] = useState("");
  const [eastPlayers, setEastPlayers] = useState<Player[]>([]);
  const [westPlayers, setWestPlayers] = useState<Player[]>([]);
  const [battingPlayers, setBattingPlayers] = useState<Record<string, boolean>>(
    {}
  );
  const [battingOrderIds, setBattingOrderIds] = useState<string[]>([]);

  const [activeTab, setActiveTab] = useState<"manager" | "opponent">("manager");
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showEditPositionPicker, setShowEditPositionPicker] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [subTargetPlayer, setSubTargetPlayer] = useState<Player | null>(null);

  const [opponentBattingLineup, setOpponentBattingLineup] = useState<Player[]>(
    []
  );
  const [opponentSubs, setOpponentSubs] = useState<Player[]>([]);

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [showSaveToast, setShowSaveToast] = useState(false);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { width, height } = useWindowDimensions();
  const isTabletLayout = width >= 700;
  const isShortScreen = height < 760;

  const managerPlayers = squad === "East" ? eastPlayers : westPlayers;

  const battingLineup = battingOrderIds
    .map((id) => managerPlayers.find((player) => player.id === id))
    .filter(
      (player): player is Player =>
        !!player && (battingPlayers[player.id] ?? true)
    );

  const battingLineupIds = new Set(battingLineup.map((player) => player.id));

  const notBattingPlayers = managerPlayers.filter(
    (player) =>
      !(battingPlayers[player.id] ?? true) && !battingLineupIds.has(player.id)
  );

useEffect(() => {
  if (Platform.OS === "web") return;

  const subscription = BackHandler.addEventListener(
    "hardwareBackPress",
    () => {
      if (activeTab === "manager" && hasUnsavedChanges) {
        setShowUnsavedExitModal(true);
      }

      return true;
    }
  );

  return () => subscription.remove();
}, [activeTab, hasUnsavedChanges]);

useEffect(() => {
  if (Platform.OS !== "web" || typeof window === "undefined") return;

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!hasUnsavedChanges) return;

    event.preventDefault();
    event.returnValue = "";
  };

  window.addEventListener("beforeunload", handleBeforeUnload);

  return () => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  };
}, [hasUnsavedChanges]);

  useEffect(() => {
    loadAllStars();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadOpponentSavedLineup();
    }, 3000);

    return () => clearInterval(interval);
  }, [primaryDivisionId, opponentSquad]);

  useEffect(() => {
    if (!autoSaveEnabled || !hasUnsavedChanges) return;

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = setTimeout(() => {
      saveLineup(true);
    }, 10000);

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [
    autoSaveEnabled,
    hasUnsavedChanges,
    battingOrderIds,
    battingPlayers,
    eastPlayers,
    westPlayers,
  ]);

  async function loadAllStars() {
    try {
      const response = await fetch(
        `${API_BASE}/api/lineups/divisions/${primaryDivisionId}/allstars`
      );

      const json = await response.json();

      if (json?.ok) {
        const loadedEastPlayers = json.eastPlayers || [];
        const loadedWestPlayers = json.westPlayers || [];

        setDivisionName(json.divisionName || "");
        setEastPlayers(loadedEastPlayers);
        setWestPlayers(loadedWestPlayers);

        const loadedManagerPlayers =
          squad === "East" ? loadedEastPlayers : loadedWestPlayers;

        await loadSavedLineup(primaryDivisionId, squad, loadedManagerPlayers);
        await loadOpponentSavedLineup();
      }
    } catch (e) {
      console.log("LINEUP LOAD ERROR:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadSavedLineup(
    divisionId: string,
    managerSquad: Squad,
    fallbackPlayers: Player[]
  ) {
    try {
      const response = await fetch(
        `${API_BASE}/api/lineups/${divisionId}/${managerSquad}`
      );

      const json = await response.json();

      if (
        !json?.ok ||
        !json.lineup ||
        !Array.isArray(json.lineup.players) ||
        json.lineup.players.length === 0
      ) {
        applyFallbackLineup(managerSquad, fallbackPlayers);
        return;
      }

      const savedPlayers: Player[] = json.lineup.players.map((player: any) => ({
        id: player.id,
        name: player.name,
        jerseyNumber: player.jerseyNumber,
        position: player.position,
        teamName: player.teamName,
        squad: player.squad,
      }));

      const savedBattingState: Record<string, boolean> = {};

      json.lineup.players.forEach((player: any) => {
        savedBattingState[player.id] = !!player.batting;
      });

      if (managerSquad === "East") {
        setEastPlayers(savedPlayers);
      } else {
        setWestPlayers(savedPlayers);
      }

      setBattingPlayers(savedBattingState);

      setBattingOrderIds(
        json.lineup.players
          .filter((player: any) => player.batting)
          .sort((a: any, b: any) => a.battingOrder - b.battingOrder)
          .map((player: any) => player.id)
      );
    } catch (e) {
      console.log("LOAD SAVED LINEUP ERROR:", e);
      applyFallbackLineup(managerSquad, fallbackPlayers);
    }
  }

  function applyFallbackLineup(managerSquad: Squad, fallbackPlayers: Player[]) {
    if (managerSquad === "East") {
      setEastPlayers(fallbackPlayers);
    } else {
      setWestPlayers(fallbackPlayers);
    }

    const defaultBattingState: Record<string, boolean> = {};

    fallbackPlayers.forEach((player) => {
      defaultBattingState[player.id] = true;
    });

    setBattingPlayers(defaultBattingState);
    setBattingOrderIds(fallbackPlayers.map((player) => player.id));
  }

  async function loadOpponentSavedLineup() {
    try {
      const response = await fetch(
        `${API_BASE}/api/lineups/${primaryDivisionId}/${opponentSquad}`
      );

      const json = await response.json();

      if (!json?.ok || !json.lineup?.players) {
        setOpponentBattingLineup([]);
        setOpponentSubs([]);
        return;
      }

      const battingPlayers = json.lineup.players
        .filter((player: any) => player.batting)
        .sort((a: any, b: any) => a.battingOrder - b.battingOrder);

      const subs = json.lineup.players.filter((player: any) => !player.batting);

      setOpponentBattingLineup(battingPlayers);
      setOpponentSubs(subs);
    } catch (e) {
      console.log("OPPONENT LINEUP ERROR:", e);
    }
  }

  function markLineupChanged() {
    setHasUnsavedChanges(true);
    setSaveStatus("Unsaved changes");
  }

function toggleBatting(playerId: string, value: boolean) {
  setBattingPlayers((prev) => ({
    ...prev,
    [playerId]: value,
  }));

  setSaveStatus("Updating lineup...");

  setTimeout(() => {
    setBattingOrderIds((current) => {
      if (value) {
        if (current.includes(playerId)) return current;
        return [...current, playerId];
      }

      return current.filter((id) => id !== playerId);
    });

    markLineupChanged();
  }, 650);
}

function renderPlayer(
  player: Player,
  editable: boolean,
  battingOrder?: number,
  drag?: () => void,
  isActive?: boolean
) {
    const isBatting = battingPlayers[player.id] ?? true;

const cardContent = (
  <View
    key={`${player.id}-${battingOrder || "sub"}`}
    style={[
      styles.playerCard,
      editable
        ? isBatting
          ? styles.editablePlayerCard
          : styles.notBattingPlayerCard
        : styles.viewOnlyPlayerCard,
      isTabletLayout && styles.playerCardTablet,
      isActive && styles.activeDragPlayerCard,
    ]}
  >
        <View style={styles.playerHeaderRow}>
          <View style={styles.playerInfo}>
            <View style={styles.playerNameRow}>
              {battingOrder ? (
                <View style={styles.battingOrderBadge}>
                  <Text style={styles.battingOrderText}>{battingOrder}</Text>
                </View>
              ) : null}

              <Text style={styles.playerName} numberOfLines={2}>
                #{player.jerseyNumber} {player.name}
              </Text>
            </View>

            <Text style={styles.playerMeta}>
              {player.position || "POS"} | {player.teamName}{player.sourceDivisionName ? ` | ${player.sourceDivisionName}` : ""}
            </Text>
          </View>

          {editable && (
            <View style={styles.headerButtons}>
              <Pressable
                style={styles.actionButton}
                onPress={() => setEditingPlayer(player)}
              >
                <View style={styles.buttonContentRow}>
                  <Ionicons
                    name="create-outline"
                    size={15}
                    color="#ffffff"
                    style={{ marginRight: 4 }}
                  />

                  <Text style={styles.actionButtonText}>Edit</Text>
                </View>
              </Pressable>

              {battingOrder && (
                <Pressable
                  style={styles.subButton}
                  onPress={() => setSubTargetPlayer(player)}
                >
                  <View style={styles.buttonContentRow}>
                    <Ionicons
                      name="swap-horizontal"
                      size={15}
                      color="#ffffff"
                      style={{ marginRight: 4 }}
                    />

                    <Text style={styles.actionButtonText}>Sub</Text>
                  </View>
                </Pressable>
              )}
            </View>
          )}
        </View>

        <View style={styles.playerBottomRow}>
          {editable ? (
            <>
              <View style={styles.battingRow}>
                <Text
                  style={[
                    styles.battingLabel,
                    !isBatting && styles.notBattingLabel,
                  ]}
                >
                  {isBatting ? "Batting" : "Not Batting"}
                </Text>

<Switch
  value={isBatting}
  onValueChange={(value) => toggleBatting(player.id, value)}
  disabled={saveStatus === "Updating lineup..."}
/>
              </View>

              {battingOrder && drag ? (
                <Pressable
                  onLongPress={drag}
                  delayLongPress={140}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.dragHandle,
                    styles.dragHandleBatting,
                    pressed && styles.dragHandlePressed,
                  ]}
                >
                  <Ionicons
                    name="reorder-three-outline"
                    size={25}
                    color="#1f4e9e"
                  />
                  <Text style={styles.dragHandleText}>Hold & Drag</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <View style={styles.viewOnlyBadge}>
              <Text style={styles.viewOnlyText}>View Only</Text>
            </View>
          )}
        </View>
</View>
);

if (drag) {
  return <ScaleDecorator>{cardContent}</ScaleDecorator>;
}

return cardContent;
  }

  function savePlayerEdits() {
    if (!editingPlayer) return;

    if (editingPlayer.squad === "East") {
      setEastPlayers((current) =>
        current.map((player) =>
          player.id === editingPlayer.id ? editingPlayer : player
        )
      );
    }

    if (editingPlayer.squad === "West") {
      setWestPlayers((current) =>
        current.map((player) =>
          player.id === editingPlayer.id ? editingPlayer : player
        )
      );
    }

    markLineupChanged();
    setEditingPlayer(null);
  }

  function performSubstitution(subPlayer: Player) {
    if (!subTargetPlayer) return;

    setBattingPlayers((current) => ({
      ...current,
      [subTargetPlayer.id]: false,
      [subPlayer.id]: true,
    }));

    setBattingOrderIds((current) =>
      current.map((id) => (id === subTargetPlayer.id ? subPlayer.id : id))
    );

    markLineupChanged();
    setSubTargetPlayer(null);
  }

  function requestLeaveScreen() {
  if (activeTab === "manager" && hasUnsavedChanges) {
    setShowUnsavedExitModal(true);
    return;
  }

  router.replace("/dashboard");
}

async function saveAndLeaveScreen() {
  const saved = await saveLineup(false);

  if (saved) {
    setShowUnsavedExitModal(false);
    router.replace("/dashboard");
  }
}

function leaveWithoutSaving() {
  if (autoSaveTimer.current) {
    clearTimeout(autoSaveTimer.current);
  }

  setHasUnsavedChanges(false);
  setShowUnsavedExitModal(false);
  router.replace("/dashboard");
}

  function renderTopControls() {
    return (
      <View style={styles.headerRow}>
        <Pressable
          onPress={requestLeaveScreen}
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
        </Pressable>

        <Pressable
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
        </Pressable>
      </View>
    );
  }

  const viewedSquad = activeTab === "manager" ? squad : opponentSquad;
  const viewedManagerName =
  activeTab === "manager" ? displayName : `${opponentSquad} Manager`;
  const isViewingOwnLineup = activeTab === "manager";

  function renderHeroCard() {
    return (
      <View
        style={[
          styles.heroCard,
          isTabletLayout && styles.heroCardTablet,
          isShortScreen && styles.heroCardShort,
        ]}
      >
        <Image
          source={require("../assets/Masters.png")}
          style={[
            styles.logo,
            isTabletLayout && styles.logoTablet,
            isShortScreen && styles.logoShort,
          ]}
          resizeMode="contain"
        />

        <Text style={styles.title}>All-Star Lineup Builder</Text>

        <Text style={styles.gameHeaderText}>{divisionName}</Text>

<Text
  style={[
    styles.squadHeaderText,
    viewedSquad === "East" ? styles.eastSquadText : styles.westSquadText,
  ]}
>
  {viewedSquad.toUpperCase()} ALL-STARS
</Text>

<Text style={styles.managerName}>Manager: {viewedManagerName}</Text>

<View
  style={[
    styles.lineupModeBadge,
    isViewingOwnLineup ? styles.editableBadge : styles.viewOnlyModeBadge,
  ]}
>
  <Ionicons
    name={isViewingOwnLineup ? "create-outline" : "eye-outline"}
    size={14}
    color="#ffffff"
    style={{ marginRight: 5 }}
  />

  <Text style={styles.lineupModeBadgeText}>
    {isViewingOwnLineup ? "Editable" : "View Only"}
  </Text>
</View>
      </View>
    );
  }

  function renderSavePanel() {
    if (activeTab !== "manager") return null;

    return (
      <View style={styles.savePanel}>
        <Pressable style={styles.saveLineupButton} onPress={() => saveLineup(false)}>
          <View style={styles.buttonContentRow}>
            <Ionicons
              name="clipboard-outline"
              size={22}
              color="#ffffff"
              style={{ marginRight: 8 }}
            />

            <Text style={styles.saveLineupButtonText}>Save Lineup</Text>
          </View>
        </Pressable>

        <View style={styles.saveMetaArea}>
          {autoSaveEnabled && (
            <View style={styles.autoSaveRow}>
              <Ionicons
                name="radio-button-on"
                size={14}
                color="#15803d"
                style={{ marginRight: 6 }}
              />

              <Text style={styles.autoSaveText}>Auto Save Enabled</Text>
            </View>
          )}

          {!!saveStatus && (
            <View style={styles.saveStatusRow}>
              <Ionicons
                name="time-outline"
                size={15}
                color="#6b7280"
                style={{ marginRight: 6 }}
              />

              <Text style={styles.saveStatusText}>{saveStatus}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  function renderTabs() {
    return (
      <View style={styles.tabRow}>
        <Pressable
          style={[
            styles.tabButton,
            activeTab === "manager" &&
              (squad === "East" ? styles.eastTabButton : styles.westTabButton),
          ]}
          onPress={() => setActiveTab("manager")}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "manager" && styles.activeTabButtonText,
            ]}
          >
            {squad} All-Stars
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabButton,
            activeTab === "opponent" &&
              (opponentSquad === "East"
                ? styles.eastTabButton
                : styles.westTabButton),
          ]}
          onPress={() => setActiveTab("opponent")}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "opponent" && styles.activeTabButtonText,
            ]}
          >
            {opponentSquad} All-Stars
          </Text>
        </Pressable>
      </View>
    );
  }

  function renderManagerLineup() {
    return (
      <View style={styles.section}>
        <Text style={styles.lineupSectionTitle}>
          Batting Lineup ({battingLineup.length})
        </Text>

        <View style={styles.dragInstructionRow}>
          <Ionicons
            name="hand-left-outline"
            size={17}
            color="#1f4e9e"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.dragInstructionText}>
            Scroll normally anywhere on the card. Hold the drag handle to reorder.
          </Text>
        </View>

        {battingLineup.length > 0 ? (
          <DraggableFlatList
            data={battingLineup}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            activationDistance={12}
            autoscrollThreshold={80}
            autoscrollSpeed={90}
            dragItemOverflow
            onDragEnd={({ data }) => {
              setBattingOrderIds(data.map((player) => player.id));
              markLineupChanged();
            }}
renderItem={({ item, getIndex, drag, isActive }) => {
  const index = getIndex() ?? 0;

  return renderPlayer(item, true, index + 1, drag, isActive);
}}
          />
        ) : (
          <Text style={styles.emptyText}>No Batting Players Selected.</Text>
        )}

        <Text style={styles.lineupSectionTitle}>
          Substitutes ({notBattingPlayers.length})
        </Text>

        {notBattingPlayers.length > 0 ? (
          notBattingPlayers.map((player) => renderPlayer(player, true))
        ) : (
          <Text style={styles.emptyText}>No Players Marked as Not Batting.</Text>
        )}
      </View>
    );
  }

  function renderOpponentLineup() {
    return (
      <View style={styles.section}>
        <Text style={styles.lineupSectionTitle}>
          Batting Lineup ({opponentBattingLineup.length})
        </Text>

        {opponentBattingLineup.length > 0 ? (
          opponentBattingLineup.map((player, index) =>
            renderPlayer(player, false, index + 1)
          )
        ) : (
          <Text style={styles.emptyText}>⏳ Awaiting Lineup Submission...</Text>
        )}

        <Text style={styles.lineupSectionTitle}>
          Substitutes ({opponentSubs.length})
        </Text>

        {opponentSubs.length > 0 ? (
          opponentSubs.map((player) => renderPlayer(player, false))
        ) : (
          <Text style={styles.emptyText}>No Substitutes Listed.</Text>
        )}
      </View>
    );
  }

    async function saveLineup(isAutoSave = false): Promise<boolean> {
    try {
      const battingLineupPlayers = battingLineup.map((player, index) => ({
        ...player,
        batting: true,
        battingOrder: index + 1,
      }));

      const substitutePlayers = notBattingPlayers.map((player) => ({
        ...player,
        batting: false,
        battingOrder: null,
      }));

      const response = await fetch(`${API_BASE}/api/lineups/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          divisionId: primaryDivisionId,
          squad,
          players: [...battingLineupPlayers, ...substitutePlayers],
        }),
      });

      const json = await response.json();

if (!json?.ok) {
  if (!isAutoSave) alert("Lineup Could Not Be Saved.");
  setSaveStatus("Auto-Save Failed");
  return false;
}

      setAutoSaveEnabled(true);
      setHasUnsavedChanges(false);
      setSaveStatus(`Last saved: ${new Date().toLocaleTimeString()}`);

      if (!isAutoSave) {
        setShowSaveToast(true);

        setTimeout(() => {
          setShowSaveToast(false);
        }, 1700);
      }

      return true;
} catch (e) {
  console.log("SAVE LINEUP ERROR:", e);

  if (!isAutoSave) alert("Lineup Could Not Be Saved.");

  setSaveStatus("Auto-Save Failed");
  return false;
}

    }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <GestureHandlerRootView style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            isTabletLayout && styles.containerTablet,
            isShortScreen && styles.containerShort,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          directionalLockEnabled
          stickyHeaderIndices={activeTab === "manager" ? [2] : []}
        >
          {renderTopControls()}

          {renderHeroCard()}

          <View style={styles.floatingSaveWrapper}>
            {!loading && activeTab === "manager" ? renderSavePanel() : null}
          </View>

          <View style={styles.mainCard}>
            {loading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color="#1d4ed8" />
                <Text style={styles.loadingText}>Loading Lineup...</Text>
              </View>
            ) : (
              <>
                {renderTabs()}

                {activeTab === "manager"
                  ? renderManagerLineup()
                  : renderOpponentLineup()}
              </>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              NTABL All-Star App • Version 1.0
            </Text>
          </View>
        </ScrollView>
      </GestureHandlerRootView>

      <Modal
        visible={!!editingPlayer}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingPlayer(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Player</Text>

            <Text style={styles.modalLabel}>Jersey Number</Text>

            <TextInput
              style={[styles.modalInput, styles.modalInputNumber]}
              value={editingPlayer?.jerseyNumber || ""}
              keyboardType="numeric"
              onChangeText={(value) =>
                setEditingPlayer((current) =>
                  current ? { ...current, jerseyNumber: value } : current
                )
              }
            />

            <Text style={styles.modalLabel}>Position</Text>

            <Pressable
              style={styles.modalInput}
              onPress={() => setShowEditPositionPicker(true)}
            >
              <Text style={styles.modalInputText}>
                {editingPlayer?.position || "Select Position"}
              </Text>
            </Pressable>

            <Pressable style={styles.saveEditButton} onPress={savePlayerEdits}>
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="save-outline"
                  size={18}
                  color="#ffffff"
                  style={{ marginRight: 6 }}
                />

                <Text style={styles.saveEditButtonText}>Save</Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.cancelEditButton}
              onPress={() => setEditingPlayer(null)}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="close-circle-outline"
                  size={18}
                  color="#ffffff"
                  style={{ marginRight: 5 }}
                />

                <Text style={styles.cancelEditButtonText}>Cancel</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditPositionPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditPositionPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.positionPickerCard}>
            <Text style={styles.modalTitle}>Select Position</Text>

            {POSITION_OPTIONS.map((pos) => (
              <Pressable
                key={pos}
                style={styles.positionOption}
                onPress={() => {
                  setEditingPlayer((current) =>
                    current ? { ...current, position: pos } : current
                  );
                  setShowEditPositionPicker(false);
                }}
              >
                <Text style={styles.positionOptionText}>{pos}</Text>
              </Pressable>
            ))}

            <Pressable
              style={styles.cancelEditButton}
              onPress={() => setShowEditPositionPicker(false)}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="close-circle-outline"
                  size={18}
                  color="#ffffff"
                  style={{ marginRight: 5 }}
                />

                <Text style={styles.cancelEditButtonText}>Cancel</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showInstructions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInstructions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.instructionsModalCard}>
<Image
  source={require("../assets/NTABL-Logo.png")}
  style={styles.instructionsLogo}
  resizeMode="contain"
/>

<Text style={styles.modalTitle}>Instructions</Text>

            <Text style={styles.instructionsText}>
              1. Tap <Text style={styles.boldText}>Edit</Text> to update player
              number or position.
            </Text>

            <Text style={styles.instructionsText}>
              2. Use the <Text style={styles.boldText}>Batting</Text> toggle to
              move players between the active batting lineup and non-lineup substitutes.
            </Text>

<Text style={styles.instructionsText}>
  3. Scroll the screen normally by swiping anywhere on a player card. To change
  batting order, press and hold the{" "}
  <Ionicons
    name="reorder-three-outline"
    size={18}
    color="#1f4e9e"
  />{" "}
  <Text style={styles.boldText}>Hold & Drag</Text> handle.
</Text>

            <Text style={styles.instructionsText}>
              4. Use the <Text style={styles.boldText}>Sub</Text> button to swap a batting
              player with a substitute.
            </Text>

            <Text style={styles.instructionsText}>
              5. Tap <Text style={styles.greenBoldText}>Save Lineup</Text>.
              Lineup Changes Auto-Save After 10 Seconds of Inactivity.
            </Text>

            <Pressable
              style={styles.gotItButton}
              onPress={() => setShowInstructions(false)}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={22}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.gotItButtonText}>Got It</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!subTargetPlayer}
        transparent
        animationType="fade"
        onRequestClose={() => setSubTargetPlayer(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.subModalCard}>
            <Text style={styles.modalTitle}>Select Substitute</Text>

            <Text style={styles.subModalSubtitle}>
              Replacing: {subTargetPlayer?.name}
            </Text>

            {notBattingPlayers.length > 0 ? (
              notBattingPlayers.map((player) => (
                <Pressable
                  key={player.id}
                  style={styles.subOption}
                  onPress={() => performSubstitution(player)}
                >
                  <Text style={styles.subOptionText}>
                    #{player.jerseyNumber} {player.name}
                  </Text>

                  <Text style={styles.subOptionMeta}>
                    {player.position || "POS"} | {player.teamName}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyText}>No Substitutes Currently Available.</Text>
            )}

            <Pressable
              style={styles.cancelEditButton}
              onPress={() => setSubTargetPlayer(null)}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="close-circle-outline"
                  size={18}
                  color="#ffffff"
                  style={{ marginRight: 5 }}
                />

                <Text style={styles.cancelEditButtonText}>Cancel</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
<Modal
  visible={showUnsavedExitModal}
  transparent
  animationType="fade"
  onRequestClose={() => setShowUnsavedExitModal(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>Unsaved Changes</Text>

      <Text style={styles.instructionsText}>
        You have lineup changes that have not been saved yet. What would you like to do?
      </Text>

      <Pressable style={styles.saveEditButton} onPress={saveAndLeaveScreen}>
        <View style={styles.buttonContentRow}>
          <Ionicons name="save-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.saveEditButtonText}>Save Changes</Text>
        </View>
      </Pressable>

      <Pressable style={styles.leaveWithoutSavingButton} onPress={leaveWithoutSaving}>
        <Text style={styles.leaveWithoutSavingButtonText}>Continue Without Saving</Text>
      </Pressable>

      <Pressable
        style={styles.cancelEditButton}
        onPress={() => setShowUnsavedExitModal(false)}
      >
        <Text style={styles.cancelEditButtonText}>Cancel</Text>
      </Pressable>
    </View>
  </View>
</Modal>
      {showSaveToast && (
        <View pointerEvents="none" style={styles.toastOverlay}>
          <View style={styles.saveToast}>
            <Image
              source={
                squad === "East"
                  ? require("../assets/East.png")
                  : require("../assets/West.png")
              }
              style={styles.saveToastLogo}
              resizeMode="contain"
            />

            <Text style={styles.saveToastTitle}>Lineup Saved!</Text>

            <Text style={styles.saveToastMessage}>{divisionName}</Text>

            <Text style={styles.saveToastSubMessage}>
              {squad} All-Star Manager
            </Text>

            <Ionicons
              name="checkmark-circle"
              size={38}
              color="#15803d"
              style={{ marginTop: 10 }}
            />
          </View>
        </View>
      )}
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
    fontWeight: "800",
    fontSize: 14,
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

  smallButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  heroCardTablet: {
    paddingVertical: 20,
  },

  heroCardShort: {
    paddingVertical: 12,
  },

  logo: {
    width: 180,
    height: 120,
    alignSelf: "center",
    marginBottom: 4,
  },

  logoTablet: {
    width: 210,
    height: 135,
  },

  logoShort: {
    width: 150,
    height: 100,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 4,
  },

  gameHeaderText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#4b5563",
    textAlign: "center",
    marginBottom: 4,
  },

  squadHeaderText: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
  },

  eastSquadText: {
    color: "#c62828",
  },

  westSquadText: {
    color: "#1565c0",
  },

  managerName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },

  mainCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  loadingCard: {
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
  },

  tabRow: {
    flexDirection: "row",
    backgroundColor: "#e5e7eb",
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },

  tabButton: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 12,
  },

  tabButtonText: {
    color: "#4b5563",
    fontWeight: "900",
    fontSize: 14,
  },

  eastTabButton: {
    backgroundColor: "#c62828",
  },

  westTabButton: {
    backgroundColor: "#1565c0",
  },

  activeTabButtonText: {
    color: "#ffffff",
  },

  floatingSaveWrapper: {
    backgroundColor: "#eef2f7",
    paddingTop: 2,
    paddingBottom: 8,
    zIndex: 50,
    elevation: 10,
  },

  savePanel: {
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    padding: 12,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },

  saveLineupButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  saveLineupButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  saveMetaArea: {
    marginTop: 8,
  },

  autoSaveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  autoSaveText: {
    color: "#15803d",
    fontSize: 13,
    fontWeight: "900",
  },

  saveStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  saveStatusText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  section: {
    marginBottom: 18,
  },

  lineupSectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1f4e9e",
    marginTop: 8,
    marginBottom: 10,
  },

  dragInstructionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 12,
  },

  dragInstructionText: {
    flex: 1,
    color: "#374151",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },

  emptyText: {
    color: "#6b7280",
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },

  playerCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },

  playerCardTablet: {
    paddingVertical: 16,
    paddingHorizontal: 18,
  },

  activeDragPlayerCard: {
    opacity: 0.9,
    borderColor: "#1d4ed8",
    borderWidth: 2,
    transform: [{ scale: 1.01 }],
    elevation: 12,
  },

  editablePlayerCard: {
    backgroundColor: "#ecfdf5",
    borderColor: "#15803d",
  },

  notBattingPlayerCard: {
    backgroundColor: "#f3f4f6",
    borderColor: "#9ca3af",
  },

  viewOnlyPlayerCard: {
    backgroundColor: "#f9fafb",
    borderColor: "#d1d5db",
    opacity: 0.9,
  },

  playerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  playerInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },

  playerNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  battingOrderBadge: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "#1f4e9e",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  battingOrderText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  playerName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
    flex: 1,
  },

  playerMeta: {
    fontSize: 14,
    fontWeight: "800",
    color: "#4b5563",
    marginTop: 5,
  },

  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  actionButton: {
    backgroundColor: "#1d4ed8",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },

  subButton: {
    backgroundColor: "#c62828",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },

  actionButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },

  playerBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },

  battingRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  battingLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: "#15803d",
    marginRight: 8,
  },

  notBattingLabel: {
    color: "#6b7280",
  },

  dragHandle: {
    minWidth: 92,
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  dragHandleBatting: {
    backgroundColor: "#eff6ff",
    borderColor: "#1d4ed8",
  },

  dragHandleSubstitute: {
    backgroundColor: "#f3f4f6",
    borderColor: "#9ca3af",
  },

  dragHandlePressed: {
    backgroundColor: "#dbeafe",
    transform: [{ scale: 0.98 }],
  },

  dragHandleText: {
    color: "#1f4e9e",
    fontSize: 11,
    fontWeight: "900",
    marginLeft: 4,
  },

  viewOnlyBadge: {
    backgroundColor: "#e5e7eb",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },

  viewOnlyText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#6b7280",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

modalCard: {
  backgroundColor: "#ffffff",
  borderRadius: 20,
  padding: 20,
  width: "88%",
  maxWidth: 900,
},

positionPickerCard: {
  ...modalStyles.compactCard,
},

  instructionsModalCard: {
  ...modalStyles.compactCard,
},

subModalCard: {
  backgroundColor: "#ffffff",
  borderRadius: 20,
  padding: 20,
  width: "88%",
  maxWidth: 900,
},

  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 14,
  },

  modalLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 6,
  },

  modalInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: "#ffffff",
  },

  modalInputText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "900",
  },

  modalInputNumber: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },

  saveEditButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },

  saveEditButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  cancelEditButton: {
    backgroundColor: "#c62828",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 10,
  },

  cancelEditButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  positionOption: {
    paddingVertical: 11,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },

  positionOptionText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },

  instructionsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
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

  greenBoldText: {
    fontWeight: "900",
    color: "#15803d",
  },

  gotItButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },

  gotItButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  subModalSubtitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#374151",
    textAlign: "center",
    marginBottom: 12,
  },

  subOption: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },

  subOptionText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },

  subOptionMeta: {
    fontSize: 14,
    fontWeight: "700",
    color: "#555",
    marginTop: 2,
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
  width: "88%",
  maxWidth: 900,
  backgroundColor: "#ffffff",
  borderRadius: 22,
  paddingVertical: 22,
  paddingHorizontal: 20,
  alignItems: "center",
  justifyContent: "center",
  elevation: 12,
},

  saveToastLogo: {
    width: 150,
    height: 82,
    marginBottom: 8,
  },

  saveToastTitle: {
    color: "#15803d",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },

  saveToastMessage: {
    color: "#555",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },

  saveToastSubMessage: {
    color: "#4b5563",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 4,
  },

  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  lineupModeBadge: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  alignSelf: "center",
  marginTop: 8,
  paddingVertical: 6,
  paddingHorizontal: 12,
  borderRadius: 999,
},

editableBadge: {
  backgroundColor: "#15803d",
},

viewOnlyModeBadge: {
  backgroundColor: "#6b7280",
},

lineupModeBadgeText: {
  color: "#ffffff",
  fontSize: 13,
  fontWeight: "900",
},

footer: {
  alignItems: "center",
  marginTop: 24,
  marginBottom: 12,
},

footerText: {
  color: "#6b7280",
  fontSize: 12,
  fontWeight: "700",
  textAlign: "center",
},

instructionsLogo: {
  width: 110,
  height: 70,
  alignSelf: "center",
  marginBottom: 6,
},

leaveWithoutSavingButton: {
  backgroundColor: "#6b7280",
  borderRadius: 12,
  paddingVertical: 13,
  alignItems: "center",
  marginTop: 10,
},

leaveWithoutSavingButtonText: {
  color: "#ffffff",
  fontSize: 16,
  fontWeight: "900",
},

importantText: {
  color: "#c62828",
  fontWeight: "900",
  textDecorationLine: "underline",
},
});
