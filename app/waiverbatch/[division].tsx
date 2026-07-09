import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { adminFetch, API_BASE } from "../../utils/appconfig";

type WaiverRecord = {
  key?: string;
  divisionId?: string;
  squad?: string;
  role?: string;
  personId?: string;
  leagueAppsId?: string;
  name?: string;
  age?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  teamName?: string;
  typedSignature?: string;
  signedAt?: string;
};

const GAMES: Record<string, any> = {
  regency: { gameLabel: "Game 1", title: "60+ All-Stars", divisionId: "regency" },
  masters: { gameLabel: "Game 2", title: "45+ All-Stars", divisionId: "masters" },
  veterans: { gameLabel: "Game 3", title: "30+ / Rookie Prospects", divisionId: "veterans" },
  open: { gameLabel: "Game 4", title: "18+ All-Stars", divisionId: "open" },
};

function formatPhone(phone?: string) {
  if (!phone) return "Not Listed";

  const digits = String(phone).replace(/\D/g, "").replace(/^1/, "");

  if (digits.length !== 10) return phone;

  return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
}

function formatAddress(waiver: WaiverRecord) {
  const address = [
    waiver.address,
    [waiver.city, waiver.state].filter(Boolean).join(", "),
    waiver.zip,
  ]
    .filter(Boolean)
    .join(" ");

  return address || "Not Listed";
}

function formatRole(role?: string) {
  const value = String(role || "").toLowerCase();

  if (value === "all-star-manager") return "All-Star Manager";
  if (value.includes("co-captain")) return "Co-Captain";
  if (value.includes("captain")) return "Captain";
  return "Player";
}

function renderGameLogo(divisionId: string) {
  if (divisionId === "regency") {
    return <Image source={require("../../assets/RegencyACP.png")} style={styles.divisionLogo} resizeMode="contain" />;
  }

  if (divisionId === "masters") {
    return <Image source={require("../../assets/MastersACP.png")} style={styles.divisionLogo} resizeMode="contain" />;
  }

  if (divisionId === "open") {
    return <Image source={require("../../assets/OpenACP.png")} style={styles.divisionLogo} resizeMode="contain" />;
  }

  if (divisionId === "veterans") {
    return (
      <View style={styles.dualLogoRow}>
        <Image source={require("../../assets/VeteransACP.png")} style={styles.dualDivisionLogo} resizeMode="contain" />
        <Image source={require("../../assets/RookieACP.png")} style={styles.dualDivisionLogo} resizeMode="contain" />
      </View>
    );
  }

  return null;
}

