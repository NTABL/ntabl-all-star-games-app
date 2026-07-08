import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { adminFetch, API_BASE } from "../../utils/appconfig";
import { modalStyles } from "../../utils/modalStyles";

type Squad = "East" | "West";

const GAMES: Record<string, any> = {
  regency: { gameLabel: "Game 1", title: "60+ All-Stars", divisionId: "regency" },
  masters: { gameLabel: "Game 2", title: "45+ All-Stars", divisionId: "masters" },
  veterans: { gameLabel: "Game 3", title: "30+ / Rookie Prospects", divisionId: "veterans" },
  open: { gameLabel: "Game 4", title: "18+ All-Stars", divisionId: "open" },
};

function renderGameLogo(divisionId: string) {
  if (divisionId === "regency") return <Image source={require("../../assets/RegencyACP.png")} style={styles.divisionLogo} resizeMode="contain" />;
  if (divisionId === "masters") return <Image source={require("../../assets/MastersACP.png")} style={styles.divisionLogo} resizeMode="contain" />;
  if (divisionId === "open") return <Image source={require("../../assets/OpenACP.png")} style={styles.divisionLogo} resizeMode="contain" />;

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

function formatPhone(phone?: string) {
  if (!phone) return "Not Listed";

  const digits = phone.replace(/\D/g, "").replace(/^1/, "");

  if (digits.length !== 10) return phone;

  return `(${digits.substring(0, 3)}) ${digits.substring(
    3,
    6
  )}-${digits.substring(6)}`;
}

function formatDisplayRole(role?: string) {
  const value = String(role || "").toUpperCase();

  if (value.includes("CO-CAPTAIN")) return "Co-Captain";
  if (value.includes("CAPTAIN")) return "Captain";
  if (value.includes("PLAYER")) return "Player";
  if (value.includes("ALL-STAR-MANAGER")) return "Captain";

  return "Player";
}

export default function WaiverDivisionScreen() {
  const params = useLocalSearchParams();
  const divisionId = String(params.divisionId || params.division || "");
  const game = GAMES[divisionId];

  const [loading, setLoading] = useState(true);
  const [divisionData, setDivisionData] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 900;

  useEffect(() => {
    loadWaiverDivision();
  }, [divisionId]);

  async function loadWaiverDivision() {
    try {
      setLoading(true);

      const response = await adminFetch(`${API_BASE}/api/admin/waivers/status`);
      const json = await response.json();

      if (json?.ok) {
        setConfig(json.config || null);

        const foundDivision = Array.isArray(json.divisions)
          ? json.divisions.find((division: any) => division.divisionId === divisionId)
          : null;

        setDivisionData(foundDivision || null);
      }
    } catch (e) {
      console.log("WAIVER DIVISION LOAD ERROR:", e);
    } finally {
      setLoading(false);
    }
  }

  function renderPerson(person: any, label?: string) {
    if (!person) return null;

return (
  <Pressable
    key={`${person.role || "person"}-${person.id || person.email || person.name}`}
    style={styles.personRow}
    onPress={() => setSelectedPerson({ ...person, detailLabel: label })}
  >
        <View style={[styles.statusDot, { backgroundColor: person.signed ? "#15803d" : "#c62828" }]} />

        <View style={styles.personTextBlock}>
          <Text style={styles.personName}>{person.name || "Not Listed"}</Text>
          <Text style={styles.personMeta}>{label || person.teamName || person.role || ""}</Text>
        </View>

        <View style={[styles.statusPill, { backgroundColor: person.signed ? "#15803d" : "#c62828" }]}>
          <Text style={styles.statusPillText}>{person.signed ? "Complete" : "Missing"}</Text>
        </View>
      </Pressable>
    );
  }

  function renderSquad(squad: Squad) {
    const group = divisionData?.squads?.[squad] || { manager: null, players: [] };

    const signedCount =
      (group.manager?.signed ? 1 : 0) +
      group.players.filter((player: any) => player.signed).length;

    const totalCount = (group.manager ? 1 : 0) + group.players.length;

    return (
      <View style={styles.squadCard}>
        <View style={[styles.squadHeader, squad === "East" ? styles.eastHeader : styles.westHeader]}>
          <Text style={styles.squadHeaderText}>{squad} All-Stars</Text>
          <View
  style={[
    styles.completeBadge,
    totalCount > 0 && signedCount === totalCount && styles.completeBadgeDone,
  ]}
>
  <Text style={styles.completeBadgeText}>
    {signedCount} / {totalCount} Complete
  </Text>
</View>
        </View>

        <View style={styles.squadContent}>
          <Text style={styles.sectionLabel}>Manager</Text>
          {group.manager ? renderPerson(group.manager, "All-Star Manager") : <Text style={styles.emptyText}>No manager assigned.</Text>}

          <Text style={styles.sectionLabel}>Selected Players</Text>
          {group.players.length ? group.players.map((player: any) => renderPerson(player)) : <Text style={styles.emptyText}>No Selected Players Found.</Text>}
        </View>
      </View>
    );
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
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.replace("/waivermanagement")}>
              <View style={styles.buttonContentRow}>
                <Ionicons name="chevron-back-outline" size={16} color="#ffffff" style={{ marginRight: 3 }} />
                <Text style={styles.backButtonText}>Back</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.gameLabel}>{game.gameLabel}</Text>
            <Text style={styles.title}>{game.title}</Text>
            <View style={styles.logoWrapper}>{renderGameLogo(game.divisionId)}</View>
            <Text style={styles.subtitle}>Waiver Status • {config?.waiverYear || "2026"}</Text>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#660000" />
              <Text style={styles.loadingText}>Loading Waiver Status...</Text>
            </View>
          ) : !divisionData ? (
            <View style={styles.loadingCard}>
              <Text style={styles.emptyText}>No Waiver Data Found for This Division.</Text>
            </View>
          ) : (
            <View style={[styles.squadBoard, isWideScreen && styles.squadBoardWide]}>
              <View style={isWideScreen ? styles.squadColumnWide : styles.squadColumnMobile}>
                {renderSquad("East")}
              </View>

              <View style={isWideScreen ? styles.squadColumnWide : styles.squadColumnMobile}>
                {renderSquad("West")}
              </View>
            </View>
          )}

          <Text style={styles.versionFooter}>NTABL All-Star App • Version 1.0</Text>
        </ScrollView>
      </View>
      <Modal
  visible={!!selectedPerson}
  transparent
  animationType="fade"
  onRequestClose={() => setSelectedPerson(null)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.personModalCard}>
      <Ionicons
        name={selectedPerson?.signed ? "checkmark-circle" : "close-circle"}
        size={54}
        color={selectedPerson?.signed ? "#15803d" : "#c62828"}
        style={{ marginBottom: 10 }}
      />

      <Text style={styles.personModalTitle}>
        {selectedPerson?.name || "Participant"}
      </Text>

