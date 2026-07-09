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

  function statusIcon(ok: boolean) {
    return ok ? "checkmark-circle" : "alert-circle";
  }

  function statusColor(ok: boolean) {
    return ok ? "#15803d" : "#c62828";
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
                <View style={styles.row}>
                  <Ionicons
                    name={statusIcon(!!data?.ok)}
                    size={26}
                    color={statusColor(!!data?.ok)}
                  />
                  <Text style={styles.rowText}>
                    Backend: {data?.backend || "unknown"}
                  </Text>
                </View>

                <Text style={styles.label}>App Version</Text>
                <Text style={styles.value}>{data?.version || "1.0"}</Text>

                <Text style={styles.label}>Server Time</Text>
                <Text style={styles.value}>{data?.serverTime || "Not Loaded"}</Text>

                <Text style={styles.label}>Roster Cache</Text>
                <Text style={styles.value}>
                  {data?.rosterCache?.available ? "Available" : "Not Available"}
                </Text>

                <Text style={styles.label}>Roster Count</Text>
                <Text style={styles.value}>
                  {data?.rosterCache?.rosterCount ?? 0}
                </Text>

                <Text style={styles.label}>Raw LeagueApps Records</Text>
                <Text style={styles.value}>
                  {data?.rosterCache?.rawRecordCount ?? 0}
                </Text>

                <Text style={styles.label}>Signed Waivers</Text>
                <Text style={styles.value}>{data?.waivers?.signedCount ?? 0}</Text>

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
  row: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  rowText: {
    marginLeft: 8,
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
  },
  label: {
    marginTop: 12,
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  value: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 2,
  },
  errorText: {
    color: "#c62828",
    fontWeight: "900",
    textAlign: "center",
    marginTop: 18,
  },
  refreshButton: {
    marginTop: 22,
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