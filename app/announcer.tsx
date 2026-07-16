import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
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

import { API_BASE } from "../utils/appconfig";
import { modalStyles } from "../utils/modalStyles";

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
  eastScore?: number;
  westScore?: number;
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
  eastScore: 0,
  westScore: 0,
  updatedAt: "",
};

export default function AnnouncerScreen() {
  const params = useLocalSearchParams<{
    gameId?: string;
    divisionId?: string;
    gameTitle?: string;
    eastDugout?: string;
    westDugout?: string;
    accentColor?: string;
  }>();
  const [selectedGame, setSelectedGame] = useState<GameOption>(() => {
    const requestedId = String(params.gameId || "");
    const requestedDivision = String(params.divisionId || "");

    return (
      GAMES.find(
        (game) =>
          game.id === requestedId || game.divisionId === requestedDivision
      ) || GAMES[1]
    );
  });
  const [displaySquad, setDisplaySquad] = useState<Squad>("East");
  const [loading, setLoading] = useState(true);

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
  const [lastUpdatedDate, setLastUpdatedDate] = useState<Date | null>(null);
  const [refreshAge, setRefreshAge] = useState("Loading...");
  const [eastManager, setEastManager] = useState("");
  const [westManager, setWestManager] = useState("");
  const [liveLabel, setLiveLabel] = useState("🟢 LIVE GAME FEED");

  const lastSnapshot = useRef("");
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 900;
  const isDesktop = width >= 1200;
  const gameTitle =
    String(params.gameTitle || "").trim() ||
    selectedGame.label.replace(/\n/g, " ");
  const eastDugout = String(params.eastDugout || "1B Dugout");
  const westDugout = String(params.westDugout || "3B Dugout");
  const gameAccentColor = String(params.accentColor || "#1f4e9e");
  const swipeHintScale = useRef(new Animated.Value(1)).current;

  const displayBatting = displaySquad === "East" ? eastBatting : westBatting;
  const displayGameState =
    displaySquad === "East" ? eastGameState : westGameState;

  const currentBatter = getPlayerAtIndex(
    displayBatting,
    displayGameState.currentBatterIndex
  );

  const onDeckBatter = getPlayerAtIndex(
    displayBatting,
    displayGameState.currentBatterIndex + 1
  );

  const inHoleBatter = getPlayerAtIndex(
    displayBatting,
    displayGameState.currentBatterIndex + 2
  );

  useEffect(() => {
    const requestedId = String(params.gameId || "");
    const requestedDivision = String(params.divisionId || "");

    if (!requestedId && !requestedDivision) {
      router.replace("/announcer-games");
      return;
    }

    const nextGame = GAMES.find(
      (game) =>
        game.id === requestedId || game.divisionId === requestedDivision
    );

    if (nextGame && nextGame.id !== selectedGame.id) {
      setSelectedGame(nextGame);
    }
  }, [params.gameId, params.divisionId]);

  useEffect(() => {
    loadGameData();

    const interval = setInterval(() => {
      loadGameData(false);
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

    const safeIndex =
      ((index % players.length) + players.length) % players.length;

    return players[safeIndex];
  }

  function isCurrentBatter(
    player: Player,
    squad: Squad,
    index?: number
  ) {
    if (!index) return false;

    const gameState = squad === "East" ? eastGameState : westGameState;
    return index - 1 === gameState.currentBatterIndex;
  }

  async function loadSquadLineup(divisionId: string, squad: Squad) {
    const response = await fetch(
      `${API_BASE}/api/lineups/${divisionId}/${squad}`
    );

    const json = await response.json();

    const resolvedManagerName =
      json?.managerName ||
      json?.lineup?.managerName ||
      json?.manager?.displayName ||
      json?.manager?.name ||
      json?.assignment?.managerName ||
      json?.assignment?.displayName ||
      "";

    if (!json?.ok || !json.lineup?.players) {
      return {
        batting: [],
        subs: [],
        managerName: resolvedManagerName,
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
      managerName: resolvedManagerName,
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
  eastScore: Number(json.gameState.eastScore || 0),
  westScore: Number(json.gameState.westScore || 0),
  updatedAt: json.gameState.updatedAt || "",
};
}

  function buildSnapshot(
    eastBattingList: Player[],
    eastSubsList: Player[],
    westBattingList: Player[],
    westSubsList: Player[],
    nextEastGameState: GameState,
    nextWestGameState: GameState
  ) {
    return JSON.stringify({
      eastBatting: eastBattingList.map((p) => `${p.id}-${p.battingOrder}`),
      eastSubs: eastSubsList.map((p) => p.id),
      westBatting: westBattingList.map((p) => `${p.id}-${p.battingOrder}`),
      westSubs: westSubsList.map((p) => p.id),
      eastIndex: nextEastGameState.currentBatterIndex,
      westIndex: nextWestGameState.currentBatterIndex,
      eastInning: nextEastGameState.inning,
      eastHalf: nextEastGameState.half,
      eastOuts: nextEastGameState.outs,
      westInning: nextWestGameState.inning,
      westHalf: nextWestGameState.half,
      westOuts: nextWestGameState.outs,
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

      const typedEastState = eastState as GameState;
      const typedWestState = westState as GameState;

      const nextSnapshot = buildSnapshot(
        east.batting,
        east.subs,
        west.batting,
        west.subs,
        typedEastState,
        typedWestState
      );

      if (lastSnapshot.current && lastSnapshot.current !== nextSnapshot) {
        setLiveLabel("🟢 LIVE GAME UPDATED");

        setTimeout(() => {
          setLiveLabel("🟢 LIVE GAME FEED");
        }, 2500);
      }

      lastSnapshot.current = nextSnapshot;

      setEastBatting(east.batting);
      setEastSubs(east.subs);
      setWestBatting(west.batting);
      setWestSubs(west.subs);
      setEastManager(east.managerName || "");
      setWestManager(west.managerName || "");
      setEastGameState(typedEastState);
      setWestGameState(typedWestState);

      const now = new Date();
      setLastUpdatedDate(now);
      setRefreshAge("Updated Just Now");
    } catch (e) {
      console.log("ANNOUNCER PUBLIC LOAD ERROR:", e);
    } finally {
      setLoading(false);
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
            <Text
              style={isMain ? styles.orderNumberLarge : styles.orderNumberSmall}
            >
              {battingOrderIndex ? `Batting Order #${battingOrderIndex}` : ""}
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

            <Text
              style={
                isMain ? styles.playerPositionLarge : styles.playerMetaMedium
              }
            >
              {player.position || "POS"}
            </Text>
          </>
        ) : (
          <Text style={styles.emptyFeaturedText}>No batting lineup saved yet.</Text>
        )}
      </View>
    );
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
          <View style={styles.topActionRow}>
            <Pressable
              onPress={() => router.replace("/dashboard")}
              style={styles.backTopButton}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="chevron-back-outline"
                  size={18}
                  color="#ffffff"
                  style={{ marginRight: 4 }}
                />

                <Text style={styles.topActionText}>Back</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => router.replace("/announcer-games")}
              style={styles.changeGameTopButton}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color="#ffffff"
                  style={{ marginRight: 6 }}
                />

                <Text style={styles.topActionText}>Change Game</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.viewTitleArea}>
            <View style={styles.gameNumberPill}>
              <Text style={styles.gameNumberPillText}>
                GAME {selectedGame.id.replace("game", "")}
              </Text>
            </View>

            <Text style={styles.viewGameTitle}>{gameTitle}</Text>
            <Text style={styles.viewModeLabel}>LIVE GAME VIEW</Text>
            <Text style={styles.liveStatusText}>{liveLabel}</Text>
            <Text style={styles.lastUpdatedText}>{refreshAge}</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#1d4ed8" />
          ) : (
            <>
              <View
                style={[
                  styles.broadcastScoreboard,
                  { borderColor: gameAccentColor },
                ]}
              >
                <View style={styles.broadcastTeamColumn}>
                  <Image
                    source={require("../assets/East.png")}
                    style={styles.broadcastLogo}
                    resizeMode="contain"
                  />

                  <Text style={styles.broadcastEastLabel}>EAST</Text>
                  <Text style={styles.broadcastDugout}>{eastDugout}</Text>
                  <Text style={styles.broadcastManager}>
                    Manager: {eastManager || "TBD"}
                  </Text>
                </View>

                <View style={styles.broadcastCenter}>
                  <Text style={styles.broadcastScore}>
                    {Number(displayGameState.eastScore || 0)}
                    <Text style={styles.broadcastDash}> - </Text>
                    {Number(displayGameState.westScore || 0)}
                  </Text>

                  <Text style={styles.broadcastInning}>
                    {displayGameState.half.toUpperCase()}{" "}
                    {displayGameState.inning}
                  </Text>

                  <Text style={styles.broadcastOutDots}>
                    {"●".repeat(Number(displayGameState.outs || 0))}
                    {"○".repeat(3 - Number(displayGameState.outs || 0))}
                  </Text>

                  <Text style={styles.broadcastOutText}>
                    {Number(displayGameState.outs || 0)}{" "}
                    {Number(displayGameState.outs || 0) === 1 ? "OUT" : "OUTS"}
                  </Text>
                </View>

                <View style={styles.broadcastTeamColumn}>
                  <Image
                    source={require("../assets/West.png")}
                    style={styles.broadcastLogo}
                    resizeMode="contain"
                  />

                  <Text style={styles.broadcastWestLabel}>WEST</Text>
                  <Text style={styles.broadcastDugout}>{westDugout}</Text>
                  <Text style={styles.broadcastManager}>
                    Manager: {westManager || "TBD"}
                  </Text>
                </View>
              </View>

              <View style={styles.liveFeaturePanel}>
                <Text style={styles.liveFeatureTitle}>Live Now Batting</Text>

                <View style={styles.displayToggleRow}>
                  <Pressable
                    style={[
                      styles.displayToggleButton,
                      displaySquad === "East" && styles.eastDisplayActive,
                    ]}
                    onPress={() => setDisplaySquad("East")}
                  >
                    <Text
                      style={[
                        styles.displayToggleText,
                        displaySquad === "East" && styles.activeDisplayText,
                      ]}
                    >
                      East
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.displayToggleButton,
                      displaySquad === "West" && styles.westDisplayActive,
                    ]}
                    onPress={() => setDisplaySquad("West")}
                  >
                    <Text
                      style={[
                        styles.displayToggleText,
                        displaySquad === "West" && styles.activeDisplayText,
                      ]}
                    >
                      West
                    </Text>
                  </Pressable>
                </View>

                {renderFeaturedPlayer(
                  "NOW BATTING",
                  currentBatter,
                  displayGameState.currentBatterIndex + 1,
                  true
                )}

                <View style={styles.upNextRow}>
                  <View style={styles.upNextColumn}>
                    {renderFeaturedPlayer(
                      "ON DECK",
                      onDeckBatter,
                      displayGameState.currentBatterIndex + 2
                    )}
                  </View>

                  <View style={styles.upNextColumn}>
                    {renderFeaturedPlayer(
                      "IN THE HOLE",
                      inHoleBatter,
                      displayGameState.currentBatterIndex + 3
                    )}
                  </View>
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
                  setDisplaySquad("East");
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
  paddingTop: 18,
  paddingBottom: 70,
},

  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 8,
  },

  backButton: {
    backgroundColor: "#1d4ed8",
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
    paddingVertical: 8,
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
    fontSize: Platform.OS === "web" ? 30 : 24,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
    marginTop: 10,
    lineHeight: Platform.OS === "web" ? 36 : 29,
  },

  matchupCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderTopWidth: 7,
    padding: 16,
    marginTop: 8,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  gameIdentityRow: {
    flexDirection: "row",
    justifyContent: "center",
  },

  gameNumberPill: {
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },

  gameNumberPillText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },

  matchupRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },

  matchupTeam: {
    flex: 1,
    alignItems: "center",
  },

  matchupLogo: {
    width: 125,
    height: 82,
  },

  eastMatchupTitle: {
    color: "#c62828",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 3,
  },

  westMatchupTitle: {
    color: "#1565c0",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 3,
  },

  dugoutText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
    textAlign: "center",
  },

  matchupManagerText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
    textAlign: "center",
  },

  versusColumn: {
    width: 42,
    alignItems: "center",
  },

  versusText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "900",
  },

  topActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },

  backTopButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },

  changeGameTopButton: {
    backgroundColor: "#c62828",
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },

  topActionText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  viewTitleArea: {
    alignItems: "center",
    marginBottom: 4,
  },

  gameNumberPill: {
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 11,
  },

  gameNumberPillText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
  },

  viewGameTitle: {
    color: "#111827",
    fontSize: Platform.OS === "web" ? 29 : 23,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 7,
  },

  viewModeLabel: {
    color: "#1f4e9e",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 2,
  },

  broadcastScoreboard: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    borderWidth: 3,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 9,
  },

  broadcastTeamColumn: {
    flex: 1,
    alignItems: "center",
    minWidth: 0,
  },

  broadcastLogo: {
    width: Platform.OS === "web" ? 125 : 88,
    height: Platform.OS === "web" ? 78 : 62,
  },

  broadcastEastLabel: {
    color: "#ef4444",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },

  broadcastWestLabel: {
    color: "#60a5fa",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },

  broadcastDugout: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 3,
  },

  broadcastManager: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 3,
  },

  broadcastCenter: {
    minWidth: 96,
    alignItems: "center",
  },

  broadcastScore: {
    color: "#ffffff",
    fontSize: Platform.OS === "web" ? 38 : 28,
    fontWeight: "900",
  },

  broadcastDash: {
    color: "#94a3b8",
  },

  broadcastInning: {
    color: "#facc15",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },

  broadcastOutDots: {
    color: "#facc15",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 4,
    marginTop: 3,
  },

  broadcastOutText: {
    color: "#d1d5db",
    fontSize: 11,
    fontWeight: "900",
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

  liveFeaturePanel: {
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

  liveFeatureTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 10,
  },

  displayToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },

  displayToggleButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
  },

  eastDisplayActive: {
    backgroundColor: "#c62828",
  },

  westDisplayActive: {
    backgroundColor: "#1565c0",
  },

  displayToggleText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "900",
  },

  activeDisplayText: {
    color: "#ffffff",
  },

  gameStateText: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "900",
    color: "#374151",
    marginBottom: 10,
  },

  publicGameStateCard: {
  backgroundColor: "#111827",
  borderRadius: 16,
  paddingVertical: 14,
  paddingHorizontal: 12,
  alignItems: "center",
  marginBottom: 12,
  borderWidth: 3,
  borderColor: "#facc15",
},

