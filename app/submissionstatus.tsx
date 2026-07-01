import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { adminFetch, API_BASE } from "../utils/appconfig";

type TeamStatus = {
  teamName: string;
  status: "Submitted" | "Draft Saved" | "Not Submitted";
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

type SummaryTotals = {
  submitted: number;
  draftSaved: number;
  notSubmitted: number;
  totalTeams: number;
};

const divisionLogos: Record<string, any> = {
  open: require("../assets/OpenACP.png"),
  veterans: require("../assets/VeteransACP.png"),
  masters: require("../assets/MastersACP.png"),
  regency: require("../assets/RegencyACP.png"),
  rookie: require("../assets/RookieACP.png"),
};

export default function SubmissionStatusScreen() {
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<SummaryTotals>({
    submitted: 0,
    draftSaved: 0,
    notSubmitted: 0,
    totalTeams: 0,
  });
  const [divisions, setDivisions] = useState<DivisionStatus[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadSubmissionStatus();
    }, [])
  );

  async function loadSubmissionStatus() {
    try {
      setLoading(true);

      const response = await adminFetch(`${API_BASE}/api/admin/submission-status`);
      const json = await response.json();

      if (!json?.ok) {
        throw new Error(json?.message || "Unable to load submission status.");
      }

      setTotals(
        json.totals || {
          submitted: 0,
          draftSaved: 0,
          notSubmitted: 0,
          totalTeams: 0,
        }
      );

      setDivisions(Array.isArray(json.divisions) ? json.divisions : []);
    } catch (e) {
      console.log("SUBMISSION STATUS ERROR:", e);
      setDivisions([]);
    } finally {
      setLoading(false);
    }
  }

  function getCompletionPercent() {
    if (!totals.totalTeams) return 0;
    return Math.round((totals.submitted / totals.totalTeams) * 100);
  }

  function getDivisionColor(division: DivisionStatus) {
    if (division.total > 0 && division.submitted === division.total) {
      return "#15803d";
    }

    if (division.submitted > 0 || division.draftSaved > 0) {
      return "#70700A";
    }

    return "#c62828";
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#1f4e9e" />
          <Text style={styles.loadingText}>Loading submission status...</Text>
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
            <Pressable style={styles.backButton} onPress={() => router.back()}>
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
          </View>

          <View style={styles.heroCard}>
            <Image
              source={require("../assets/NTABL-Logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.title}>Team Submission Status</Text>

            <Text style={styles.subtitle}>
              Monitor All-Star Roster Submissions by Division
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>League Summary</Text>

            <Text style={styles.totalTeamsText}>{totals.totalTeams} Teams</Text>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: "#15803d" }]}>
                Submitted
              </Text>
              <Text style={[styles.summaryValue, { color: "#15803d" }]}>
                {totals.submitted}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: "#70700A" }]}>
                Draft Saved
              </Text>
              <Text style={[styles.summaryValue, { color: "#70700A" }]}>
                {totals.draftSaved}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: "#c62828" }]}>
                Not Submitted
              </Text>
              <Text style={[styles.summaryValue, { color: "#c62828" }]}>
                {totals.notSubmitted}
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

          {divisions.map((division) => (
            <Pressable
              key={division.divisionId}
              style={styles.divisionCard}
              onPress={() =>
                router.push({
                  pathname: "/submissionstatus/[division]",
                  params: { division: division.divisionId },
                })
              }
            >
              <Image
                source={
                  divisionLogos[division.divisionId] ||
                  require("../assets/NTABL-Logo.png")
                }
                style={styles.divisionLogo}
                resizeMode="contain"
              />

              <Text style={styles.divisionTitle}>{division.division}</Text>

              <Text
                style={[
                  styles.divisionSubmittedText,
                  { color: getDivisionColor(division) },
                ]}
              >
                {division.submitted} of {division.total} Teams Submitted
              </Text>

              <View style={styles.divisionSummaryGrid}>
                <View style={styles.divisionSummaryItem}>
                  <Text style={[styles.divisionSummaryNumber, { color: "#15803d" }]}>
                    {division.submitted}
                  </Text>
                  <Text style={styles.divisionSummaryLabel}>Submitted</Text>
                </View>

                <View style={styles.divisionSummaryItem}>
                  <Text style={[styles.divisionSummaryNumber, { color: "#70700A" }]}>
                    {division.draftSaved}
                  </Text>
                  <Text style={styles.divisionSummaryLabel}>Draft</Text>
                </View>

                <View style={styles.divisionSummaryItem}>
                  <Text style={[styles.divisionSummaryNumber, { color: "#c62828" }]}>
                    {division.notSubmitted}
                  </Text>
                  <Text style={styles.divisionSummaryLabel}>Missing</Text>
                </View>
              </View>

              <View style={styles.viewDivisionButton}>
                <View style={styles.smallButtonRow}>
                  <Ionicons
                    name="chevron-forward-circle-outline"
                    size={20}
                    color="#ffffff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.viewDivisionButtonText}>View Division</Text>
                </View>
              </View>
            </Pressable>
          ))}

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
  },

  backButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },

  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 18,
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

  logo: {
    width: 150,
    height: 150,
    marginBottom: 8,
  },

  title: {
    fontSize: 28,
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

  totalTeamsText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
    marginBottom: 14,
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
    textAlign: "center",
    color: "#111827",
    fontWeight: "900",
    zIndex: 2,
  },

  divisionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
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

  divisionLogo: {
    width: 145,
    height: 90,
    marginBottom: 8,
  },

  divisionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
  },

  divisionSubmittedText: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 14,
  },

  divisionSummaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 14,
  },

  divisionSummaryItem: {
    flex: 1,
    alignItems: "center",
  },

  divisionSummaryNumber: {
    fontSize: 22,
    fontWeight: "900",
  },

  divisionSummaryLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },

  viewDivisionButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    width: "100%",
    alignItems: "center",
  },

  viewDivisionButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
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
