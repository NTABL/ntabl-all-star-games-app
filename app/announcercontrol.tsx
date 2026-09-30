import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams, useFocusEffect } from "expo-router";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Image,
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
  pronunciation?: string;
};

type GameState = {
  currentBatterIndex: number;
  inning: number;
  half: "Top" | "Bottom";
  outs: number;
  eastScore?: number;
  westScore?: number;
  visitorSquad?: Squad;
  homeSquad?: Squad;
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
  visitorSquad: "East",
  homeSquad: "West",
  updatedAt: "",
};

const PRONUNCIATION_OVERRIDES: Record<string, string> = {
  "Paul Bierwagen": "Paul Beer-wagon",
};

export default function AnnouncerControlScreen() {
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
  const [showResetAnnouncerConfirm, setShowResetAnnouncerConfirm] = useState(false);
  const [resettingAnnouncerChanges, setResettingAnnouncerChanges] = useState(false);
  const [lastUpdatedDate, setLastUpdatedDate] = useState<Date | null>(null);
  const [refreshAge, setRefreshAge] = useState("Loading...");
  const [eastManager, setEastManager] = useState("");
  const [westManager, setWestManager] = useState("");
  const [liveLabel, setLiveLabel] = useState("🟢 LIVE LINEUP FEED");
  const [showJerseyEditor, setShowJerseyEditor] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingSquad, setEditingSquad] = useState<Squad>("East");
  const [playerNameDraft, setPlayerNameDraft] = useState("");
  const [jerseyNumberDraft, setJerseyNumberDraft] = useState("");
  const [savingJerseyNumber, setSavingJerseyNumber] = useState(false);
  const [showManagerEditor, setShowManagerEditor] = useState(false);
  const [editingManagerSquad, setEditingManagerSquad] = useState<Squad>("East");
  const [managerNameDraft, setManagerNameDraft] = useState("");
  const [savingManagerName, setSavingManagerName] = useState(false);
  const [controlView, setControlView] = useState<"lineups" | "game">("lineups");

  const lastLineupSnapshot = useRef("");
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
  useFocusEffect(() => {
  const subscription = BackHandler.addEventListener(
    "hardwareBackPress",
    () => true
  );

  return () => subscription.remove();
});
useFocusEffect(() => {
  if (Platform.OS !== "web") return;

  window.history.pushState(null, "", window.location.href);

  const handlePopState = () => {
    window.history.pushState(null, "", window.location.href);
  };

  window.addEventListener("popstate", handlePopState);

  return () => {
    window.removeEventListener("popstate", handlePopState);
  };
});

  const activeBatting = activeSquad === "East" ? eastBatting : westBatting;
  const activeGameState =
    activeSquad === "East" ? eastGameState : westGameState;

  const visitorSquad: Squad =
    activeGameState.visitorSquad === "West" ? "West" : "East";
  const homeSquad: Squad = visitorSquad === "East" ? "West" : "East";
  const battingSquadForHalf: Squad =
    activeGameState.half === "Top" ? visitorSquad : homeSquad;

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

  const eastPitcher = [...eastBatting, ...eastSubs].find(
    (player) => String(player.position || "").toUpperCase().split(/[\s,/.-]+/).includes("P")
  ) || null;
  const westPitcher = [...westBatting, ...westSubs].find(
    (player) => String(player.position || "").toUpperCase().split(/[\s,/.-]+/).includes("P")
  ) || null;
  const defensiveSquad: Squad = activeSquad === "East" ? "West" : "East";

  useEffect(() => {
    const requestedId = String(params.gameId || "");
    const requestedDivision = String(params.divisionId || "");

    if (!requestedId && !requestedDivision) {
      router.replace("/announcercontrol-games");
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
      // Refresh lineups AND live game state so score/inning/outs/batter changes
      // made from another control/view appear without leaving the screen.
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

    const safeIndex = ((index % players.length) + players.length) % players.length;
    return players[safeIndex];
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
  visitorSquad: json.gameState.visitorSquad === "West" ? "West" : "East",
  homeSquad: json.gameState.homeSquad === "East" ? "East" : "West",
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
  eastBatting: eastBattingList.map(
    (p) => `${p.id}-${p.battingOrder}-${p.jerseyNumber}-${p.name}`
  ),
  eastSubs: eastSubsList.map(
    (p) => `${p.id}-${p.jerseyNumber}-${p.name}`
  ),
  westBatting: westBattingList.map(
    (p) => `${p.id}-${p.battingOrder}-${p.jerseyNumber}-${p.name}`
  ),
  westSubs: westSubsList.map(
    (p) => `${p.id}-${p.jerseyNumber}-${p.name}`
  ),
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
      const eastLoaded = eastState as GameState;
      const westLoaded = westState as GameState;
      const sharedLoaded =
        String(eastLoaded.updatedAt || "") >= String(westLoaded.updatedAt || "")
          ? eastLoaded
          : westLoaded;

      const normalizedEast: GameState = {
        ...eastLoaded,
        inning: sharedLoaded.inning,
        half: sharedLoaded.half,
        outs: sharedLoaded.outs,
        eastScore: sharedLoaded.eastScore,
        westScore: sharedLoaded.westScore,
        visitorSquad: sharedLoaded.visitorSquad,
        homeSquad: sharedLoaded.homeSquad,
      };
      const normalizedWest: GameState = {
        ...westLoaded,
        inning: sharedLoaded.inning,
        half: sharedLoaded.half,
        outs: sharedLoaded.outs,
        eastScore: sharedLoaded.eastScore,
        westScore: sharedLoaded.westScore,
        visitorSquad: sharedLoaded.visitorSquad,
        homeSquad: sharedLoaded.homeSquad,
      };

      setEastGameState(normalizedEast);
      setWestGameState(normalizedWest);

      const loadedVisitor: Squad =
        sharedLoaded.visitorSquad === "West" ? "West" : "East";
      const loadedHome: Squad = loadedVisitor === "East" ? "West" : "East";
      setActiveSquad(sharedLoaded.half === "Bottom" ? loadedHome : loadedVisitor);

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
const savedState: GameState = {
  currentBatterIndex: Number(json.gameState.currentBatterIndex || 0),
  inning: Number(json.gameState.inning || 1),
  half:
    json.gameState.half === "Bottom"
      ? "Bottom"
      : json.gameState.half === "Top"
      ? "Top"
      : nextState.half,
  outs: Number(json.gameState.outs || 0),
  eastScore: Number(json.gameState.eastScore || 0),
  westScore: Number(json.gameState.westScore || 0),
  visitorSquad:
    json.gameState.visitorSquad === "West"
      ? "West"
      : nextState.visitorSquad || "East",
  homeSquad:
    json.gameState.homeSquad === "East"
      ? "East"
      : nextState.homeSquad || "West",
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

  async function saveSharedGameState(nextSharedState: GameState) {
    const nextEastState: GameState = {
      ...eastGameState,
      inning: nextSharedState.inning,
      half: nextSharedState.half,
      outs: nextSharedState.outs,
      eastScore: nextSharedState.eastScore,
      westScore: nextSharedState.westScore,
      visitorSquad: nextSharedState.visitorSquad,
      homeSquad: nextSharedState.homeSquad,
    };

    const nextWestState: GameState = {
      ...westGameState,
      inning: nextSharedState.inning,
      half: nextSharedState.half,
      outs: nextSharedState.outs,
      eastScore: nextSharedState.eastScore,
      westScore: nextSharedState.westScore,
      visitorSquad: nextSharedState.visitorSquad,
      homeSquad: nextSharedState.homeSquad,
    };

    await Promise.all([
      saveGameState("East", nextEastState),
      saveGameState("West", nextWestState),
    ]);
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

    saveSharedGameState({
      ...activeGameState,
      outs: nextOuts,
    });
  }

  function clearOuts() {
    saveSharedGameState({
      ...activeGameState,
      outs: 0,
    });
  }

  function updateScore(team: "East" | "West", amount: number) {
    const currentEastScore = Number(activeGameState.eastScore || 0);
    const currentWestScore = Number(activeGameState.westScore || 0);

    saveSharedGameState({
      ...activeGameState,
      eastScore:
        team === "East" ? Math.max(currentEastScore + amount, 0) : currentEastScore,
      westScore:
        team === "West" ? Math.max(currentWestScore + amount, 0) : currentWestScore,
    });
  }

async function swapHomeAndVisitor() {
  const nextVisitor: Squad = homeSquad;
  const nextHome: Squad = visitorSquad;

  await saveSharedGameState({
    ...activeGameState,
    visitorSquad: nextVisitor,
    homeSquad: nextHome,
  });

  setActiveSquad(
    activeGameState.half === "Top" ? nextVisitor : nextHome
  );
}

function advanceHalfInning() {
  const currentInning = Number(activeGameState.inning || 1);
  const currentHalf = activeGameState.half;

  const nextHalf: "Top" | "Bottom" =
    currentHalf === "Top" ? "Bottom" : "Top";
  const nextSquad: Squad =
    nextHalf === "Top" ? visitorSquad : homeSquad;

  const nextInning =
    currentHalf === "Bottom" ? currentInning + 1 : currentInning;

  // Each squad owns its own currentBatterIndex. Do not copy the
  // outgoing squad's batter position onto the incoming squad.
  const incomingGameState =
    nextSquad === "East" ? eastGameState : westGameState;

  saveSharedGameState({
    ...incomingGameState,
    half: nextHalf,
    inning: nextInning,
    outs: 0,
    eastScore: activeGameState.eastScore,
    westScore: activeGameState.westScore,
    visitorSquad: activeGameState.visitorSquad,
    homeSquad: activeGameState.homeSquad,
  });

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

  const previousSquad: Squad =
    previousHalf === "Top" ? visitorSquad : homeSquad;

  // Preserve the previous squad's own batter position while moving
  // the shared inning/score information back one half inning.
  const previousGameState =
    previousSquad === "East" ? eastGameState : westGameState;

  saveSharedGameState({
    ...previousGameState,
    half: previousHalf,
    inning: previousInning,
    outs: 0,
    eastScore: activeGameState.eastScore,
    westScore: activeGameState.westScore,
    visitorSquad: activeGameState.visitorSquad,
    homeSquad: activeGameState.homeSquad,
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
      const resetEast = json?.gameState?.East || { ...DEFAULT_GAME_STATE };
      const resetWest = json?.gameState?.West || { ...DEFAULT_GAME_STATE };
      setEastGameState(resetEast);
      setWestGameState(resetWest);
      setActiveSquad(resetEast.visitorSquad === "West" ? "West" : "East");
      await loadGameData(false);
    }

    setShowResetGameConfirm(false);
  } catch (e) {
    console.log("RESTART GAME ERROR:", e);
  } finally {
    setSavingGameState(false);
  }
}

async function resetAnnouncerChanges() {
  try {
    setResettingAnnouncerChanges(true);

    const response = await adminFetch(
      `${API_BASE}/api/lineups/${selectedGame.divisionId}/reset-announcer-changes`,
      { method: "POST" }
    );

    const json = await response.json();

    if (!json?.ok) {
      console.log("RESET ANNOUNCER CHANGES FAILED:", json);
      return;
    }

    setShowResetAnnouncerConfirm(false);
    await loadLineupDataOnly();
    setLiveLabel("🟢 ANNOUNCER CHANGES RESET");
    setTimeout(() => setLiveLabel("🟢 LIVE LINEUP FEED"), 2500);
  } catch (e) {
    console.log("RESET ANNOUNCER CHANGES ERROR:", e);
  } finally {
    setResettingAnnouncerChanges(false);
  }
}

function openJerseyEditor(player: Player, squad: Squad) {
  setEditingPlayer(player);
  setEditingSquad(squad);
  setPlayerNameDraft(String(player.name || ""));
  setJerseyNumberDraft(String(player.jerseyNumber || ""));
  setShowJerseyEditor(true);
}

function closeJerseyEditor() {
  if (savingJerseyNumber) return;

  setShowJerseyEditor(false);
  setEditingPlayer(null);
  setPlayerNameDraft("");
  setJerseyNumberDraft("");
}

async function saveJerseyNumber() {
  if (!editingPlayer) return;

  try {
    setSavingJerseyNumber(true);

    const batting = editingSquad === "East" ? eastBatting : westBatting;
    const subs = editingSquad === "East" ? eastSubs : westSubs;

    const updatedPlayers = [...batting, ...subs].map((player) =>
      player.id === editingPlayer.id
        ? {
            ...player,
            name: playerNameDraft.trim() || player.name,
            jerseyNumber: jerseyNumberDraft.trim(),
          }
        : player
    );

    const response = await adminFetch(`${API_BASE}/api/lineups/save`, {
      method: "POST",
      body: JSON.stringify({
        divisionId: selectedGame.divisionId,
        squad: editingSquad,
        players: updatedPlayers,
      }),
    });

    const json = await response.json();

    if (!json?.ok) {
      console.log("PLAYER SAVE FAILED:", json);
      return;
    }

    setShowJerseyEditor(false);
    setEditingPlayer(null);
    setPlayerNameDraft("");
    setJerseyNumberDraft("");

    await loadLineupDataOnly();
  } catch (e) {
    console.log("SAVE PLAYER ERROR:", e);
  } finally {
    setSavingJerseyNumber(false);
  }
}

function openManagerEditor(squad: Squad) {
  setEditingManagerSquad(squad);
  setManagerNameDraft(squad === "East" ? eastManager : westManager);
  setShowManagerEditor(true);
}

function closeManagerEditor() {
  if (savingManagerName) return;
  setShowManagerEditor(false);
  setManagerNameDraft("");
}

async function saveManagerName() {
  try {
    setSavingManagerName(true);

    const players = editingManagerSquad === "East"
      ? [...eastBatting, ...eastSubs]
      : [...westBatting, ...westSubs];

    const response = await adminFetch(`${API_BASE}/api/lineups/save`, {
      method: "POST",
      body: JSON.stringify({
        divisionId: selectedGame.divisionId,
        squad: editingManagerSquad,
        players,
        managerName: managerNameDraft.trim(),
      }),
    });

    const json = await response.json();

    if (!json?.ok) {
      console.log("MANAGER NAME SAVE FAILED:", json);
      return;
    }

    setShowManagerEditor(false);
    setManagerNameDraft("");
    await loadLineupDataOnly();
  } catch (e) {
    console.log("SAVE MANAGER NAME ERROR:", e);
  } finally {
    setSavingManagerName(false);
  }
}

  function speakPlayerName(player: Player) {
    const playerName = String(player?.name || "").trim();

    if (!playerName) return;

    const spokenName =
      String(player.pronunciation || "").trim() ||
      PRONUNCIATION_OVERRIDES[playerName] ||
      playerName;

    Speech.stop();
    Speech.speak(spokenName, {
      language: "en-US",
      rate: 0.82,
      pitch: 1,
    });
  }

  function renderPronunciationButton(
    player: Player,
    compact = false,
    light = false
  ) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Hear pronunciation for ${player.name}`}
        onPress={() => speakPlayerName(player)}
        hitSlop={8}
        style={[
          styles.pronunciationButton,
          compact && styles.pronunciationButtonCompact,
          light && styles.pronunciationButtonLight,
        ]}
      >
        <Ionicons
          name="volume-high-outline"
          size={compact ? 18 : 21}
          color={light ? "#ffffff" : "#1f4e9e"}
        />
      </Pressable>
    );
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

<Pressable
  onPress={() => openJerseyEditor(player, player.squad)}
  style={styles.editableJersey}
  accessibilityRole="button"
  accessibilityLabel={`Edit jersey number for ${player.name}`}
>
  <Text style={isMain ? styles.jerseyLarge : styles.jerseySmall}>
    #{player.jerseyNumber || "--"}
  </Text>

  <Ionicons
    name="pencil-outline"
    size={isMain ? 18 : 15}
    color={isMain ? "#facc15" : "#6b7280"}
    style={{ marginLeft: 5 }}
  />
</Pressable>

            <View style={styles.featuredNameRow}>
              <Pressable
                onPress={() => openJerseyEditor(player, player.squad)}
                style={styles.editableName}
                accessibilityRole="button"
                accessibilityLabel={`Edit player name for ${player.name}`}
              >
                <Text
                  style={[
                    isMain ? styles.playerNameLarge : styles.playerNameMedium,
                    styles.featuredNameText,
                  ]}
                >
                  {player.name}
                </Text>
                <Ionicons
                  name="pencil-outline"
                  size={isMain ? 17 : 14}
                  color={isMain ? "#ffffff" : "#6b7280"}
                  style={{ marginLeft: 5 }}
                />
              </Pressable>
              {renderPronunciationButton(player, !isMain, isMain)}
            </View>

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

<Pressable
  onPress={() => openJerseyEditor(player, squad)}
  style={styles.compactJerseyEdit}
  accessibilityRole="button"
  accessibilityLabel={`Edit jersey number for ${player.name}`}
>
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

  <Ionicons
    name="pencil-outline"
    size={13}
    color="#6b7280"
  />
</Pressable>

        <View style={styles.compactPlayerInfo}>
          <View style={styles.compactNameRow}>
            <Pressable
              onPress={() => openJerseyEditor(player, squad)}
              style={styles.compactEditableName}
              accessibilityRole="button"
              accessibilityLabel={`Edit player name for ${player.name}`}
            >
              <Text style={[styles.compactPlayerName, styles.playerNameFlex]}>
                {player.name}
              </Text>
              <Ionicons name="pencil-outline" size={13} color="#6b7280" style={{ marginLeft: 5 }} />
            </Pressable>
            {renderPronunciationButton(player, true)}
          </View>
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
<Pressable
  onPress={() => openJerseyEditor(player, squad)}
  style={styles.compactJerseyEdit}
  accessibilityRole="button"
  accessibilityLabel={`Edit jersey number for ${player.name}`}
>
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

  <Ionicons
    name="pencil-outline"
    size={13}
    color="#6b7280"
  />
</Pressable>

        <View style={styles.compactPlayerInfo}>
          <View style={styles.compactNameRow}>
            <Pressable
              onPress={() => openJerseyEditor(player, squad)}
              style={styles.compactEditableName}
              accessibilityRole="button"
              accessibilityLabel={`Edit player name for ${player.name}`}
            >
              <Text style={[styles.compactPlayerName, styles.playerNameFlex]}>
                {player.name}
              </Text>
              <Ionicons name="pencil-outline" size={13} color="#6b7280" style={{ marginLeft: 5 }} />
            </Pressable>
            {renderPronunciationButton(player, true)}
          </View>
          <Text style={styles.compactPlayerMeta}>
            {player.position || "POS"} • {player.teamName || "Team"}
          </Text>
        </View>
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
            {controlView === "lineups" ? (
              <Pressable
                style={styles.changeGameTopButton}
                onPress={() => router.replace("/announcercontrol-games")}
              >
                <View style={styles.buttonContentRow}>
                  <Ionicons name="calendar-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.topButtonText}>Change Game</Text>
                </View>
              </Pressable>
            ) : (
              <Pressable style={styles.lineupsTopButton} onPress={() => setControlView("lineups")}>
                <View style={styles.buttonContentRow}>
                  <Ionicons name="arrow-back-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.topButtonText}>Lineups</Text>
                </View>
              </Pressable>
            )}


            <Pressable
              style={styles.gameInformationTopButton}
              onPress={() =>
                router.push({
                  pathname: "/announcerinformation",
                  params: {
                    gameId: selectedGame.id,
                    divisionId: selectedGame.divisionId,
                    gameTitle,
                  },
                })
              }
            >
              <View style={styles.buttonContentRow}>
                <Ionicons name="reader-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.topButtonText}>Game Info</Text>
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
            <Text style={styles.screenModeTitle}>{controlView === "lineups" ? "TEAM LINEUPS" : "GAME CONTROL"}</Text>
            <Text style={styles.liveStatusText}>{liveLabel}</Text>
            <Text style={styles.lastUpdatedText}>{refreshAge}</Text>

            {controlView === "lineups" ? (
              <View style={styles.lineupActionButtons}>
                <Pressable
                  style={styles.gameControlNavButton}
                  onPress={() => setControlView("game")}
                >
                  <Ionicons name="baseball-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.gameControlNavButtonText}>Game Control</Text>
                </Pressable>

                <Pressable
                  style={styles.undoEditsButton}
                  onPress={() => setShowResetAnnouncerConfirm(true)}
                  disabled={resettingAnnouncerChanges}
                >
                  <Ionicons name="arrow-undo-outline" size={18} color="#111827" style={{ marginRight: 6 }} />
                  <Text style={styles.undoEditsButtonText}>Undo Edits</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.loadingPanel}>
              <ActivityIndicator size="large" color="#1f4e9e" />
              <Text style={styles.loadingText}>Loading Game...</Text>
            </View>
          ) : controlView === "lineups" ? (
            <>
              <View style={[styles.lineupsWorkspace, !isWideScreen && styles.lineupsWorkspaceMobile]}>
                <View style={[styles.lineupTeamCard, !isWideScreen && styles.lineupTeamCardMobile]}>
                  <View style={styles.lineupTeamIdentity}>
                    <Image source={require("../assets/East.png")} style={styles.lineupTeamLogo} resizeMode="contain" />
                    <Text style={styles.lineupEastTitle}>EAST ALL-STARS</Text>
                    <Pressable
                      onPress={() => openManagerEditor("East")}
                      style={styles.lineupManagerEdit}
                      accessibilityRole="button"
                      accessibilityLabel="Edit East manager name"
                    >
                      <Text style={styles.lineupManagerName}>Manager: {eastManager || "TBD"}</Text>
                      <Ionicons name="pencil-outline" size={15} color="#6b7280" style={{ marginLeft: 6 }} />
                    </Pressable>
                  </View>

                  <View style={[styles.panelHeaderTeam, styles.eastHeader]}>
                    <Text style={styles.panelHeaderText}>EAST BATTING LINEUP ({eastBatting.length})</Text>
                  </View>
                  {eastBatting.length > 0 ? eastBatting.map((player, index) => renderCompactPlayerRow(player, "East", index, eastGameState.currentBatterIndex)) : (
                    <Text style={styles.emptyPanelText}>No saved batting lineup yet.</Text>
                  )}

                  <View style={[styles.panelHeaderTeam, styles.eastHeader, styles.subHeaderSpacing]}>
                    <Text style={styles.panelHeaderText}>EAST SUBSTITUTES</Text>
                  </View>
                  {eastSubs.length > 0 ? eastSubs.map((player) => renderCompactSubRow(player, "East")) : (
                    <Text style={styles.emptyPanelText}>No substitutes listed.</Text>
                  )}
                </View>

                <View style={[styles.lineupTeamCard, !isWideScreen && styles.lineupTeamCardMobile]}>
                  <View style={styles.lineupTeamIdentity}>
                    <Image source={require("../assets/West.png")} style={styles.lineupTeamLogo} resizeMode="contain" />
                    <Text style={styles.lineupWestTitle}>WEST ALL-STARS</Text>
                    <Pressable
                      onPress={() => openManagerEditor("West")}
                      style={styles.lineupManagerEdit}
                      accessibilityRole="button"
                      accessibilityLabel="Edit West manager name"
                    >
                      <Text style={styles.lineupManagerName}>Manager: {westManager || "TBD"}</Text>
                      <Ionicons name="pencil-outline" size={15} color="#6b7280" style={{ marginLeft: 6 }} />
                    </Pressable>
                  </View>

                  <View style={[styles.panelHeaderTeam, styles.westHeader]}>
                    <Text style={styles.panelHeaderText}>WEST BATTING LINEUP ({westBatting.length})</Text>
                  </View>
                  {westBatting.length > 0 ? westBatting.map((player, index) => renderCompactPlayerRow(player, "West", index, westGameState.currentBatterIndex)) : (
                    <Text style={styles.emptyPanelText}>No saved batting lineup yet.</Text>
                  )}

                  <View style={[styles.panelHeaderTeam, styles.westHeader, styles.subHeaderSpacing]}>
                    <Text style={styles.panelHeaderText}>WEST SUBSTITUTES</Text>
                  </View>
                  {westSubs.length > 0 ? westSubs.map((player) => renderCompactSubRow(player, "West")) : (
                    <Text style={styles.emptyPanelText}>No substitutes listed.</Text>
                  )}
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.newGameBoard, !isWideScreen && styles.newGameBoardMobile, { borderColor: gameAccentColor }]}>
                <View style={styles.inningBanner}>
                  <Text style={styles.inningBannerText}>{activeGameState.half.toUpperCase()} {activeGameState.inning}</Text>
                </View>

                <View style={[styles.gameBoardColumns, !isWideScreen && styles.gameBoardColumnsMobile]}>
                  <View style={[styles.teamControlColumn, !isWideScreen && styles.teamControlColumnMobile]}>
                    <Image source={require("../assets/East.png")} style={styles.gameTeamLogo} resizeMode="contain" />
                    <Text style={styles.gameEastName}>EAST</Text>
                    <Text style={styles.homeVisitorLabel}>{visitorSquad === "East" ? "VISITOR" : "HOME"}</Text>
                    <Text style={styles.gameScoreLarge}>{Number(activeGameState.eastScore || 0)}</Text>
                    <Text style={styles.gameDugout}>{eastDugout}</Text>
                    <Pressable onPress={() => openManagerEditor("East")} style={styles.gameManagerEdit}>
                      <Text style={styles.gameManagerText}>Manager: {eastManager || "TBD"}</Text>
                      <Ionicons name="pencil-outline" size={15} color="#cbd5e1" style={{ marginLeft: 6 }} />
                    </Pressable>
                    <View style={styles.teamScoreControls}>
                      <Pressable style={styles.teamControlButtonRed} onPress={() => updateScore("East", -1)}><Text style={styles.teamControlButtonText}>− Score</Text></Pressable>
                      <Pressable style={styles.teamControlButtonGreen} onPress={() => updateScore("East", 1)}><Text style={styles.teamControlButtonText}>+ Score</Text></Pressable>
                    </View>
                    <View style={styles.outDisplayRow}><Text style={styles.outDots}>{"●".repeat(Number(activeGameState.outs || 0))}{"○".repeat(3 - Number(activeGameState.outs || 0))}</Text><Text style={styles.outCountText}>{Number(activeGameState.outs || 0)} OUTS</Text></View>
                    <View style={styles.sideButtonGrid}>
                      <Pressable style={styles.sideYellowButton} onPress={addOut}><Text style={styles.sideDarkText}>+1 Out</Text></Pressable>
                      <Pressable style={styles.sideGrayButton} onPress={clearOuts}><Text style={styles.sideLightText}>Clear Outs</Text></Pressable>
                      <Pressable style={styles.sideGreenButton} onPress={() => setShowSwitchSidesConfirm(true)}><Text style={styles.sideLightText}>End Half-Inning</Text></Pressable>
                      <Pressable style={styles.sideBlueButton} onPress={goBackHalfInning}><Text style={styles.sideLightText}>Previous Half</Text></Pressable>
                    </View>
                    <View style={[styles.pitcherCard, defensiveSquad === "East" ? styles.pitcherActiveEast : styles.pitcherInactive]}>
                      <Text style={[styles.pitcherHeading, defensiveSquad !== "East" && styles.pitcherInactiveText]}>PITCHING</Text>
                      <Text style={[styles.pitcherName, defensiveSquad !== "East" && styles.pitcherInactiveText]}>{eastPitcher ? `#${eastPitcher.jerseyNumber || "--"}  ${eastPitcher.name}` : "Pitcher Not Set"}</Text>
                      <Text style={[styles.pitcherMeta, defensiveSquad !== "East" && styles.pitcherInactiveText]}>{eastPitcher?.teamName || "East All-Stars"}</Text>
                    </View>
                  </View>

                  <View style={[styles.batterCenterColumn, !isWideScreen && styles.batterCenterColumnMobile]}>
                    <View style={[styles.nowBattingHeader, activeSquad === "East" ? styles.eastHeader : styles.westHeader]}><Text style={styles.panelHeaderText}>NOW BATTING</Text></View>
                    <View style={[styles.activeSquadStrip, activeSquad === "East" ? styles.eastStrip : styles.westStrip]}>
                      <Image source={activeSquad === "East" ? require("../assets/East.png") : require("../assets/West.png")} style={styles.activeSquadMiniLogo} resizeMode="contain" />
                      <Text style={styles.activeSquadStripText}>{activeSquad.toUpperCase()} BATTING</Text>
                    </View>
                    {renderFeaturedPlayer("NOW BATTING", currentBatter, activeGameState.currentBatterIndex + 1, true)}
                    <View style={styles.upNextRow}>
                      <View style={styles.upNextColumn}>{renderFeaturedPlayer("ON DECK", onDeckBatter, activeGameState.currentBatterIndex + 2)}</View>
                      <View style={styles.upNextColumn}>{renderFeaturedPlayer("IN THE HOLE", inHoleBatter, activeGameState.currentBatterIndex + 3)}</View>
                    </View>
                    <View style={styles.controlButtonRow}>
                      <Pressable style={styles.previousButton} onPress={() => moveBatter("previous")} disabled={savingGameState || !activeBatting.length}><Text style={styles.controlButtonText}>‹ Previous Batter</Text></Pressable>
                      <Pressable style={styles.nextButton} onPress={() => moveBatter("next")} disabled={savingGameState || !activeBatting.length}><Text style={styles.controlButtonText}>Next Batter ›</Text></Pressable>
                    </View>
                    <Pressable style={styles.restartGameWideButton} onPress={() => setShowResetGameConfirm(true)}>
                      <View style={styles.restartGameButtonContent}>
                        <Ionicons name="ban-outline" size={20} color="#ffffff" />
                        <Text style={styles.sideLightText}>Restart Game</Text>
                        <Ionicons name="ban-outline" size={20} color="#ffffff" />
                      </View>
                    </Pressable>
                  </View>

                  <View style={[styles.teamControlColumn, !isWideScreen && styles.teamControlColumnMobile]}>
                    <Image source={require("../assets/West.png")} style={styles.gameTeamLogo} resizeMode="contain" />
                    <Text style={styles.gameWestName}>WEST</Text>
                    <Text style={styles.homeVisitorLabel}>{visitorSquad === "West" ? "VISITOR" : "HOME"}</Text>
                    <Text style={styles.gameScoreLarge}>{Number(activeGameState.westScore || 0)}</Text>
                    <Text style={styles.gameDugout}>{westDugout}</Text>
                    <Pressable onPress={() => openManagerEditor("West")} style={styles.gameManagerEdit}>
                      <Text style={styles.gameManagerText}>Manager: {westManager || "TBD"}</Text>
                      <Ionicons name="pencil-outline" size={15} color="#cbd5e1" style={{ marginLeft: 6 }} />
                    </Pressable>
                    <View style={styles.teamScoreControls}>
                      <Pressable style={styles.teamControlButtonRed} onPress={() => updateScore("West", -1)}><Text style={styles.teamControlButtonText}>− Score</Text></Pressable>
                      <Pressable style={styles.teamControlButtonGreen} onPress={() => updateScore("West", 1)}><Text style={styles.teamControlButtonText}>+ Score</Text></Pressable>
                    </View>
                    <View style={styles.outDisplayRow}><Text style={styles.outDots}>{"●".repeat(Number(activeGameState.outs || 0))}{"○".repeat(3 - Number(activeGameState.outs || 0))}</Text><Text style={styles.outCountText}>{Number(activeGameState.outs || 0)} OUTS</Text></View>
                    <View style={styles.sideButtonGrid}>
                      <Pressable style={styles.sideYellowButton} onPress={addOut}><Text style={styles.sideDarkText}>+1 Out</Text></Pressable>
                      <Pressable style={styles.sideGrayButton} onPress={clearOuts}><Text style={styles.sideLightText}>Clear Outs</Text></Pressable>
                      <Pressable style={styles.sideGreenButton} onPress={() => setShowSwitchSidesConfirm(true)}><Text style={styles.sideLightText}>End Half-Inning</Text></Pressable>
                      <Pressable style={styles.sideBlueButton} onPress={goBackHalfInning}><Text style={styles.sideLightText}>Previous Half</Text></Pressable>
                    </View>
                    <View style={[styles.pitcherCard, defensiveSquad === "West" ? styles.pitcherActiveWest : styles.pitcherInactive]}>
                      <Text style={[styles.pitcherHeading, defensiveSquad !== "West" && styles.pitcherInactiveText]}>PITCHING</Text>
                      <Text style={[styles.pitcherName, defensiveSquad !== "West" && styles.pitcherInactiveText]}>{westPitcher ? `#${westPitcher.jerseyNumber || "--"}  ${westPitcher.name}` : "Pitcher Not Set"}</Text>
                      <Text style={[styles.pitcherMeta, defensiveSquad !== "West" && styles.pitcherInactiveText]}>{westPitcher?.teamName || "West All-Stars"}</Text>
                    </View>
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
          style={styles.confirmRestartButton}
          onPress={resetActiveGame}
        >
          <Text style={styles.cancelButtonText}>Restart Game</Text>
        </Pressable>
      </View>
    </View>
  </View>
</Modal>
<Modal
  visible={showResetAnnouncerConfirm}
  transparent
  animationType="fade"
  onRequestClose={() => {
    if (!resettingAnnouncerChanges) setShowResetAnnouncerConfirm(false);
  }}
>
  <View style={styles.modalOverlay}>
    <View style={styles.gamePickerCard}>
      <Text style={styles.modalTitle}>Undo Player / Manager Edits?</Text>

      <Text style={styles.confirmText}>
        This will restore player names, jersey numbers, and manager names to the original roster / assignment values for this game.

        {"\n\n"}This will NOT change:
        {"\n"}• Batting order
        {"\n"}• Batting / substitute status
        {"\n"}• Positions
        {"\n"}• Score, inning, outs, or current batter
      </Text>

      <View style={styles.confirmButtonRow}>
        <Pressable
          style={styles.confirmNoButton}
          onPress={() => setShowResetAnnouncerConfirm(false)}
          disabled={resettingAnnouncerChanges}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>

        <Pressable
          style={styles.resetConfirmButton}
          onPress={resetAnnouncerChanges}
          disabled={resettingAnnouncerChanges}
        >
          <Text style={styles.cancelButtonText}>
            {resettingAnnouncerChanges ? "Resetting..." : "Yes, Reset Changes"}
          </Text>
        </Pressable>
      </View>
    </View>
  </View>
</Modal>

<Modal
  visible={showJerseyEditor}
  transparent
  animationType="fade"
  onRequestClose={closeJerseyEditor}
>
  <View style={styles.modalOverlay}>
    <View style={styles.jerseyEditorCard}>
      <Text style={styles.modalTitle}>Edit Player</Text>

      <Text style={styles.jerseyEditorTeamName}>
        {editingPlayer?.teamName || ""}
      </Text>

      <Text style={styles.jerseyEditorLabel}>Player Name</Text>

      <TextInput
        value={playerNameDraft}
        onChangeText={setPlayerNameDraft}
        style={styles.playerNameEditorInput}
        placeholder="Player Name"
        placeholderTextColor="#9ca3af"
        autoFocus
        maxLength={80}
        selectTextOnFocus
      />

      <Text style={styles.jerseyEditorLabel}>Jersey Number</Text>

      <TextInput
        value={jerseyNumberDraft}
        onChangeText={setJerseyNumberDraft}
        style={styles.jerseyEditorInput}
        placeholder="Number"
        placeholderTextColor="#9ca3af"
        maxLength={4}
        selectTextOnFocus
        onSubmitEditing={saveJerseyNumber}
      />

      <View style={styles.confirmButtonRow}>
        <Pressable
          style={styles.confirmNoButton}
          onPress={closeJerseyEditor}
          disabled={savingJerseyNumber}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>

        <Pressable
          style={styles.confirmYesButton}
          onPress={saveJerseyNumber}
          disabled={savingJerseyNumber}
        >
          <Text style={styles.cancelButtonText}>
            {savingJerseyNumber ? "Saving..." : "Save Player"}
          </Text>
        </Pressable>
      </View>
    </View>
  </View>
</Modal>

<Modal
  visible={showManagerEditor}
  transparent
  animationType="fade"
  onRequestClose={closeManagerEditor}
>
  <View style={styles.modalOverlay}>
    <View style={styles.jerseyEditorCard}>
      <Text style={styles.modalTitle}>Edit Manager</Text>
      <Text style={styles.jerseyEditorTeamName}>
        {editingManagerSquad} All-Stars
      </Text>
      <Text style={styles.jerseyEditorLabel}>Manager Name</Text>
      <TextInput
        value={managerNameDraft}
        onChangeText={setManagerNameDraft}
        style={styles.playerNameEditorInput}
        placeholder="Manager Name"
        placeholderTextColor="#9ca3af"
        autoFocus
        maxLength={80}
        selectTextOnFocus
        onSubmitEditing={saveManagerName}
      />
      <View style={styles.confirmButtonRow}>
        <Pressable
          style={styles.confirmNoButton}
          onPress={closeManagerEditor}
          disabled={savingManagerName}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={styles.confirmYesButton}
          onPress={saveManagerName}
          disabled={savingManagerName}
        >
          <Text style={styles.cancelButtonText}>
            {savingManagerName ? "Saving..." : "Save Manager"}
          </Text>
        </Pressable>
      </View>
    </View>
  </View>
</Modal>
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
  gameInformationTopButton: {
    backgroundColor: "#374151",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
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
  titleArea: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginTop: 10,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
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
  mobileScoreboard: {
    paddingHorizontal: 6,
  },
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
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  desktopWorkspaceMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  mobileColumn: {
    width: "100%",
    flex: 0,
  },
  featureColumn: { flex: 1.05, minWidth: 0 },
  lineupColumn: { flex: 0.9, minWidth: 0 },
  sideColumn: {
    flex: 0.9,
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
  panelHeaderGreen: {
    backgroundColor: "#15803d",
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
    backgroundColor: "#111827",
    padding: 12,
    alignItems: "center",
    margin: 8,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#facc15",
  },
  currentBatterLabel: { display: "none" },
  orderNumberLarge: { color: "#93c5fd", fontSize: 13, fontWeight: "900" },
  jerseyLarge: { color: "#facc15", fontSize: 26, fontWeight: "900", marginTop: 3 },
  playerNameLarge: { color: "#ffffff", fontSize: 23, fontWeight: "900", textAlign: "center" },
  playerMetaLarge: {
    color: "#d1d5db",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 5,
  },
  playerPositionLarge: { color: "#facc15", fontSize: 15, fontWeight: "900", marginTop: 2 },
  upNextRow: { flexDirection: "row", gap: 9, paddingHorizontal: 10, marginBottom: 10 },
  upNextColumn: { flex: 1 },
  upNextCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#d6dee8",
    padding: 8,
    alignItems: "center",
    minHeight: 105,
  },
  upNextLabel: { color: "#1f4e9e", fontSize: 13, fontWeight: "900", marginBottom: 4 },
  orderNumberSmall: { color: "#6b7280", fontSize: 11, fontWeight: "900" },
  jerseySmall: { color: "#d71920", fontSize: 19, fontWeight: "900" },
  playerNameMedium: { color: "#111827", fontSize: 14, fontWeight: "900", textAlign: "center" },
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
    minHeight: 58,
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
    height: 120,
    backgroundColor: "#4b5563",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  nextButton: {
    flex: 1,
    height: 120,
    backgroundColor: "#1d4ed8",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  controlButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  featuredNameRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  featuredNameText: {
    flexShrink: 1,
  },
  playerNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  compactNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  playerNameFlex: {
    flex: 1,
  },
  pronunciationButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  pronunciationButtonCompact: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginLeft: 6,
  },
  pronunciationButtonLight: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  homeVisitorLabel: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginTop: 2,
  },
  battingRoleText: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },
  homeVisitorControl: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  homeVisitorAssignments: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  assignmentPill: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  assignmentLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "900",
  },
  assignmentTeam: {
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  assignmentEast: {
    color: "#d71920",
  },
  assignmentWest: {
    color: "#174ea6",
  },
  swapHomeVisitorButton: {
    marginTop: 8,
    backgroundColor: "#000000",
    borderRadius: 9,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  swapHomeVisitorButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  footer: { marginTop: 12, alignItems: "center" },
  footerText: { color: "#6b7280", fontSize: 12, fontWeight: "700" },


  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  gamePickerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    width: "88%",
    maxWidth: 620,
    maxHeight: "90%",
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 12,
  },

  modalTitle: {
    color: "#1f4e9e",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 14,
  },

  confirmText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "left",
    marginBottom: 18,
  },

  confirmButtonRow: {
    flexDirection: "row",
    gap: 10,
  },

  confirmNoButton: {
    flex: 1,
    backgroundColor: "#6b7280",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },

  confirmYesButton: {
    flex: 1,
    backgroundColor: "#15803d",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },

  confirmRestartButton: {
    flex: 1,
    backgroundColor: "#991b1b",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },

  cancelButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },

  lineupActionButtons: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  gameControlNavButton: {
    backgroundColor: "#15803d",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 160,
  },
  lineupsNavButton: {
    marginTop: 12,
    backgroundColor: "#15803d",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  gameControlNavButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  undoEditsButton: {
    backgroundColor: "#facc15",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 160,
  },
  undoEditsButtonText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },
  lineupsWorkspace: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    marginTop: 16,
  },
  lineupsWorkspaceMobile: {
    flexDirection: "column",
  },
  lineupTeamCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  lineupTeamCardMobile: {
    width: "100%",
  },
  lineupTeamIdentity: {
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 14,
  },
  lineupTeamLogo: {
    width: 105,
    height: 105,
    marginBottom: 5,
  },
  lineupEastTitle: {
    color: "#d71920",
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
  },
  lineupWestTitle: {
    color: "#174ea6",
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
  },
  lineupManagerEdit: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  lineupManagerName: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },
  subHeaderSpacing: {
    marginTop: 14,
  },

  resetAnnouncerButton: {
    marginTop: 12,
    backgroundColor: "#b45309",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },

  resetAnnouncerButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  resetConfirmButton: {
    flex: 1,
    backgroundColor: "#b45309",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },

  editableJersey: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
},