publicGameStateMain: {
  color: "#ffffff",
  fontSize: 28,
  fontWeight: "900",
  textAlign: "center",
},

publicOutsDots: {
  color: "#facc15",
  fontSize: 28,
  fontWeight: "900",
  letterSpacing: 6,
  marginTop: 4,
},

publicOutsText: {
  color: "#d1d5db",
  fontSize: 14,
  fontWeight: "900",
  marginTop: 2,
},

  currentBatterCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "#facc15",
  },

  currentBatterLabel: {
    color: "#facc15",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },

  orderNumberLarge: {
    color: "#93c5fd",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },

  jerseyLarge: {
    color: "#ffffff",
    fontSize: 40,
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
    marginBottom: 4,
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
  },

  upNextLabel: {
    color: "#1f4e9e",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 4,
  },

  orderNumberSmall: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
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
  ...modalStyles.overlay,
},

gamePickerCard: {
  ...modalStyles.card,
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

scoreboardHeader: {
  color: "#facc15",
  fontSize: 18,
  fontWeight: "900",
  textAlign: "center",
  letterSpacing: 2,
  marginBottom: 10,
},

publicScoreboardRow: {
  flexDirection: "row",
  justifyContent: "space-evenly",
  alignItems: "center",
  marginBottom: 12,
},

publicScoreColumn: {
  alignItems: "center",
  flex: 1,
},

publicEastLabel: {
  color: "#fca5a5",
  fontSize: 18,
  fontWeight: "900",
},

publicWestLabel: {
  color: "#93c5fd",
  fontSize: 18,
  fontWeight: "900",
},

publicScoreNumber: {
  color: "#ffffff",
  fontSize: 42,
  fontWeight: "900",
  marginTop: 2,
},

publicScoreDivider: {
  width: 2,
  alignSelf: "stretch",
  backgroundColor: "#374151",
  marginHorizontal: 10,
},
});
