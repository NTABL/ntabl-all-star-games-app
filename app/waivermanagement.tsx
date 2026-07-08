import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
  function openGame(game: GameOption) {
    router.push(`/waiverdivision/${game.divisionId}`);
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
    color: "#660000",
    textAlign: "center",
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6b7280",
    textAlign: "center",
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

  versionFooter: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 20,
  },
});