<Text style={styles.personModalSubTitle}>
  {selectedPerson?.teamName ||
    selectedPerson?.detailLabel ||
    formatDisplayRole(selectedPerson?.displayRole || selectedPerson?.role)}
</Text>

      <View style={styles.modalInfoBox}>
<Text style={styles.modalInfoLabel}>Waiver Status</Text>
<Text
  style={[
    styles.modalInfoValue,
    { color: selectedPerson?.signed ? "#15803d" : "#c62828" },
  ]}
>
  {selectedPerson?.signed ? "Complete" : "Missing"}
</Text>

<Text style={styles.modalInfoLabel}>Age</Text>
<Text style={styles.modalInfoValue}>
  {selectedPerson?.age || "Not Listed"}
</Text>

<Text style={styles.modalInfoLabel}>Address</Text>
<Text style={styles.modalInfoValue}>
  {selectedPerson?.address
    ? `${selectedPerson.address}, ${selectedPerson.city || ""} ${
        selectedPerson.state || ""
      } ${selectedPerson.zip || ""}`.trim()
    : "Not Listed"}
</Text>

<Text style={styles.modalInfoLabel}>Phone</Text>
<Text style={styles.modalInfoValue}>
  {formatPhone(selectedPerson?.phone)}
</Text>

<Text style={styles.modalInfoLabel}>Email</Text>
<Text style={styles.modalInfoValue}>
  {selectedPerson?.email || "Not Listed"}
</Text>

<Text style={styles.modalInfoLabel}>Waiver Version</Text>
<Text style={styles.modalInfoValue}>
  {config?.waiverVersion || "Not Listed"}
</Text>
      </View>
<View style={styles.modalButtonRow}>
  <Pressable
    style={styles.secondaryButton}
onPress={() => {
  setSelectedPerson(null);

  router.push({
    pathname: "/waiver",
    params: {
      participantId: selectedPerson?.id,
      readonly: "true",
    },
  });
}}
  >
    <View style={styles.buttonContentRow}>
      <Ionicons
        name="document-text-outline"
        size={20}
        color="#ffffff"
        style={{ marginRight: 6 }}
      />
      <Text style={styles.secondaryButtonText}>
        View Waiver
      </Text>
    </View>
  </Pressable>

  <Pressable
    style={styles.secondaryButton}
    onPress={() => {
      // Placeholder
    }}
  >
    <View style={styles.buttonContentRow}>
      <Ionicons
        name="print-outline"
        size={20}
        color="#ffffff"
        style={{ marginRight: 6 }}
      />
      <Text style={styles.secondaryButtonText}>
        Print Waiver
      </Text>
    </View>
  </Pressable>
</View>
      <Pressable
        style={styles.closeButton}
        onPress={() => setSelectedPerson(null)}
      >
        <View style={styles.buttonContentRow}>
          <Ionicons
            name="close-circle-outline"
            size={20}
            color="#ffffff"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.closeButtonText}>Close</Text>
        </View>
      </Pressable>
    </View>
  </View>
</Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef2f7" },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 50, paddingBottom: 70 },
  headerRow: { flexDirection: "row", justifyContent: "flex-start", marginBottom: 10 },
  backButton: { backgroundColor: "#1d4ed8", borderRadius: 9, paddingVertical: 7, paddingHorizontal: 13 },
  backButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  buttonContentRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
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
  gameLabel: { fontSize: 26, fontWeight: "900", color: "#15803d", textAlign: "center", marginBottom: 2 },
  title: { fontSize: 28, fontWeight: "900", color: "#1f4e9e", textAlign: "center", marginBottom: 12 },
  subtitle: { fontSize: 15, fontWeight: "800", color: "#660000", textAlign: "center", marginTop: 10 },
  logoWrapper: { alignItems: "center", justifyContent: "center" },
  divisionLogo: { width: 145, height: 88 },
  dualLogoRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  dualDivisionLogo: { width: 98, height: 70, marginHorizontal: 6 },
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
  loadingText: { color: "#6b7280", fontSize: 15, fontWeight: "800", marginTop: 12 },
  squadBoard: { gap: 14 },
  squadBoardWide: { flexDirection: "row", justifyContent: "space-between" },
  squadColumnWide: { flex: 1, minWidth: 0 },
  squadColumnMobile: { width: "100%" },
  squadCard: {
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
  squadHeader: { paddingVertical: 13, paddingHorizontal: 14 },
  eastHeader: { backgroundColor: "#c62828" },
  westHeader: { backgroundColor: "#1d4ed8" },
  squadHeaderText: { color: "#ffffff", fontSize: 19, fontWeight: "900", textAlign: "center" },
  squadHeaderSubText: { color: "#ffffff", fontSize: 13, fontWeight: "800", textAlign: "center", marginTop: 3 },
  squadContent: { padding: 14 },
  sectionLabel: { color: "#1f4e9e", fontSize: 15, fontWeight: "900", marginTop: 8, marginBottom: 8 },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statusDot: { width: 13, height: 13, borderRadius: 999 },
  personTextBlock: { flex: 1, marginLeft: 10, minWidth: 0 },
  personName: { color: "#111827", fontSize: 15, fontWeight: "900" },
  personMeta: { color: "#6b7280", fontSize: 12, fontWeight: "700", marginTop: 2 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 8 },
  statusPillText: { color: "#ffffff", fontSize: 11, fontWeight: "900" },
  emptyText: { color: "#6b7280", fontSize: 14, fontWeight: "800", textAlign: "center", paddingVertical: 8 },
  versionFooter: { color: "#6b7280", fontSize: 12, fontWeight: "700", textAlign: "center", marginTop: 22, marginBottom: 8 },

  modalOverlay: {
  ...modalStyles.overlay,
},

personModalCard: {
  ...modalStyles.card,
  alignItems: "center",
},

personModalTitle: {
  fontSize: 24,
  fontWeight: "900",
  color: "#1f4e9e",
  textAlign: "center",
},

personModalSubTitle: {
  fontSize: 15,
  fontWeight: "800",
  color: "#6b7280",
  textAlign: "center",
  marginTop: 4,
  marginBottom: 14,
},

modalInfoBox: {
  width: "100%",
  backgroundColor: "#f8fafc",
  borderRadius: 14,
  padding: 14,
  marginTop: 8,
},

modalInfoLabel: {
  color: "#6b7280",
  fontSize: 12,
  fontWeight: "900",
  textTransform: "uppercase",
  marginTop: 8,
},

modalInfoValue: {
  color: "#111827",
  fontSize: 15,
  fontWeight: "800",
  marginTop: 2,
},

closeButton: {
  backgroundColor: "#1d4ed8",
  borderRadius: 12,
  paddingVertical: 12,
  paddingHorizontal: 20,
  marginTop: 16,
  width: "100%",
  alignItems: "center",
},

closeButtonText: {
  color: "#ffffff",
  fontSize: 16,
  fontWeight: "900",
},

modalButtonRow: {
  width: "100%",
  marginTop: 16,
},

secondaryButton: {
  backgroundColor: "#15803d",
  borderRadius: 12,
  paddingVertical: 12,
  marginBottom: 10,
  alignItems: "center",
},

secondaryButtonText: {
  color: "#ffffff",
  fontSize: 16,
  fontWeight: "900",
},

completeBadge: {
  alignSelf: "center",
  backgroundColor: "rgba(255,255,255,0.22)",
  borderRadius: 999,
  paddingVertical: 5,
  paddingHorizontal: 12,
  marginTop: 6,
},

completeBadgeDone: {
  backgroundColor: "#15803d",
  borderWidth: 2,
  borderColor: "#ffffff",
},

completeBadgeText: {
  color: "#ffffff",
  fontSize: 13,
  fontWeight: "900",
  textAlign: "center",
},
});