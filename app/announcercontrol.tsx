import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { adminFetch, API_BASE } from "../utils/appconfig";

type Squad = "East" | "West";

type Player = {
  id: string;
  name: string;
  jerseyNumber: string;
  position: string;
  teamName: string;
  squad: Squad;
  batting?: boolean;
  battingOrder?: number | null;
};

type GameState = {
  currentBatterIndex: number;
  inning: number;
  half: "Top" | "Bottom";
  outs: number;
  updatedAt?: string;
};

type GameOption = {
  id: string;
  label: string;
  divisionId: string;
};

const GAMES: GameOption[] = [
  {
    id: "game1",
    label: "Game 1:\nRegency (60+)\nAll-Stars",
    divisionId: "regency",
  },
  {
    id: "game2",
    label: "Game 2:\nMasters (45+)\nAll-Stars",
    divisionId: "masters",
  },
  {
    id: "game3",
    label: "Game 3:\nVeterans (30+)\nRookie Prospects\nAll-Stars",
    divisionId: "veterans",
  },
  {
    id: "game4",
    label: "Game 4:\nOpen (18+)\nAll-Stars",
    divisionId: "open",
  },
];

const DEFAULT_GAME_STATE: GameState = {
  currentBatterIndex: 0,
  inning: 1,
  half: "Top",
  outs: 0,
  updatedAt: "",
};

