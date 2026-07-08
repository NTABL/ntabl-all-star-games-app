import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
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

export default function WaiverManagementScreen() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [waivers, setWaivers] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);

  useEffect(() => {
    loadWaiverManagement();
  }, []);

  async function loadWaiverManagement() {
    try {
      setLoading(true);

      const configResponse = await fetch(`${API_BASE}/api/waivers/config`);
      const configJson = await configResponse.json();

      if (configJson?.ok) {
        setConfig(configJson.config);
      }

const statusResponse = await adminFetch(`${API_BASE}/api/admin/waivers/status`);
const statusJson = await statusResponse.json();

if (statusJson?.ok) {
  setConfig(statusJson.config || configJson.config);
  setDivisions(Array.isArray(statusJson.divisions) ? statusJson.divisions : []);
}
    } catch (e) {
      console.log("WAIVER MANAGEMENT ERROR:", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.replace("/admin")} style={styles.backButton}>
              <View style={styles.buttonContentRow}>
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

            <Text style={styles.title}>Waiver Management</Text>

            <Text style={styles.subtitle}>
              Manage Event Waiver Configuration and Signed Waiver Records.
            </Text>
          </View>

          {loading ? (
            <View style={styles.sectionCard}>
              <ActivityIndicator size="large" color="#660000" />
              <Text style={styles.loadingText}>Loading waiver data...</Text>
            </View>
          ) : (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionHeader}>Configuration</Text>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Waiver Year</Text>
                  <Text style={styles.infoValue}>{config?.waiverYear || "Not Set"}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Waiver Version</Text>
                  <Text style={styles.infoValue}>{config?.waiverVersion || "Not Set"}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Host</Text>
                  <Text style={styles.infoValue}>{config?.hostName || "Not Set"}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Venue</Text>
                  <Text style={styles.infoValue}>{config?.venueName || "Not Set"}</Text>
                </View>

                <View style={styles.statusBadgeRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: config?.active ? "#15803d" : "#c62828",
                      },
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {config?.active ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>
              </View>

<View style={styles.sectionCard}>
  <Text style={styles.sectionHeader}>Participant Status</Text>

  {divisions.map((division) => (
    <View key={division.divisionId} style={styles.divisionCard}>
      <Text style={styles.divisionTitle}>
        {division.divisionName}
      </Text>

      {["East", "West"].map((squad) => {
        const group = division.squads[squad];

        return (
          <View key={squad} style={styles.squadCard}>
            <Text style={styles.squadTitle}>
              {squad} All-Stars
            </Text>

            {group.manager && (
              <View style={styles.personRow}>
                <Ionicons
                  name={
                    group.manager.signed
                      ? "checkmark-circle"
                      : "close-circle"
                  }
                  size={22}
                  color={
                    group.manager.signed
                      ? "#15803d"
                      : "#c62828"
                  }
                />

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.personName}>
                    {group.manager.name}
                  </Text>

                  <Text style={styles.personRole}>
                    All-Star Manager
                  </Text>
                </View>
              </View>
            )}

            {group.players.map((player: any) => (
              <View
                key={player.id}
                style={styles.personRow}
              >
                <Ionicons
                  name={
                    player.signed
                      ? "checkmark-circle"
                      : "close-circle"
                  }
                  size={22}
                  color={
                    player.signed
                      ? "#15803d"
                      : "#c62828"
                  }
                />

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.personName}>
                    {player.name}
                  </Text>

                  <Text style={styles.personRole}>
                    {player.teamName}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  ))}
</View>
            </>
          )}
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
    fontWeight: "800",
    fontSize: 14,
  },

  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 22,
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

  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
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

  sectionHeader: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1f4e9e",
    marginBottom: 14,
    textAlign: "center",
  },

  loadingText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 10,
  },

  infoRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 10,
  },

  infoLabel: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  infoValue: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 3,
  },

  statusBadgeRow: {
    alignItems: "center",
    marginTop: 14,
  },

  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
  },

  statusBadgeText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  bigCount: {
    fontSize: 48,
    fontWeight: "900",
    color: "#660000",
    textAlign: "center",
  },

  countLabel: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },

  emptyText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 8,
  },

  waiverRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingVertical: 12,
  },

  waiverName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },

  waiverMeta: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4b5563",
    marginTop: 2,
    textTransform: "capitalize",
  },

  waiverDate: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    marginTop: 2,
  },

  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
  width: 150,
  height: 150,
  alignSelf: "center",
  marginBottom: 8,
},

divisionCard: {
  backgroundColor: "#eef4fb",
  borderRadius: 14,
  padding: 14,
  marginBottom: 16,
},

divisionTitle: {
  fontSize: 18,
  fontWeight: "900",
  color: "#1f4e9e",
  marginBottom: 12,
  textAlign: "center",
},

squadCard: {
  backgroundColor: "#ffffff",
  borderRadius: 12,
  padding: 12,
  marginBottom: 12,
},

squadTitle: {
  fontSize: 16,
  fontWeight: "900",
  color: "#660000",
  marginBottom: 10,
},

personRow: {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 8,
  borderBottomWidth: 1,
  borderBottomColor: "#eeeeee",
},

personName: {
  fontSize: 15,
  fontWeight: "800",
  color: "#111827",
},

personRole: {
  fontSize: 12,
  fontWeight: "700",
  color: "#6b7280",
},
});