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

  function renderCompactPlayerRow(
    player: Player,
    squad: Squad,
    index: number,
    currentIndex: number
  ) {
    const current = index === currentIndex;

    return (
      <View
        key={`${squad}-${player.id}-${index}`}
        style={[
          styles.compactPlayerRow,
          current && styles.compactCurrentPlayerRow,
        ]}
      >
        <Text style={styles.compactOrder}>{index + 1}</Text>

        <Text
          style={[
            styles.compactJersey,
            squad === "East"
              ? styles.compactEastJersey
              : styles.compactWestJersey,
          ]}
        >
          #{player.jerseyNumber || "--"}
        </Text>

        <View style={styles.compactPlayerInfo}>
          <Text style={styles.compactPlayerName}>{player.name}</Text>
          <Text style={styles.compactPlayerMeta}>
            {player.position || "POS"} • {player.teamName || "Team"}
          </Text>
        </View>

        {current ? (
          <Ionicons name="caret-back" size={20} color="#f59e0b" />
        ) : null}
      </View>
    );
  }

  function renderCompactSubRow(player: Player, squad: Squad) {
    return (
      <View key={`${squad}-sub-${player.id}`} style={styles.compactSubRow}>
        <Text
          style={[
            styles.compactSubJersey,
            squad === "East"
              ? styles.compactEastJersey
              : styles.compactWestJersey,
          ]}
        >
          #{player.jerseyNumber || "--"}
        </Text>

        <View style={styles.compactPlayerInfo}>
          <Text style={styles.compactPlayerName}>{player.name}</Text>
          <Text style={styles.compactPlayerMeta}>
            {player.position || "POS"} • {player.teamName || "Team"}
          </Text>
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
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topActionRow}>
            <Pressable
              style={styles.changeGameTopButton}
              onPress={() => router.replace("/announcer-games")}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color="#ffffff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.topButtonText}>Change Game</Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.exitTopButton}
              onPress={() => router.replace("/dashboard")}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="arrow-back-outline"
                  size={18}
                  color="#ffffff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.topButtonText}>Back</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.titleArea}>
            <View style={styles.gameNumberPill}>
              <Text style={styles.gameNumberPillText}>
                GAME {selectedGame.id.replace("game", "")}
              </Text>
            </View>

            <Text style={styles.gameTitle}>{gameTitle}</Text>
            <Text style={styles.screenModeTitle}>Live Game View</Text>
            <Text style={styles.liveStatusText}>{liveLabel}</Text>
            <Text style={styles.lastUpdatedText}>{refreshAge}</Text>
          </View>

          {loading ? (
            <View style={styles.loadingPanel}>
              <ActivityIndicator size="large" color="#1f4e9e" />
              <Text style={styles.loadingText}>Loading Game...</Text>
            </View>
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
                    {displayGameState.half.toUpperCase()} {displayGameState.inning}
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

              <View style={styles.viewerToggleRow}>
                <Pressable
                  style={[
                    styles.viewerToggleButton,
                    displaySquad === "East" && styles.eastActiveButton,
                  ]}
                  onPress={() => setDisplaySquad("East")}
                >
                  <Text
                    style={[
                      styles.viewerToggleText,
                      displaySquad === "East" && styles.activeToggleText,
                    ]}
                  >
                    East Batting
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.viewerToggleButton,
                    displaySquad === "West" && styles.westActiveButton,
                  ]}
                  onPress={() => setDisplaySquad("West")}
                >
                  <Text
                    style={[
                      styles.viewerToggleText,
                      displaySquad === "West" && styles.activeToggleText,
                    ]}
                  >
                    West Batting
                  </Text>
                </Pressable>
              </View>

              <View style={styles.desktopWorkspace}>
                <View style={styles.featureColumn}>
                  <View style={styles.panelCard}>
                    <View style={styles.panelHeaderDark}>
                      <Text style={styles.panelHeaderText}>NOW BATTING</Text>
                    </View>

                    <View
                      style={[
                        styles.activeSquadStrip,
                        displaySquad === "East" ? styles.eastStrip : styles.westStrip,
                      ]}
                    >
                      <Image
                        source={
                          displaySquad === "East"
                            ? require("../assets/East.png")
                            : require("../assets/West.png")
                        }
                        style={styles.activeSquadMiniLogo}
                        resizeMode="contain"
                      />
                      <Text style={styles.activeSquadStripText}>
                        {displaySquad.toUpperCase()} BATTING
                      </Text>
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
                </View>

                <View style={styles.lineupColumn}>
                  <View style={styles.panelCard}>
                    <View
                      style={[
                        styles.panelHeaderTeam,
                        displaySquad === "East" ? styles.eastHeader : styles.westHeader,
                      ]}
                    >
                      <Text style={styles.panelHeaderText}>
                        {displaySquad.toUpperCase()} BATTING LINEUP ({displayBatting.length})
                      </Text>
                    </View>

                    {displayBatting.length > 0 ? (
                      displayBatting.map((player, index) =>
                        renderCompactPlayerRow(
                          player,
                          displaySquad,
                          index,
                          displayGameState.currentBatterIndex
                        )
                      )
                    ) : (
                      <Text style={styles.emptyPanelText}>No saved batting lineup yet.</Text>
                    )}

                    <Text style={styles.lineupManagerFooter}>
                      Manager: {displaySquad === "East" ? eastManager || "TBD" : westManager || "TBD"}
                    </Text>
                  </View>
                </View>

                <View style={styles.sideColumn}>
                  <View style={styles.panelCard}>
                    <View
                      style={[
                        styles.panelHeaderTeam,
                        displaySquad === "East" ? styles.eastHeader : styles.westHeader,
                      ]}
                    >
                      <Text style={styles.panelHeaderText}>
                        {displaySquad.toUpperCase()} SUBSTITUTES
                      </Text>
                    </View>

                    {(displaySquad === "East" ? eastSubs : westSubs).length > 0 ? (
                      (displaySquad === "East" ? eastSubs : westSubs).map(
                        (player) => renderCompactSubRow(player, displaySquad)
                      )
                    ) : (
                      <Text style={styles.emptyPanelText}>No substitutes listed.</Text>
                    )}
                  </View>

                  <View style={styles.panelCard}>
                    <View
                      style={[
                        styles.panelHeaderTeam,
                        displaySquad === "East" ? styles.westHeader : styles.eastHeader,
                      ]}
                    >
                      <Text style={styles.panelHeaderText}>
                        {displaySquad === "East" ? "WEST" : "EAST"} LINEUP
                      </Text>
                    </View>

                    <Pressable
                      style={styles.opposingLineupButton}
                      onPress={() =>
                        setDisplaySquad(displaySquad === "East" ? "West" : "East")
                      }
                    >
                      <Text style={styles.opposingLineupButtonText}>
                        View {displaySquad === "East" ? "West" : "East"} Lineup
                      </Text>
                      <Ionicons name="chevron-forward-outline" size={22} color="#1f4e9e" />
                    </Pressable>
                  </View>
                </View>
              </View>
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>NTABL All-Star App • Version 1.0</Text>
          </View>
        </ScrollView>
      </View>


    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef2f7" },
  container: {
    width: "100%",
    maxWidth: 1700,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 70,
  },
  topActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  changeGameTopButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  exitTopButton: {
    backgroundColor: "#c62828",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  topButtonText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  titleArea: { alignItems: "center", paddingVertical: 5 },
  gameNumberPill: {
    backgroundColor: "#111827",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 13,
  },
  gameNumberPillText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  gameTitle: {
    color: "#111827",
    fontSize: Platform.OS === "web" ? 32 : 25,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 8,
  },
  screenModeTitle: {
    color: "#1f4e9e",
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 2,
  },
  liveStatusText: { color: "#15803d", fontSize: 18, fontWeight: "900", marginTop: 9 },
  lastUpdatedText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
    marginBottom: 10,
  },
  loadingPanel: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 35,
    alignItems: "center",
  },
  loadingText: { color: "#6b7280", fontWeight: "800", marginTop: 10 },
  broadcastScoreboard: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    borderWidth: 3,
    paddingVertical: 15,
    paddingHorizontal: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 9,
  },
  broadcastTeamColumn: { flex: 1, alignItems: "center" },
  broadcastLogo: {
    width: Platform.OS === "web" ? 145 : 94,
    height: Platform.OS === "web" ? 88 : 65,
  },
  broadcastEastLabel: { color: "#ef4444", fontSize: 19, fontWeight: "900", marginTop: 2 },
  broadcastWestLabel: { color: "#60a5fa", fontSize: 19, fontWeight: "900", marginTop: 2 },
  broadcastDugout: { color: "#fff", fontSize: 13, fontWeight: "900", marginTop: 3 },
  broadcastManager: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 4,
  },
  broadcastCenter: {
    minWidth: Platform.OS === "web" ? 180 : 105,
    alignItems: "center",
  },
  broadcastScore: {
    color: "#fff",
    fontSize: Platform.OS === "web" ? 43 : 31,
    fontWeight: "900",
  },
  broadcastDash: { color: "#94a3b8" },
  broadcastInning: { color: "#facc15", fontSize: 19, fontWeight: "900", marginTop: 3 },
  broadcastOutDots: {
    color: "#facc15",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 5,
    marginTop: 3,
  },
  broadcastOutText: { color: "#d1d5db", fontSize: 12, fontWeight: "900" },
  viewerToggleRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  viewerToggleButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#d1d5db",
  },
  viewerToggleText: { color: "#374151", fontSize: 15, fontWeight: "900" },
  desktopWorkspace: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    alignItems: "flex-start",
    gap: 12,
  },
  featureColumn: { flex: 1.05, width: Platform.OS === "web" ? undefined : "100%", minWidth: 0 },
  lineupColumn: { flex: 0.9, width: Platform.OS === "web" ? undefined : "100%", minWidth: 0 },
  sideColumn: {
    flex: 0.9,
    width: Platform.OS === "web" ? undefined : "100%",
    minWidth: 0,
    gap: 12,
  },
  panelCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#d6dee8",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  panelHeaderDark: {
    backgroundColor: "#10213d",
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  panelHeaderBlue: {
    backgroundColor: "#1f4e9e",
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  panelHeaderTeam: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  eastHeader: { backgroundColor: "#d71920" },
  westHeader: { backgroundColor: "#174ea6" },
  panelHeaderText: { color: "#fff", fontSize: 15, fontWeight: "900", textAlign: "center" },
  activeSquadStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
  },
  eastStrip: { backgroundColor: "#fee2e2" },
  westStrip: { backgroundColor: "#dbeafe" },
  activeSquadMiniLogo: { width: 50, height: 34, marginRight: 7 },
  activeSquadStripText: { color: "#111827", fontSize: 14, fontWeight: "900" },
  currentBatterCard: {
    backgroundColor: "#fff",
    padding: 18,
    alignItems: "center",
    margin: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d6dee8",
  },
  currentBatterLabel: { display: "none" },
  orderNumberLarge: { color: "#6b7280", fontSize: 13, fontWeight: "900" },
  jerseyLarge: { color: "#d71920", fontSize: 31, fontWeight: "900", marginTop: 4 },
  playerNameLarge: { color: "#111827", fontSize: 27, fontWeight: "900", textAlign: "center" },
  playerMetaLarge: {
    color: "#4b5563",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 5,
  },
  playerPositionLarge: { color: "#1f4e9e", fontSize: 17, fontWeight: "900", marginTop: 3 },
  upNextRow: { flexDirection: "row", gap: 9, paddingHorizontal: 10, marginBottom: 10 },
  upNextColumn: { flex: 1 },
  upNextCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#d6dee8",
    padding: 11,
    alignItems: "center",
    minHeight: 132,
  },
  upNextLabel: { color: "#1f4e9e", fontSize: 13, fontWeight: "900", marginBottom: 4 },
  orderNumberSmall: { color: "#6b7280", fontSize: 11, fontWeight: "900" },
  jerseySmall: { color: "#d71920", fontSize: 19, fontWeight: "900" },
  playerNameMedium: { color: "#111827", fontSize: 16, fontWeight: "900", textAlign: "center" },
  playerMetaMedium: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 2,
  },
  emptyFeaturedText: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    marginVertical: 18,
  },
  compactPlayerRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  compactCurrentPlayerRow: {
    backgroundColor: "#fef3c7",
    borderLeftWidth: 5,
    borderLeftColor: "#f59e0b",
  },
  compactOrder: { width: 25, color: "#6b7280", fontSize: 13, fontWeight: "800" },
  compactJersey: { width: 52, fontSize: 15, fontWeight: "900" },
  compactEastJersey: { color: "#d71920" },
  compactWestJersey: { color: "#174ea6" },
  compactPlayerInfo: { flex: 1 },
  compactPlayerName: { color: "#111827", fontSize: 14, fontWeight: "900" },
  compactPlayerMeta: { color: "#6b7280", fontSize: 11, fontWeight: "700", marginTop: 1 },
  compactSubRow: {
    minHeight: 49,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  compactSubJersey: { width: 55, fontSize: 15, fontWeight: "900" },
  lineupManagerFooter: {
    color: "#4b5563",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 12,
  },
  emptyPanelText: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    padding: 25,
  },
  opposingLineupButton: {
    margin: 13,
    borderWidth: 1,
    borderColor: "#93c5fd",
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#eff6ff",
  },
  opposingLineupButtonText: { color: "#1f4e9e", fontSize: 15, fontWeight: "900" },
  gameControlsCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#d6dee8",
    marginBottom: 12,
  },
  squadToggleRow: { flexDirection: "row", gap: 8, padding: 10 },
  squadToggleButton: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 11,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
  },
  eastActiveButton: { backgroundColor: "#d71920" },
  westActiveButton: { backgroundColor: "#174ea6" },
  squadToggleText: { color: "#374151", fontSize: 14, fontWeight: "900" },
  activeToggleText: { color: "#fff" },
  scoreControlGrid: { flexDirection: "row", gap: 10, paddingHorizontal: 10, paddingBottom: 10 },
  scoreControlTeam: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 9,
  },
  eastControlLabel: { color: "#d71920", fontSize: 12, fontWeight: "900" },
  westControlLabel: { color: "#174ea6", fontSize: 12, fontWeight: "900" },
  scoreControlRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  scoreButton: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreButtonText: { color: "#fff", fontSize: 24, fontWeight: "900" },
  scoreValue: { minWidth: 48, textAlign: "center", color: "#111827", fontSize: 27, fontWeight: "900" },
  controlActionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 10, paddingTop: 0 },
  addOutButton: {
    flexGrow: 1,
    minWidth: 110,
    backgroundColor: "#d97706",
    borderRadius: 9,
    paddingVertical: 11,
    alignItems: "center",
  },
  clearOutsButton: {
    flexGrow: 1,
    minWidth: 110,
    backgroundColor: "#6b7280",
    borderRadius: 9,
    paddingVertical: 11,
    alignItems: "center",
  },
  switchSidesButton: {
    flexGrow: 1,
    minWidth: 145,
    backgroundColor: "#15803d",
    borderRadius: 9,
    paddingVertical: 11,
    alignItems: "center",
  },
  previousHalfButton: {
    flexGrow: 1,
    minWidth: 130,
    backgroundColor: "#1d4ed8",
    borderRadius: 9,
    paddingVertical: 11,
    alignItems: "center",
  },
  resetGameButton: {
    flexGrow: 1,
    minWidth: 120,
    backgroundColor: "#c62828",
    borderRadius: 9,
    paddingVertical: 11,
    alignItems: "center",
  },
  gameManagementButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  controlButtonRow: { flexDirection: "row", gap: 9, paddingHorizontal: 10, paddingBottom: 10 },
  previousButton: {
    flex: 1,
    backgroundColor: "#4b5563",
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: "center",
  },
  nextButton: {
    flex: 1,
    backgroundColor: "#1d4ed8",
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: "center",
  },
  controlButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  footer: { marginTop: 12, alignItems: "center" },
  footerText: { color: "#6b7280", fontSize: 12, fontWeight: "700" },

});