export default function AnnouncerControlScreen() {
  const [selectedGame, setSelectedGame] = useState<GameOption>(GAMES[1]);
  const [activeSquad, setActiveSquad] = useState<Squad>("East");
  const [loading, setLoading] = useState(true);
  const [savingGameState, setSavingGameState] = useState(false);

  const [eastBatting, setEastBatting] = useState<Player[]>([]);
  const [eastSubs, setEastSubs] = useState<Player[]>([]);
  const [westBatting, setWestBatting] = useState<Player[]>([]);
  const [westSubs, setWestSubs] = useState<Player[]>([]);

  const [eastGameState, setEastGameState] = useState<GameState>({
    ...DEFAULT_GAME_STATE,
    half: "Top",
  });

  const [westGameState, setWestGameState] = useState<GameState>({
    ...DEFAULT_GAME_STATE,
    half: "Bottom",
  });

  const [showGamePicker, setShowGamePicker] = useState(false);
  const [showSwitchSidesConfirm, setShowSwitchSidesConfirm] = useState(false);
  const [showResetGameConfirm, setShowResetGameConfirm] = useState(false);
  const [lastUpdatedDate, setLastUpdatedDate] = useState<Date | null>(null);
  const [refreshAge, setRefreshAge] = useState("Loading...");
  const [eastManager, setEastManager] = useState("");
  const [westManager, setWestManager] = useState("");
  const [liveLabel, setLiveLabel] = useState("🟢 LIVE LINEUP FEED");

  const lastLineupSnapshot = useRef("");
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 900;
  const isDesktop = width >= 1200;
  const swipeHintScale = useRef(new Animated.Value(1)).current;

  const activeBatting = activeSquad === "East" ? eastBatting : westBatting;
  const activeGameState =
    activeSquad === "East" ? eastGameState : westGameState;

  const currentBatter = getPlayerAtIndex(
    activeBatting,
    activeGameState.currentBatterIndex
  );

  const onDeckBatter = getPlayerAtIndex(
    activeBatting,
    activeGameState.currentBatterIndex + 1
  );

  const inHoleBatter = getPlayerAtIndex(
    activeBatting,
    activeGameState.currentBatterIndex + 2
  );

  useEffect(() => {
    loadGameData();

    const interval = setInterval(() => {
      loadLineupDataOnly();
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedGame.divisionId]);

  useEffect(() => {
    function pulseSwipeHint() {
      Animated.sequence([
        Animated.timing(swipeHintScale, {
          toValue: 1.15,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(swipeHintScale, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();
    }

    const firstPulse = setTimeout(pulseSwipeHint, 5000);
    const interval = setInterval(pulseSwipeHint, 15000);

    return () => {
      clearTimeout(firstPulse);
      clearInterval(interval);
    };
  }, [swipeHintScale]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!lastUpdatedDate) {
        setRefreshAge("Loading...");
        return;
      }

      const seconds = Math.floor(
        (Date.now() - lastUpdatedDate.getTime()) / 1000
      );

      if (seconds <= 1) {
        setRefreshAge("Updated Just Now");
      } else {
        setRefreshAge(`Updated ${seconds} Seconds Ago`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdatedDate]);

  function getPlayerAtIndex(players: Player[], index: number) {
    if (!players.length) return null;

    const safeIndex = ((index % players.length) + players.length) % players.length;
    return players[safeIndex];
  }

  async function loadSquadLineup(divisionId: string, squad: Squad) {
    const response = await fetch(
      `${API_BASE}/api/lineups/${divisionId}/${squad}`
    );

    const json = await response.json();

    if (!json?.ok || !json.lineup?.players) {
      return {
        batting: [],
        subs: [],
        managerName: json?.managerName || "",
      };
    }

    const batting = json.lineup.players
      .filter((player: Player) => player.batting)
      .sort(
        (a: Player, b: Player) =>
          (a.battingOrder || 999) - (b.battingOrder || 999)
      );

    const subs = json.lineup.players.filter(
      (player: Player) => !player.batting
    );

    return {
      batting,
      subs,
      managerName: json.managerName || "",
    };
  }

  async function loadSquadGameState(divisionId: string, squad: Squad) {
    const response = await fetch(
      `${API_BASE}/api/game-state/${divisionId}/${squad}`
    );

    const json = await response.json();

    if (!json?.ok || !json.gameState) {
      return {
        ...DEFAULT_GAME_STATE,
        half: squad === "East" ? "Top" : "Bottom",
      };
    }

return {
  currentBatterIndex: Number(json.gameState.currentBatterIndex || 0),
  inning: Number(json.gameState.inning || 1),
  half: json.gameState.half || (squad === "East" ? "Top" : "Bottom"),
  outs: Number(json.gameState.outs || 0),
  updatedAt: json.gameState.updatedAt || "",
};
  }

  function buildLineupSnapshot(
    eastBattingList: Player[],
    eastSubsList: Player[],
    westBattingList: Player[],
    westSubsList: Player[]
  ) {
    return JSON.stringify({
      eastBatting: eastBattingList.map((p) => `${p.id}-${p.battingOrder}`),
      eastSubs: eastSubsList.map((p) => p.id),
      westBatting: westBattingList.map((p) => `${p.id}-${p.battingOrder}`),
      westSubs: westSubsList.map((p) => p.id),
    });
  }

  async function loadGameData(showSpinner = true) {
    try {
      if (showSpinner) setLoading(true);

      const [east, west, eastState, westState] = await Promise.all([
        loadSquadLineup(selectedGame.divisionId, "East"),
        loadSquadLineup(selectedGame.divisionId, "West"),
        loadSquadGameState(selectedGame.divisionId, "East"),
        loadSquadGameState(selectedGame.divisionId, "West"),
      ]);

      const nextSnapshot = buildLineupSnapshot(
        east.batting,
        east.subs,
        west.batting,
        west.subs
      );

      if (
        lastLineupSnapshot.current &&
        lastLineupSnapshot.current !== nextSnapshot
      ) {
        setLiveLabel("🟢 LINEUP UPDATED");

        setTimeout(() => {
          setLiveLabel("🟢 LIVE LINEUP FEED");
        }, 2500);
      }

      lastLineupSnapshot.current = nextSnapshot;

      setEastBatting(east.batting);
      setEastSubs(east.subs);
      setWestBatting(west.batting);
      setWestSubs(west.subs);
      setEastManager(east.managerName || "");
      setWestManager(west.managerName || "");
      setEastGameState(eastState as GameState);
      setWestGameState(westState as GameState);

      const now = new Date();
      setLastUpdatedDate(now);
      setRefreshAge("Updated Just Now");
    } catch (e) {
      console.log("ANNOUNCER CONTROL LOAD ERROR:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadLineupDataOnly() {
  try {
    const [east, west] = await Promise.all([
      loadSquadLineup(selectedGame.divisionId, "East"),
      loadSquadLineup(selectedGame.divisionId, "West"),
    ]);

    const nextSnapshot = buildLineupSnapshot(
      east.batting,
      east.subs,
      west.batting,
      west.subs
    );

    if (
      lastLineupSnapshot.current &&
      lastLineupSnapshot.current !== nextSnapshot
    ) {
      setLiveLabel("🟢 LINEUP UPDATED");

      setTimeout(() => {
        setLiveLabel("🟢 LIVE LINEUP FEED");
      }, 2500);
    }

    lastLineupSnapshot.current = nextSnapshot;

    setEastBatting(east.batting);
    setEastSubs(east.subs);
    setWestBatting(west.batting);
    setWestSubs(west.subs);
    setEastManager(east.managerName || "");
    setWestManager(west.managerName || "");

    const now = new Date();
    setLastUpdatedDate(now);
    setRefreshAge("Updated Just Now");
  } catch (e) {
    console.log("ANNOUNCER LINEUP REFRESH ERROR:", e);
  }
}

  async function saveGameState(squad: Squad, nextState: GameState) {
    try {
      setSavingGameState(true);

      if (squad === "East") {
        setEastGameState(nextState);
      } else {
        setWestGameState(nextState);
      }

const response = await adminFetch(
  `${API_BASE}/api/game-state/${selectedGame.divisionId}/${squad}`,
  {
    method: "POST",
    body: JSON.stringify(nextState),
  }
);

      const json = await response.json();

      if (json?.ok && json.gameState) {
const savedState = {
  currentBatterIndex: Number(json.gameState.currentBatterIndex || 0),
  inning: Number(json.gameState.inning || 1),
  half: json.gameState.half || nextState.half,
  outs: Number(json.gameState.outs || 0),
  updatedAt: json.gameState.updatedAt || "",
};

        if (squad === "East") {
          setEastGameState(savedState);
        } else {
          setWestGameState(savedState);
        }
      }
    } catch (e) {
      console.log("SAVE GAME STATE ERROR:", e);
    } finally {
      setSavingGameState(false);
    }
  }

  function moveBatter(direction: "previous" | "next") {
    if (!activeBatting.length) return;

    const currentIndex = activeGameState.currentBatterIndex || 0;
    const nextIndex =
      direction === "next"
        ? (currentIndex + 1) % activeBatting.length
        : (currentIndex - 1 + activeBatting.length) % activeBatting.length;

    saveGameState(activeSquad, {
      ...activeGameState,
      currentBatterIndex: nextIndex,
    });
  }

  function addOut() {
  const nextOuts = Math.min(Number(activeGameState.outs || 0) + 1, 3);

  saveGameState(activeSquad, {
    ...activeGameState,
    outs: nextOuts,
  });
}

function clearOuts() {
  saveGameState(activeSquad, {
    ...activeGameState,
    outs: 0,
  });
}

function advanceHalfInning() {
  const nextSquad: Squad = activeSquad === "East" ? "West" : "East";
  const nextHalf: "Top" | "Bottom" =
    activeGameState.half === "Top" ? "Bottom" : "Top";

  const nextInning =
    activeGameState.half === "Bottom"
      ? Number(activeGameState.inning || 1) + 1
      : Number(activeGameState.inning || 1);

  const nextState: GameState = {
    ...activeGameState,
    half: nextHalf,
    inning: nextInning,
    outs: 0,
  };

  saveGameState(activeSquad, nextState);
  setActiveSquad(nextSquad);
}

function goBackHalfInning() {
  const currentInning = Number(activeGameState.inning || 1);

  if (activeGameState.half === "Top" && currentInning <= 1) {
    return;
  }

  const previousHalf: "Top" | "Bottom" =
    activeGameState.half === "Top" ? "Bottom" : "Top";

  const previousInning =
    activeGameState.half === "Top" ? currentInning - 1 : currentInning;

  const previousSquad: Squad = activeSquad === "East" ? "West" : "East";

  saveGameState(activeSquad, {
    ...activeGameState,
    half: previousHalf,
    inning: previousInning,
    outs: 0,
  });

  setActiveSquad(previousSquad);
}

async function resetActiveGame() {
  try {
    setSavingGameState(true);

    const response = await adminFetch(
      `${API_BASE}/api/game-state/${selectedGame.divisionId}/restart`,
      {
        method: "POST",
      }
    );

    const json = await response.json();

    if (json?.ok) {
      await loadGameData(false);
      setActiveSquad("East");
    }

    setShowResetGameConfirm(false);
  } catch (e) {
    console.log("RESTART GAME ERROR:", e);
  } finally {
    setSavingGameState(false);
  }
}

  function renderFeaturedPlayer(
    label: string,
    player: Player | null,
    battingOrderIndex?: number,
    isMain = false
  ) {
    return (
      <View style={isMain ? styles.currentBatterCard : styles.upNextCard}>
        <Text style={isMain ? styles.currentBatterLabel : styles.upNextLabel}>
          {label}
        </Text>

        {player ? (
          <>
            <Text style={isMain ? styles.orderNumberLarge : styles.orderNumberSmall}>
              {battingOrderIndex ? `#${battingOrderIndex}` : ""}
            </Text>

            <Text style={isMain ? styles.jerseyLarge : styles.jerseySmall}>
              #{player.jerseyNumber || "--"}
            </Text>

            <Text style={isMain ? styles.playerNameLarge : styles.playerNameMedium}>
              {player.name}
            </Text>

            <Text style={isMain ? styles.playerMetaLarge : styles.playerMetaMedium}>
              {player.teamName}
            </Text>

            <Text style={isMain ? styles.playerPositionLarge : styles.playerMetaMedium}>
              {player.position || "POS"}
            </Text>
          </>
        ) : (
          <Text style={styles.emptyFeaturedText}>No batting lineup saved yet.</Text>
        )}
      </View>
    );
  }

function isCurrentBatter(player: Player, squad: Squad, index?: number) {
  if (!index) return false;

  const gameState = squad === "East" ? eastGameState : westGameState;
  return index - 1 === gameState.currentBatterIndex;
}

    function renderPlayer(
    player: Player,
    squad: Squad,
    isSubstitute: boolean,
    index?: number
  ) {
    const current = isCurrentBatter(player, squad, index);

    return (
      <View
        key={`${player.id}-${index || "sub"}`}
        style={[
          styles.playerRow,
          isSubstitute
            ? styles.substituteRow
            : squad === "East"
            ? styles.eastBattingRow
            : styles.westBattingRow,
          current && styles.currentPlayerRow,
        ]}
      >
        <Text style={[styles.playerNumber, current && styles.currentPlayerText]}>
          {index ? `${index}. ` : ""}#{player.jerseyNumber}
        </Text>

        <View style={styles.playerInfo}>
          <Text
            style={[
              styles.playerName,
              isDesktop && styles.playerNameDesktop,
              current && styles.currentPlayerText,
            ]}
          >
            {player.name}
          </Text>

          <Text style={[styles.playerMeta, current && styles.currentPlayerMeta]}>
            {player.position || "POS"} | {player.teamName}
          </Text>

          {current ? <Text style={styles.nowBattingPill}>NOW BATTING</Text> : null}
        </View>
      </View>
    );
  }

  function renderSquad(
    title: string,
    squad: Squad,
    colorStyle: object,
    managerName: string,
    batting: Player[],
    subs: Player[]
  ) {
    return (
      <View style={styles.squadCard}>
        <Text style={[styles.squadTitle, colorStyle]}>{title}</Text>

        <Text style={styles.managerText}>Manager: {managerName || "TBD"}</Text>

        <Image
          source={
            squad === "East"
              ? require("../assets/East.png")
              : require("../assets/West.png")
          }
          style={[styles.squadLogo, isDesktop && styles.squadLogoDesktop]}
          resizeMode="contain"
        />

        <Text style={styles.sectionTitle}>Batting Lineup</Text>

        {batting.length > 0 ? (
          batting.map((player, index) =>
            renderPlayer(player, squad, false, index + 1)
          )
        ) : (
          <Text style={styles.emptyText}>No saved batting lineup yet.</Text>
        )}

        <Text style={styles.sectionTitle}>Substitutes</Text>

        {subs.length > 0 ? (
          subs.map((player) => renderPlayer(player, squad, true))
        ) : (
          <Text style={styles.emptyText}>No substitutes listed.</Text>
        )}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.replace("/login")}
              style={styles.logoutButton}
            >
              <View style={styles.smallButtonRow}>
                <Ionicons
                  name="log-out-outline"
                  size={16}
                  color="#ffffff"
                  style={{ marginRight: 5 }}
                />

                <Text style={styles.backButtonText}>Logout</Text>
              </View>
            </Pressable>
          </View>

          <Text style={styles.title}>Announcer Control</Text>

          <Image
            source={require("../assets/All-Star Logo.png")}
            style={styles.allStarLogo}
            resizeMode="contain"
          />

          <Pressable
            style={styles.chooseGameButton}
            onPress={() => setShowGamePicker(true)}
          >
            <View style={styles.buttonContentRow}>
              <Ionicons
                name="calendar-outline"
                size={22}
                color="#ffffff"
                style={{ marginRight: 8 }}
              />

              <Text style={styles.chooseGameButtonText}>Choose Game</Text>
            </View>
          </Pressable>

          <Text style={styles.selectedGameTitle}>{selectedGame.label}</Text>

          <Text style={styles.liveStatusText}>{liveLabel}</Text>
          <Text style={styles.lastUpdatedText}>{refreshAge}</Text>

          {loading ? (
            <ActivityIndicator size="large" color="#1d4ed8" />
          ) : (
            <>
              <View style={styles.controlPanel}>
                <Text style={styles.controlPanelTitle}>Game Control</Text>

                <View style={styles.squadToggleRow}>
                  <Pressable
                    style={[
                      styles.squadToggleButton,
                      activeSquad === "East" && styles.eastActiveButton,
                    ]}
                    onPress={() => setActiveSquad("East")}
                  >
                    <Text
                      style={[
                        styles.squadToggleText,
                        activeSquad === "East" && styles.activeToggleText,
                      ]}
                    >
                      East Batting
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.squadToggleButton,
                      activeSquad === "West" && styles.westActiveButton,
                    ]}
                    onPress={() => setActiveSquad("West")}
                  >
                    <Text
                      style={[
                        styles.squadToggleText,
                        activeSquad === "West" && styles.activeToggleText,
                      ]}
                    >
                      West Batting
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.gameManagementPanel}>
                  <Text style={styles.gameManagementTitle}>
                    Game Management
                  </Text>

                  <Text style={styles.gameStateText}>
                    {activeGameState.half.toUpperCase()} • Inning{" "}
                    {activeGameState.inning} •{" "}
                    {Number(activeGameState.outs || 0)}{" "}
                    {Number(activeGameState.outs || 0) === 1
                      ? "Out"
                      : "Outs"}
                  </Text>

                  <Text style={styles.outsDisplay}>
                    {"●".repeat(Number(activeGameState.outs || 0))}
                    {"○".repeat(3 - Number(activeGameState.outs || 0))}
                  </Text>

                  <View style={styles.gameManagementButtonRow}>
                    <Pressable
                      style={[
                        styles.addOutButton,
                        savingGameState && styles.disabledButton,
                      ]}
                      onPress={addOut}
                      disabled={savingGameState}
                    >
                      <Text style={styles.gameManagementButtonText}>
                        +1 Out
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.clearOutsButton,
                        savingGameState && styles.disabledButton,
                      ]}
                      onPress={clearOuts}
                      disabled={savingGameState}
                    >
                      <Text style={styles.gameManagementButtonText}>
                        Clear Outs
                      </Text>
                    </Pressable>
                  </View>

                  <Pressable
                    style={[
                      styles.switchSidesButton,
                      savingGameState && styles.disabledButton,
                    ]}
                    onPress={() => setShowSwitchSidesConfirm(true)}
                    disabled={savingGameState}
                  >
                    <View style={styles.buttonContentRow}>
                      <Ionicons
                        name="swap-horizontal-outline"
                        size={22}
                        color="#ffffff"
                        style={{ marginRight: 6 }}
                      />

                      <Text style={styles.gameManagementButtonText}>
                        3 Outs / Switch Sides
                      </Text>
                    </View>
                  </Pressable>

                  <View style={styles.gameManagementButtonRow}>
                    <Pressable
                      style={[
                        styles.previousHalfButton,
                        savingGameState && styles.disabledButton,
                      ]}
                      onPress={goBackHalfInning}
                      disabled={savingGameState}
                    >
                      <View style={styles.buttonContentRow}>
                        <Ionicons
                          name="arrow-undo-outline"
                          size={20}
                          color="#ffffff"
                          style={{ marginRight: 6 }}
                        />

                        <Text style={styles.gameManagementButtonText}>
                          Previous Half
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.resetGameButton,
                        savingGameState && styles.disabledButton,
                      ]}
                      onPress={() => setShowResetGameConfirm(true)}
                      disabled={savingGameState}
                    >
                      <View style={styles.buttonContentRow}>
                        <Ionicons
                          name="refresh-circle-outline"
                          size={20}
                          color="#ffffff"
                          style={{ marginRight: 6 }}
                        />

                        <Text style={styles.gameManagementButtonText}>
                          Restart Game
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </View>

                {renderFeaturedPlayer(
                  "NOW BATTING",
                  currentBatter,
                  activeGameState.currentBatterIndex + 1,
                  true
                )}

                <View style={styles.upNextRow}>
                  <View style={styles.upNextColumn}>
                    {renderFeaturedPlayer(
                      "ON DECK",
                      onDeckBatter,
                      activeGameState.currentBatterIndex + 2
                    )}
                  </View>

                  <View style={styles.upNextColumn}>
                    {renderFeaturedPlayer(
                      "IN THE HOLE",
                      inHoleBatter,
                      activeGameState.currentBatterIndex + 3
                    )}
                  </View>
                </View>

                <View style={styles.controlButtonRow}>
                  <Pressable
                    style={[styles.previousButton, savingGameState && styles.disabledButton]}
                    onPress={() => moveBatter("previous")}
                    disabled={savingGameState || !activeBatting.length}
                  >
                    <View style={styles.buttonContentRow}>
                      <Ionicons
                        name="chevron-back-outline"
                        size={22}
                        color="#ffffff"
                        style={{ marginRight: 5 }}
                      />

                      <Text style={styles.controlButtonText}>Previous</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    style={[styles.nextButton, savingGameState && styles.disabledButton]}
                    onPress={() => moveBatter("next")}
                    disabled={savingGameState || !activeBatting.length}
                  >
                    <View style={styles.buttonContentRow}>
                      <Text style={styles.controlButtonText}>Next Batter</Text>

                      <Ionicons
                        name="chevron-forward-outline"
                        size={22}
                        color="#ffffff"
                        style={{ marginLeft: 5 }}
                      />
                    </View>
                  </Pressable>
                </View>
              </View>

              {!isWideScreen && (
                <Animated.View style={{ transform: [{ scale: swipeHintScale }] }}>
                  <Text style={styles.swipeHint}>
                    👈 Swipe to Switch Between East & West All-Stars 👉
                  </Text>
                </Animated.View>
              )}

              <ScrollView
                horizontal={!isWideScreen}
                showsHorizontalScrollIndicator={!isWideScreen}
                contentContainerStyle={[
                  styles.squadBoard,
                  isWideScreen && styles.squadBoardWide,
                ]}
              >
                <View
                  style={
                    isWideScreen
                      ? styles.squadColumnWide
                      : styles.squadColumnMobile
                  }
                >
                  {renderSquad(
                    "East All-Stars",
                    "East",
                    styles.eastText,
                    eastManager,
                    eastBatting,
                    eastSubs
                  )}
                </View>

                <View
                  style={
                    isWideScreen
                      ? styles.squadColumnWide
                      : styles.squadColumnMobile
                  }
                >
                  {renderSquad(
                    "West All-Stars",
                    "West",
                    styles.westText,
                    westManager,
                    westBatting,
                    westSubs
                  )}
                </View>
              </ScrollView>
            </>
          )}
          <View style={styles.footer}>
  <Text style={styles.footerText}>
    NTABL All-Star App • Version 1.0
  </Text>
</View>
        </ScrollView>
      </View>

      <Modal
        visible={showGamePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGamePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.gamePickerCard}>
            <Text style={styles.modalTitle}>Choose Game</Text>

            {GAMES.map((game) => (
              <Pressable
                key={game.id}
                style={[
                  styles.gamePickerOption,
                  selectedGame.id === game.id && styles.activeGamePickerOption,
                ]}
                onPress={() => {
                  setSelectedGame(game);
                  setActiveSquad("East");
                  setShowGamePicker(false);
                }}
              >
                <Text
                  style={[
                    styles.gamePickerOptionText,
                    selectedGame.id === game.id &&
                      styles.activeGamePickerOptionText,
                  ]}
                >
                  {game.label}
                </Text>
              </Pressable>
            ))}

            <Pressable
              style={styles.cancelButton}
              onPress={() => setShowGamePicker(false)}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="close-circle-outline"
                  size={20}
                  color="#ffffff"
                  style={{ marginRight: 6 }}
                />

                <Text style={styles.cancelButtonText}>Cancel</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
  visible={showSwitchSidesConfirm}
  transparent
  animationType="fade"
  onRequestClose={() => setShowSwitchSidesConfirm(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.gamePickerCard}>
      <Text style={styles.modalTitle}>Switch Sides?</Text>

      <Text style={styles.confirmText}>
        This will move the game from {activeGameState.half} of Inning{" "}
        {activeGameState.inning} to{" "}
        {activeGameState.half === "Top" ? "Bottom" : "Top"} of Inning{" "}
        {activeGameState.half === "Bottom"
          ? Number(activeGameState.inning || 1) + 1
          : Number(activeGameState.inning || 1)}
        .
      </Text>

      <View style={styles.confirmButtonRow}>
        <Pressable
          style={styles.confirmNoButton}
          onPress={() => setShowSwitchSidesConfirm(false)}
        >
          <Text style={styles.cancelButtonText}>No</Text>
        </Pressable>

        <Pressable
          style={styles.confirmYesButton}
          onPress={() => {
            setShowSwitchSidesConfirm(false);
            advanceHalfInning();
          }}
        >
          <Text style={styles.cancelButtonText}>Yes, Switch</Text>
        </Pressable>
      </View>
    </View>
  </View>
</Modal>
<Modal
  visible={showResetGameConfirm}
  transparent
  animationType="fade"
  onRequestClose={() => setShowResetGameConfirm(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.gamePickerCard}>
      <Text style={styles.modalTitle}>Restart Current Game?</Text>

<Text style={styles.confirmText}>
  IMPORTANT: This Will Restart the Current Game

  {"\n\n"}The Following Will Be Reset:

  {"\n"}• East lineup to Batter #1
  {"\n"}• West lineup to Batter #1
  {"\n"}• Top of the 1st Inning
  {"\n"}• 0 Outs

  {"\n\n"}This Will NOT Clear:

  {"\n"}• Team All-Star Selections
  {"\n"}• Saved Batting Orders
  {"\n"}• East/West Assignments
</Text>

      <View style={styles.confirmButtonRow}>
        <Pressable
          style={styles.confirmNoButton}
          onPress={() => setShowResetGameConfirm(false)}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>

        <Pressable
          style={styles.confirmYesButton}
          onPress={resetActiveGame}
        >
          <Text style={styles.cancelButtonText}>Restart Game</Text>
        </Pressable>
      </View>
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
  padding: 12,
  paddingTop: 40,
  paddingBottom: 70,
},

  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 8,
  },

  logoutButton: {
    backgroundColor: "#c62828",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  backButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 8,
  },

  allStarLogo: {
    width: 170,
    height: 115,
    alignSelf: "center",
    marginBottom: 10,
  },

  chooseGameButton: {
    backgroundColor: "#1f4e9e",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginBottom: 4,
    alignItems: "center",
    alignSelf: "center",
    minWidth: 220,
  },

  chooseGameButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },

  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  selectedGameTitle: {
    fontSize: Platform.OS === "web" ? 40 : 28,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: Platform.OS === "web" ? 46 : 30,
  },

  liveStatusText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#15803d",
    textAlign: "center",
    marginBottom: 2,
  },

  lastUpdatedText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 12,
  },

  controlPanel: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#d1d5db",
    shadowColor: "#000",
shadowOpacity: 0.08,
shadowRadius: 10,
shadowOffset: {
  width: 0,
  height: 4,
},
elevation: 6,
  },

  controlPanelTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 10,
  },

  squadToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },

  squadToggleButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
  },

  eastActiveButton: {
    backgroundColor: "#c62828",
  },

  westActiveButton: {
    backgroundColor: "#1565c0",
  },

  squadToggleText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "900",
  },

  activeToggleText: {
    color: "#ffffff",
  },

  gameStateText: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "900",
    color: "#374151",
    marginBottom: 10,
  },

