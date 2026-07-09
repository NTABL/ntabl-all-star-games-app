import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { API_BASE } from "../utils/appconfig";

export default function DiagnosticsScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadDiagnostics();
  }, []);

  async function loadDiagnostics() {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/diagnostics`);
      const json = await response.json();
      setData(json);
    } catch (e) {
      setData({
        ok: false,
        message: "Diagnostics could not be loaded.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back-outline" size={18} color="#ffffff" />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>

          <View style={styles.card}>
            <Text style={styles.title}>System Diagnostics</Text>

            {loading ? (
              <ActivityIndicator size="large" color="#1d4ed8" />
            ) : (
              <>
                <View style={styles.grid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Backend</Text>
                    <View style={styles.statusRow}>
                      <Ionicons
                        name={data?.ok ? "checkmark-circle" : "alert-circle"}
                        size={22}
                        color={data?.ok ? "#15803d" : "#c62828"}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.statValue}>
                        {data?.backend || "Unknown"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>App Version</Text>
                    <Text style={styles.statValue}>{data?.version || "1.0"}</Text>
                  </View>

                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Roster Cache</Text>
                    <Text style={styles.statValue}>
                      {data?.rosterCache?.available ? "Available" : "Not Available"}
                    </Text>
                  </View>

                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Signed Waivers</Text>
                    <Text style={styles.statValue}>
                      {data?.waivers?.signedCount ?? 0}
                    </Text>
                  </View>

                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Cached Players</Text>
                    <Text style={styles.statValue}>
                      {data?.rosterCache?.rosterCount ?? 0}
                    </Text>
                  </View>

                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>LeagueApps Records</Text>
                    <Text style={styles.statValue}>
                      {data?.rosterCache?.rawRecordCount ?? 0}
                    </Text>
                  </View>
                </View>

                <Text style={styles.serverTimeLabel}>Server Time</Text>
                <Text style={styles.serverTimeValue}>
                  {data?.serverTime || "Unknown"}
                </Text>

                {!data?.ok && (
                  <Text style={styles.errorText}>
                    {data?.message || "Diagnostics reported an issue."}
                  </Text>
                )}
              </>
            )}

            <Pressable style={styles.refreshButton} onPress={loadDiagnostics}>
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef2f7" },
  container: { flexGrow: 1, padding: 20, paddingTop: 50 },
  backButton: {
    flexDirection: "row",
    alignSelf: "flex-start",
    backgroundColor: "#1d4ed8",
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 13,
    alignItems: "center",
    marginBottom: 14,
  },
  backButtonText: { color: "#ffffff", fontWeight: "900", marginLeft: 4 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 4,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#f4f8fd",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#dbe5f1",
  },
  statLabel: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  statValue: {
    color: "#1f2937",
    fontSize: 18,
    fontWeight: "900",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  serverTimeLabel: {
    marginTop: 6,
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    textAlign: "center",
  },
  serverTimeValue: {
    textAlign: "center",
    color: "#1f2937",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 3,
    marginBottom: 12,
  },
  errorText: {
    color: "#c62828",
    fontWeight: "900",
    textAlign: "center",
    marginTop: 18,
  },
  refreshButton: {
    marginTop: 12,
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  refreshButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
});