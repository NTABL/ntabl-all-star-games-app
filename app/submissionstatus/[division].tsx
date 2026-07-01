import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { adminFetch, API_BASE } from "../../utils/appconfig";

type TeamStatus = {
  teamName: string;
  status: "Submitted" | "Draft Saved" | "Not Submitted";
  submittedAt?: string;
};

type DivisionStatus = {
  divisionId: string;
  division: string;
  submitted: number;
  draftSaved: number;
  notSubmitted: number;
  total: number;
  teams: TeamStatus[];
};

const divisionLogos: Record<string, any> = {
  open: require("../../assets/OpenACP.png"),
  veterans: require("../../assets/VeteransACP.png"),
  masters: require("../../assets/MastersACP.png"),
  regency: require("../../assets/RegencyACP.png"),
  rookie: require("../../assets/RookieACP.png"),
};

export default function DivisionSubmissionStatusScreen() {
  const params = useLocalSearchParams();
  const divisionId = String(params.division || "");

  const [loading, setLoading] = useState(true);
  const [division, setDivision] = useState<DivisionStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadDivisionStatus();
    }, [divisionId])
  );

  async function loadDivisionStatus() {
    try {
      setLoading(true);

      const response = await adminFetch(`${API_BASE}/api/admin/submission-status`);
      const json = await response.json();

      if (!json?.ok) {
        throw new Error(json?.message || "Unable to load division status.");
      }

      const foundDivision = Array.isArray(json.divisions)
        ? json.divisions.find((item: DivisionStatus) => item.divisionId === divisionId)
        : null;

      setDivision(foundDivision || null);
    } catch (e) {
      console.log("DIVISION SUBMISSION STATUS ERROR:", e);
      setDivision(null);
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string) {
    if (status === "Submitted") return "#15803d";
    if (status === "Draft Saved") return "#70700A";
    return "#c62828";
  }

  function renderStatusPill(status: string) {
    return (
      <View
        style={[
          styles.statusPill,
          {
            backgroundColor: getStatusColor(status),
          },
        ]}
      >
        <Text style={styles.statusPillText}>{status}</Text>
      </View>
    );
  }

  function getCompletionPercent() {
    if (!division?.total) return 0;
    return Math.round((division.submitted / division.total) * 100);
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#1f4e9e" />
          <Text style={styles.loadingText}>Loading division status...</Text>
        </View>
      </>
    );
  }

  if (!division) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.screen}>
          <View style={styles.container}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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

            <View style={styles.emptyCard}>
              <Ionicons
                name="alert-circle-outline"
                size={54}
                color="#c62828"
                style={{ marginBottom: 10 }}
              />
              <Text style={styles.emptyTitle}>Division Not Found</Text>
              <Text style={styles.emptyText}>
                Submission status could not be loaded for this division.
              </Text>
            </View>
          </View>
        </View>
      </>
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
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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
          </View>

          <View style={styles.heroCard}>
            <Image
              source={divisionLogos[division.divisionId] || require("../../assets/NTABL-Logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.title}>{division.division}</Text>

            <Text style={styles.subtitle}>
              Team All-Star Roster Submission Status
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Division Summary</Text>

            <Text style={styles.submittedText}>
              {division.submitted} of {division.total} Teams Submitted
            </Text>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: "#15803d" }]}>
                Submitted
              </Text>
              <Text style={[styles.summaryValue, { color: "#15803d" }]}>
                {division.submitted}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: "#70700A" }]}>
                Draft Saved
              </Text>
              <Text style={[styles.summaryValue, { color: "#70700A" }]}>
                {division.draftSaved}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: "#c62828" }]}>
                Not Submitted
              </Text>
              <Text style={[styles.summaryValue, { color: "#c62828" }]}>
                {division.notSubmitted}
              </Text>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${getCompletionPercent()}%` },
                ]}
              />

              <Text style={styles.progressText}>
                {getCompletionPercent()}% Complete
              </Text>
            </View>
          </View>

          <View style={styles.teamsCard}>
            <Text style={styles.teamsTitle}>Teams</Text>

            {division.teams.map((team) => (
              <View key={team.teamName} style={styles.teamRow}>
                <Text style={styles.teamName}>{team.teamName}</Text>
                {renderStatusPill(team.status)}
              </View>
            ))}
          </View>

          <Text style={styles.versionFooter}>
            NTABL All-Star App • Version 1.0
          </Text>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: "#eef2f7",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 16,
    color: "#1f4e9e",
    fontSize: 16,
    fontWeight: "800",
  },

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

  smallButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  backButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 13,
    alignSelf: "flex-start",
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
    alignItems: "center",
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

  logo: {
    width: 165,
    height: 105,
    marginBottom: 8,
  },

  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6b7280",
    textAlign: "center",
  },

  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
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

  summaryTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 8,
  },

  submittedText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
    marginBottom: 16,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  summaryLabel: {
    fontSize: 16,
    fontWeight: "800",
  },

  summaryValue: {
    fontSize: 18,
    fontWeight: "900",
  },

  progressTrack: {
    marginTop: 16,
    height: 25,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
    justifyContent: "center",
  },

  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#15803d",
  },

  progressText: {
    color: "#111827",
    fontWeight: "900",
    textAlign: "center",
    zIndex: 2,
  },

  teamsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
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

  teamsTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 12,
  },

  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },

  teamName: {
    flex: 1,
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
    paddingRight: 12,
  },

  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 112,
    alignItems: "center",
  },

  statusPillText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },

  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    marginTop: 18,
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

  emptyTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#c62828",
    textAlign: "center",
    marginBottom: 8,
  },

  emptyText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },

  versionFooter: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 18,
  },
});