currentBatterCard: {
  backgroundColor: "#111827",
  borderRadius: 18,
  padding: 18,
  alignItems: "center",
  marginBottom: 12,

  borderWidth: 3,
  borderColor: "#facc15",

  shadowColor: "#000",
  shadowOpacity: 0.10,
  shadowRadius: 12,
  shadowOffset: {
    width: 0,
    height: 4,
  },
  elevation: 8,
},

  currentBatterLabel: {
    color: "#facc15",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },

  orderNumberLarge: {
    color: "#93c5fd",
    fontSize: 22,
    fontWeight: "900",
  },

  jerseyLarge: {
    color: "#ffffff",
    fontSize: 38,
    fontWeight: "900",
  },

  playerNameLarge: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },

  playerMetaLarge: {
    color: "#d1d5db",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 4,
  },

  playerPositionLarge: {
    color: "#facc15",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },

  upNextRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  upNextColumn: {
    flex: 1,
  },

  upNextCard: {
    backgroundColor: "#f3f4f6",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    minHeight: 130,
    borderWidth: 1,
    borderColor: "#d1d5db",
    shadowColor: "#000",
shadowOpacity: 0.08,
shadowRadius: 10,
shadowOffset: {
  width: 0,
  height: 4,
},
elevation: 6,
  },

  upNextLabel: {
    color: "#1f4e9e",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 4,
  },

  orderNumberSmall: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "900",
  },

  jerseySmall: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },

  playerNameMedium: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },

  playerMetaMedium: {
    color: "#555",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 2,
  },

  emptyFeaturedText: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 12,
  },

  controlButtonRow: {
    flexDirection: "row",
    gap: 10,
  },

  previousButton: {
    flex: 1,
    backgroundColor: "#4b5563",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  nextButton: {
    flex: 1,
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },

  controlButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  disabledButton: {
    opacity: 0.5,
  },

  swipeHint: {
    textAlign: "center",
    fontSize: 14,
    color: "#1f4e9e",
    marginTop: 4,
    marginBottom: 12,
    fontWeight: "900",
  },

  squadBoard: {
    flexDirection: "row",
    gap: 14,
    paddingBottom: 8,
  },

  squadBoardWide: {
    width: "100%",
    justifyContent: "space-between",
  },

  squadColumnWide: {
    flex: 1,
    minWidth: 0,
  },

  squadColumnMobile: {
    width: 390,
  },

  squadCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
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

  squadTitle: {
    fontSize: 23,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },

  eastText: {
    color: "#c62828",
  },

  westText: {
    color: "#1565c0",
  },

  managerText: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 8,
  },

  squadLogo: {
    width: 220,
    height: 120,
    alignSelf: "center",
    marginTop: -6,
    marginBottom: 8,
  },

  squadLogoDesktop: {
    width: 240,
    height: 140,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1f4e9e",
    marginTop: 10,
    marginBottom: 6,
  },

  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
  },

  eastBattingRow: {
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
  },

  westBattingRow: {
    backgroundColor: "#dbeafe",
    borderColor: "#93c5fd",
  },

  substituteRow: {
    backgroundColor: "#f3f4f6",
    borderColor: "#d1d5db",
  },

  playerNumber: {
    width: 74,
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
  },

  playerInfo: {
    flex: 1,
  },

  playerName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },

  playerNameDesktop: {
    fontSize: 24,
  },

  playerMeta: {
    fontSize: 14,
    fontWeight: "700",
    color: "#555",
    marginTop: 2,
  },

  emptyText: {
    color: "#6b7280",
    fontWeight: "700",
    marginBottom: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },

  gamePickerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    width: "88%",
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 14,
  },

  gamePickerOption: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 8,
  },

  activeGamePickerOption: {
    backgroundColor: "#1f4e9e",
    borderColor: "#1f4e9e",
  },

  gamePickerOptionText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },

  activeGamePickerOptionText: {
    color: "#ffffff",
  },

  cancelButton: {
    backgroundColor: "#c62828",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },

  cancelButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },

  smallButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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