export default function WaiverBatchScreen() {
  const params = useLocalSearchParams();
  const divisionId = String(params.division || params.divisionId || "");
  const game = GAMES[divisionId];

  const [loading, setLoading] = useState(true);
  const [divisionName, setDivisionName] = useState("");
  const [config, setConfig] = useState<any>(null);
  const [waivers, setWaivers] = useState<WaiverRecord[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadBatchWaivers();
  }, [divisionId]);

  async function loadBatchWaivers() {
    try {
      setLoading(true);

      const response = await adminFetch(
        `${API_BASE}/api/admin/waivers/batch/${encodeURIComponent(divisionId)}`
      );

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        setMessage(json?.message || "Batch waivers could not be loaded.");
        return;
      }

      setDivisionName(json.division?.name || game?.title || divisionId);
      setConfig(json.config || null);
      setWaivers(Array.isArray(json.waivers) ? json.waivers : []);
    } catch (e) {
      console.log("BATCH WAIVER LOAD ERROR:", e);
      setMessage("Batch waivers could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

function csvCell(value?: any) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsvReport() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;

  const headers = [
    "Division",
    "Squad",
    "Name",
    "Team",
    "Role",
    "Age",
    "Address",
    "City",
    "State",
    "ZIP",
    "Phone",
    "Person ID",
    "LeagueApps ID",
    "Waiver Version",
    "Waiver Year",
    "Host",
    "Venue",
    "Typed Signature",
    "Signed Date/Time",
  ];

  const rows = waivers.map((waiver) => [
    divisionName || game?.title || divisionId,
    waiver.squad || "",
    waiver.name || "",
    waiver.teamName || "",
    formatRole(waiver.role),
    waiver.age || "",
    waiver.address || "",
    waiver.city || "",
    waiver.state || "",
    waiver.zip || "",
    formatPhone(waiver.phone),
    waiver.personId || "",
    waiver.leagueAppsId || "",
    config?.waiverVersion || "",
    config?.waiverYear || "",
    config?.hostName || "",
    config?.venueName || "",
    waiver.typedSignature || "",
    waiver.signedAt ? new Date(waiver.signedAt).toLocaleString() : "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${divisionId}-signed-waivers-report.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function printPage() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;

  const url = `${API_BASE}/api/admin/waivers/batch/${encodeURIComponent(
    divisionId
  )}/print`;

  window.open(url, "_blank", "noopener,noreferrer");
}

  function openSingleWaiver(waiver: WaiverRecord) {
    router.push({
      pathname: "/waiver",
      params: {
        participantId: waiver.personId,
        readonly: "true",
        print: "true",
      },
    });
  }

  if (!game) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Game Not Found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.replace(`/waiverdivision/${divisionId}`)}>
              <View style={styles.buttonContentRow}>
                <Ionicons name="chevron-back-outline" size={16} color="#ffffff" style={{ marginRight: 3 }} />
                <Text style={styles.backButtonText}>Back</Text>
              </View>
            </Pressable>
<Pressable
  style={[styles.reportButton, waivers.length === 0 && styles.disabledButton]}
  onPress={exportCsvReport}
  disabled={waivers.length === 0}
>
  <View style={styles.buttonContentRow}>
    <Ionicons
      name="document-text-outline"
      size={18}
      color="#ffffff"
      style={{ marginRight: 6 }}
    />
    <Text style={styles.reportButtonText}>Report</Text>
  </View>
</Pressable>
            <Pressable
              style={[styles.printAllButton, waivers.length === 0 && styles.disabledButton]}
              onPress={printPage}
              disabled={waivers.length === 0}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons name="print-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.printAllButtonText}>Print All</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.gameLabel}>{game.gameLabel}</Text>
            <Text style={styles.title}>{divisionName || game.title}</Text>

            <View style={styles.logoWrapper}>{renderGameLogo(game.divisionId)}</View>

            <Text style={styles.subtitle}>Signed Waiver Batch Print</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Batch Summary</Text>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>{waivers.length}</Text>
                <Text style={styles.summaryLabel}>Signed Waivers</Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>{config?.waiverYear || "2026"}</Text>
                <Text style={styles.summaryLabel}>Waiver Year</Text>
              </View>
            </View>

            <Text style={styles.configLine}>
              Version: {config?.waiverVersion || "Not Listed"}
            </Text>

            <Text style={styles.configLine}>
              Host: {config?.hostName || "Frisco RoughRiders"}
            </Text>

            <Text style={styles.configLine}>
              Venue: {config?.venueName || "Riders Field"}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#1d4ed8" />
              <Text style={styles.loadingText}>Loading signed waivers...</Text>
            </View>
          ) : message ? (
            <View style={styles.loadingCard}>
              <Text style={styles.emptyText}>{message}</Text>
            </View>
          ) : waivers.length === 0 ? (
            <View style={styles.loadingCard}>
              <Text style={styles.emptyText}>No signed waivers found for this division.</Text>
            </View>
          ) : (
            waivers.map((waiver, index) => (
              <View key={waiver.key || `${waiver.personId}-${index}`} style={styles.waiverCard}>
                <View style={styles.waiverHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>{waiver.name || "Participant"}</Text>
                    <Text style={styles.personSubText}>
                      {waiver.teamName || "Team Not Listed"} • {waiver.squad || "Squad Not Listed"}
                    </Text>
                  </View>

                  <View style={styles.completeBadge}>
                    <Text style={styles.completeBadgeText}>Signed</Text>
                  </View>
                </View>

                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Age</Text>
                    <Text style={styles.infoValue}>{waiver.age || "Not Listed"}</Text>
                  </View>

                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Phone</Text>
                    <Text style={styles.infoValue}>{formatPhone(waiver.phone)}</Text>
                  </View>

                  <View style={styles.infoItemFull}>
                    <Text style={styles.infoLabel}>Address</Text>
                    <Text style={styles.infoValue}>{formatAddress(waiver)}</Text>
                  </View>

                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Role</Text>
                    <Text style={styles.infoValue}>{formatRole(waiver.role)}</Text>
                  </View>

                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Signed</Text>
                    <Text style={styles.infoValue}>
                      {waiver.signedAt ? new Date(waiver.signedAt).toLocaleString() : "Not Listed"}
                    </Text>
                  </View>

                  <View style={styles.infoItemFull}>
                    <Text style={styles.infoLabel}>Typed Signature</Text>
                    <Text style={styles.signatureText}>{waiver.typedSignature || "Not Listed"}</Text>
                  </View>
                </View>

                <View style={styles.waiverTextBox}>
                  <Text style={styles.waiverTitle}>
                    Agreement and Release of Liability Waiver
                  </Text>

                  <Text style={styles.waiverText}>
                    I, as the participant, parent, or legal guardian of the participant, hereby acknowledge and am aware that participant is being permitted to use the facilities at Dr Pepper Ballpark / Riders Field by the Frisco RoughRiders Baseball Team, the City of Frisco, Frisco RoughRiders LP, and/or its affiliated entities.
                  </Text>

                  <Text style={styles.waiverText}>
                    This waiver was completed electronically and recorded by the NTABL Charity All-Star Games system.
                  </Text>
                </View>

                <Pressable style={styles.singlePrintButton} onPress={() => openSingleWaiver(waiver)}>
                  <View style={styles.buttonContentRow}>
                    <Ionicons name="document-text-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.singlePrintButtonText}>Open Individual Print View</Text>
                  </View>
                </Pressable>
              </View>
            ))
          )}

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
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
  gap: 8,
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

  printAllButton: {
    backgroundColor: "#15803d",
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },

  printAllButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  disabledButton: {
    opacity: 0.45,
  },

  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  gameLabel: {
    fontSize: 26,
    fontWeight: "900",
    color: "#15803d",
    textAlign: "center",
    marginBottom: 2,
  },

  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#c62828",
    textAlign: "center",
    marginTop: 10,
  },

  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },

  divisionLogo: {
    width: 145,
    height: 88,
  },

  dualLogoRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  dualDivisionLogo: {
    width: 98,
    height: 70,
    marginHorizontal: 6,
  },

  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  summaryTitle: {
    color: "#1f4e9e",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 12,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },

  summaryItem: {
    alignItems: "center",
    flex: 1,
  },

  summaryNumber: {
    color: "#15803d",
    fontSize: 28,
    fontWeight: "900",
  },

  summaryLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 2,
  },

  configLine: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 3,
  },

  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  loadingText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
  },

  emptyText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },

  waiverCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  waiverHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  personName: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },

  personSubText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3,
  },

  completeBadge: {
    backgroundColor: "#15803d",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  completeBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },

  infoGrid: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },

  infoItem: {
    marginBottom: 8,
  },

  infoItemFull: {
    marginBottom: 8,
  },

  infoLabel: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  infoValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },

  signatureText: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 4,
  },

  waiverTextBox: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },

  waiverTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    textDecorationLine: "underline",
    marginBottom: 10,
  },

  waiverText: {
    color: "#374151",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    marginBottom: 8,
  },

  singlePrintButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },

  singlePrintButtonText: {
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

  reportButton: {
  backgroundColor: "#c62828",
  borderRadius: 9,
  paddingVertical: 7,
  paddingHorizontal: 13,
},

reportButtonText: {
  color: "#ffffff",
  fontSize: 14,
  fontWeight: "900",
},
});