compactJerseyEdit: {
  width: 76,
  flexDirection: "row",
  alignItems: "center",
},

jerseyEditorCard: {
  backgroundColor: "#ffffff",
  borderRadius: 20,
  padding: 22,
  width: "88%",
  maxWidth: 420,
  shadowColor: "#000000",
  shadowOpacity: 0.22,
  shadowRadius: 18,
  shadowOffset: {
    width: 0,
    height: 8,
  },
  elevation: 12,
},

jerseyEditorPlayerName: {
  color: "#111827",
  fontSize: 22,
  fontWeight: "900",
  textAlign: "center",
},

jerseyEditorTeamName: {
  color: "#6b7280",
  fontSize: 14,
  fontWeight: "700",
  textAlign: "center",
  marginTop: 3,
  marginBottom: 20,
},

jerseyEditorLabel: {
  color: "#374151",
  fontSize: 13,
  fontWeight: "900",
  marginBottom: 6,
},

jerseyEditorInput: {
  borderWidth: 2,
  borderColor: "#1f4e9e",
  borderRadius: 10,
  backgroundColor: "#ffffff",
  color: "#111827",
  fontSize: 28,
  fontWeight: "900",
  textAlign: "center",
  paddingVertical: 10,
  paddingHorizontal: 12,
  marginBottom: 20,
},

  editableName: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 1,
  },
  compactEditableName: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  editableManager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  playerNameEditorInput: {
    borderWidth: 2,
    borderColor: "#1f4e9e",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },

  lineupsTopButton: { backgroundColor: "#1d4ed8", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 9 },
  newGameBoard: { backgroundColor: "#0f172a", borderWidth: 3, borderRadius: 20, padding: 16, marginTop: 8 },
  newGameBoardMobile: { padding: 10 },
  inningBanner: { alignItems: "center", marginBottom: 10 },
  inningBannerText: { color: "#facc15", fontSize: 24, fontWeight: "900" },
  gameBoardColumns: { flexDirection: "row", alignItems: "stretch", gap: 14 },
  gameBoardColumnsMobile: { flexDirection: "column" },
  teamControlColumn: { flex: 0.9, alignItems: "center", minWidth: 250 },
  teamControlColumnMobile: { width: "100%" },
  batterCenterColumn: { flex: 1.45, backgroundColor: "#f8fafc", borderRadius: 14, overflow: "hidden", paddingBottom: 10 },
  batterCenterColumnMobile: { width: "100%" },
  gameTeamLogo: { width: 130, height: 85 },
  gameEastName: { color: "#ef4444", fontSize: 22, fontWeight: "900" },
  gameWestName: { color: "#60a5fa", fontSize: 22, fontWeight: "900" },
  gameScoreLarge: { color: "#ffffff", fontSize: 72, lineHeight: 78, fontWeight: "900", marginVertical: 2 },
  gameDugout: { color: "#e5e7eb", fontSize: 15, fontWeight: "800", marginTop: 2 },
  gameManagerEdit: { flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: 12 },
  gameManagerText: { color: "#e5e7eb", fontSize: 18, fontWeight: "900" },
  teamScoreControls: { flexDirection: "row", width: "100%", gap: 8, marginBottom: 10 },
  teamControlButtonRed: { flex: 1, height: 44, borderRadius: 8, backgroundColor: "#dc2626", alignItems: "center", justifyContent: "center" },
  teamControlButtonGreen: { flex: 1, height: 44, borderRadius: 8, backgroundColor: "#15803d", alignItems: "center", justifyContent: "center" },
  teamControlButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "900" },
  outDisplayRow: { alignItems: "center", minHeight: 58, marginBottom: 8 },
  outDots: { color: "#facc15", fontSize: 26, letterSpacing: 4, fontWeight: "900" },
  outCountText: { color: "#e5e7eb", fontSize: 14, fontWeight: "900" },
  sideButtonGrid: { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  sideYellowButton: { width: "48%", height: 44, borderRadius: 7, backgroundColor: "#facc15", alignItems: "center", justifyContent: "center" },
  sideGrayButton: { width: "48%", height: 44, borderRadius: 7, backgroundColor: "#64748b", alignItems: "center", justifyContent: "center" },
  sideGreenButton: { width: "48%", height: 44, borderRadius: 7, backgroundColor: "#15803d", alignItems: "center", justifyContent: "center" },
  sideBlueButton: { width: "48%", height: 44, borderRadius: 7, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  sideDarkText: { color: "#111827", fontSize: 14, fontWeight: "900" },
  sideLightText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  pitcherCard: { width: "100%", borderRadius: 10, padding: 12, minHeight: 90, justifyContent: "center" },
  pitcherActiveEast: { backgroundColor: "#fee2e2", borderWidth: 2, borderColor: "#dc2626" },
  pitcherActiveWest: { backgroundColor: "#dbeafe", borderWidth: 2, borderColor: "#1d4ed8" },
  pitcherInactive: { backgroundColor: "#374151", borderWidth: 2, borderColor: "#4b5563", opacity: 0.62 },
  pitcherHeading: { color: "#111827", fontSize: 17, fontWeight: "900", textAlign: "center", marginBottom: 7 },
  pitcherName: { color: "#111827", fontSize: 17, fontWeight: "900" },
  pitcherMeta: { color: "#4b5563", fontSize: 13, fontWeight: "700", marginTop: 3 },
  pitcherInactiveText: { color: "#cbd5e1" },
  nowBattingHeader: { paddingVertical: 10, alignItems: "center" },
  restartGameWideButton: { marginHorizontal: 10, marginTop: 10, height: 42, borderRadius: 8, backgroundColor: "#991b1b", alignItems: "center", justifyContent: "center" },
  restartGameButtonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
});