currentPlayerRow: {
  backgroundColor: "#111827",
  borderColor: "#facc15",
  borderWidth: 3,
},

currentPlayerText: {
  color: "#ffffff",
},

currentPlayerMeta: {
  color: "#d1d5db",
},

nowBattingPill: {
  alignSelf: "flex-start",
  backgroundColor: "#facc15",
  color: "#111827",
  fontSize: 11,
  fontWeight: "900",
  paddingVertical: 3,
  paddingHorizontal: 8,
  borderRadius: 999,
  marginTop: 5,
  overflow: "hidden",
},

gameManagementPanel: {
  backgroundColor: "#f8fafc",
  borderRadius: 14,
  padding: 12,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: "#d1d5db",
},

gameManagementTitle: {
  fontSize: 18,
  fontWeight: "900",
  color: "#1f4e9e",
  textAlign: "center",
  marginBottom: 6,
},

outsDisplay: {
  textAlign: "center",
  fontSize: 24,
  fontWeight: "900",
  color: "#111827",
  letterSpacing: 5,
  marginBottom: 10,
},

gameManagementButtonRow: {
  flexDirection: "row",
  gap: 10,
  marginBottom: 10,
},

addOutButton: {
  flex: 1,
  backgroundColor: "#15803d",
  borderRadius: 12,
  paddingVertical: 12,
  alignItems: "center",
},

clearOutsButton: {
  flex: 1,
  backgroundColor: "#4b5563",
  borderRadius: 12,
  paddingVertical: 12,
  alignItems: "center",
},

switchSidesButton: {
  backgroundColor: "#c62828",
  borderRadius: 12,
  paddingVertical: 14,
  alignItems: "center",
},

gameManagementButtonText: {
  color: "#ffffff",
  fontSize: 15,
  fontWeight: "900",
},

confirmText: {
  color: "#374151",
  fontSize: 16,
  fontWeight: "800",
  textAlign: "center",
  lineHeight: 22,
  marginBottom: 16,
},

confirmButtonRow: {
  flexDirection: "row",
  gap: 10,
},

confirmNoButton: {
  flex: 1,
  backgroundColor: "#4b5563",
  borderRadius: 10,
  paddingVertical: 12,
  alignItems: "center",
},

confirmYesButton: {
  flex: 1,
  backgroundColor: "#c62828",
  borderRadius: 10,
  paddingVertical: 12,
  alignItems: "center",
},

previousHalfButton: {
  flex: 1,
  backgroundColor: "#4b5563",
  borderRadius: 12,
  paddingVertical: 12,
  alignItems: "center",
  marginTop: 10,
},

resetGameButton: {
  flex: 1,
  backgroundColor: "#991b1b",
  borderRadius: 12,
  paddingVertical: 12,
  alignItems: "center",
  marginTop: 10,
},
});
