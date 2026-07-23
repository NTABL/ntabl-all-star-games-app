import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { setManagerContext } from "../stores/store";
import { adminFetch, API_BASE } from "../utils/appconfig";
import { modalStyles } from "../utils/modalStyles";

type TeamSummary = {
  teamName: string;
  divisionId: string;
  divisionName: string;
};

type MemberResult = {
  id: string;
  name: string;
  email: string;
  role: string;
  teams: TeamSummary[];
  smsPreference?: {
    hasPreference?: boolean;
    enabled?: boolean;
    status?: "enabled" | "disabled" | "pending";
    updatedAt?: string;
  };
};

export default function MemberLookupScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberResult | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [message, setMessage] = useState("");
  const [updatingSms, setUpdatingSms] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clean = query.trim();

    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }

    if (clean.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);

    searchTimer.current = setTimeout(() => {
      searchMembers(clean);
    }, 250);

    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, [query]);

  async function searchMembers(value: string) {
    try {
      const response = await adminFetch(
        `${API_BASE}/api/admin/member-search?q=${encodeURIComponent(value)}`
      );
      const json = await response.json();

      if (!response.ok || !json?.ok) {
        setResults([]);
        setMessage(json?.message || "Member search failed.");
        return;
      }

      setResults(Array.isArray(json.members) ? json.members : []);
      setMessage("");
    } catch (error) {
      console.log(error);
      setResults([]);
      setMessage("Member search could not reach the backend.");
    } finally {
      setSearching(false);
    }
  }

  function requestImpersonation(member: MemberResult) {
    setSelectedMember(member);
    setConfirmVisible(true);
  }

  async function startImpersonation() {
    if (!selectedMember) return;

    try {
      setImpersonating(true);

      const response = await adminFetch(`${API_BASE}/api/admin/impersonate`, {
        method: "POST",
        body: JSON.stringify({
          email: selectedMember.email,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok || !json.manager) {
        setMessage(json?.message || "Impersonation could not be started.");
        setConfirmVisible(false);
        return;
      }

      await setManagerContext(json.manager);
      setConfirmVisible(false);
      router.replace("/dashboard");
    } catch (error) {
      console.log(error);
      setMessage("Impersonation could not reach the backend.");
      setConfirmVisible(false);
    } finally {
      setImpersonating(false);
    }
  }

  async function updateSmsPreference(member: MemberResult, enabled: boolean) {
    try {
      setUpdatingSms(true);
      const response = await adminFetch(`${API_BASE}/api/admin/members/sms-preference`, {
        method: "POST",
        body: JSON.stringify({ email: member.email, enabled }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) throw new Error(json?.message || "SMS preference could not be updated.");
      setResults((current) => current.map((item) => item.email === member.email ? { ...item, smsPreference: json.smsPreference } : item));
      setMessage(`SMS notifications ${enabled ? "enabled" : "disabled"} for ${member.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "SMS preference could not be updated.");
    } finally {
      setUpdatingSms(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.replace("/admin")}>
              <View style={styles.buttonRow}>
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

            <Text style={styles.title}>Member Lookup</Text>
            <Text style={styles.subtitle}>
              Find a member by name or email and temporarily view the app as that member.
            </Text>
          </View>

          <View style={styles.searchCard}>
            <Text style={styles.searchLabel}>SEARCH MEMBER</Text>

            <View style={styles.searchInputWrap}>
              <Ionicons
                name="search-outline"
                size={21}
                color="#6b7280"
                style={{ marginRight: 8 }}
              />

              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Start typing a name or email..."
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {searching && <ActivityIndicator size="small" color="#1d4ed8" />}
            </View>

            <Text style={styles.searchHelp}>
              Enter at least two characters. Results come from the current LeagueApps cache.
            </Text>
          </View>

          {!!message && (
            <View style={styles.messageCard}>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          )}

          {query.trim().length >= 2 && !searching && results.length === 0 && !message && (
            <View style={styles.emptyCard}>
              <Ionicons name="person-outline" size={38} color="#9ca3af" />
              <Text style={styles.emptyTitle}>No Matches Found</Text>
              <Text style={styles.emptyText}>
                Try another spelling or search by email address.
              </Text>
            </View>
          )}

          {results.map((member) => (
            <Pressable
              key={member.email}
              style={styles.memberCard}
              onPress={() => requestImpersonation(member)}
            >
              <View style={styles.memberIcon}>
                <Ionicons name="person-outline" size={26} color="#ffffff" />
              </View>

              <View style={styles.memberText}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberEmail}>{member.email}</Text>

                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{member.role}</Text>
                </View>

                {member.teams.slice(0, 3).map((team) => (
                  <Text
                    key={`${member.email}-${team.divisionId}-${team.teamName}`}
                    style={styles.teamText}
                  >
                    {team.teamName} • {team.divisionName}
                  </Text>
                ))}

                {member.teams.length > 3 && (
                  <Text style={styles.moreTeamsText}>
                    +{member.teams.length - 3} additional assignment(s)
                  </Text>
                )}

                <View style={styles.smsStatusBox}>
                  <View style={styles.smsStatusRow}>
                    <Ionicons
                      name={member.smsPreference?.enabled ? "checkmark-circle" : "remove-circle-outline"}
                      size={18}
                      color={member.smsPreference?.enabled ? "#15803d" : "#b45309"}
                    />
                    <Text style={styles.smsStatusText}>
                      SMS: {member.smsPreference?.status === "enabled" ? "Enabled" : member.smsPreference?.status === "disabled" ? "Disabled" : "No Preference"}
                    </Text>
                  </View>
                  {!!member.smsPreference?.updatedAt && (
                    <Text style={styles.smsUpdatedText}>
                      Updated {new Date(member.smsPreference.updatedAt).toLocaleString()}
                    </Text>
                  )}
                  <View style={styles.smsButtonRow}>
                    <Pressable disabled={updatingSms} style={[styles.smsActionButton, styles.smsEnableButton]} onPress={(event) => { event.stopPropagation(); updateSmsPreference(member, true); }}>
                      <Text style={styles.smsActionText}>Enable</Text>
                    </Pressable>
                    <Pressable disabled={updatingSms} style={[styles.smsActionButton, styles.smsDisableButton]} onPress={(event) => { event.stopPropagation(); updateSmsPreference(member, false); }}>
                      <Text style={styles.smsActionText}>Disable</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={22} color="#9ca3af" />
            </Pressable>
          ))}

          <Text style={styles.versionFooter}>
            NTABL All-Star App • Version 1.0
          </Text>
        </ScrollView>
      </View>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons
              name="shield-checkmark-outline"
              size={52}
              color="#7c3aed"
              style={{ marginBottom: 8 }}
            />

            <Text style={styles.modalTitle}>Impersonate Member?</Text>

            <Text style={styles.modalMemberName}>
              {selectedMember?.name || ""}
            </Text>
            <Text style={styles.modalMemberEmail}>
              {selectedMember?.email || ""}
            </Text>

            <Text style={styles.modalMessage}>
              You will temporarily view the app using this member’s account context.
              A prominent Admin Impersonation banner will remain visible until you exit.
            </Text>

            <Pressable
              style={styles.continueButton}
              onPress={startImpersonation}
              disabled={impersonating}
            >
              {impersonating ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <View style={styles.buttonRow}>
                  <Ionicons
                    name="log-in-outline"
                    size={20}
                    color="#ffffff"
                    style={{ marginRight: 7 }}
                  />
                  <Text style={styles.continueButtonText}>Continue as Member</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setConfirmVisible(false)}
              disabled={impersonating}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },
  container: {
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
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  logo: {
    width: 140,
    height: 140,
    alignSelf: "center",
    marginBottom: 6,
  },
  title: {
    color: "#1f4e9e",
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 6,
  },
  searchCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  searchLabel: {
    color: "#1f4e9e",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  searchHelp: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 8,
  },
  memberCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  memberIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  memberText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  memberName: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
  },
  memberEmail: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#ede9fe",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 9,
    marginTop: 7,
    marginBottom: 5,
  },
  roleBadgeText: {
    color: "#6d28d9",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  teamText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },
  moreTeamsText: {
    color: "#7c3aed",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
  },
  smsStatusBox: {
    marginTop: 9,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 9,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  smsStatusRow: { flexDirection: "row", alignItems: "center" },
  smsStatusText: { color: "#374151", fontSize: 12, fontWeight: "900", marginLeft: 5 },
  smsUpdatedText: { color: "#6b7280", fontSize: 10, fontWeight: "700", marginTop: 3 },
  smsButtonRow: { flexDirection: "row", marginTop: 7 },
  smsActionButton: { flex: 1, borderRadius: 8, paddingVertical: 7, alignItems: "center" },
  smsEnableButton: { backgroundColor: "#15803d", marginRight: 4 },
  smsDisableButton: { backgroundColor: "#6b7280", marginLeft: 4 },
  smsActionText: { color: "#ffffff", fontSize: 11, fontWeight: "900" },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    color: "#374151",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 8,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },
  messageCard: {
    backgroundColor: "#fef2f2",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  messageText: {
    color: "#c62828",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  modalOverlay: {
    ...modalStyles.overlay,
  },
  modalCard: {
    ...modalStyles.card,
    alignItems: "center",
  },
  modalTitle: {
    color: "#1f4e9e",
    fontSize: 23,
    fontWeight: "900",
    textAlign: "center",
  },
  modalMemberName: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 12,
  },
  modalMemberEmail: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 2,
  },
  modalMessage: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
    marginTop: 14,
    marginBottom: 16,
  },
  continueButton: {
    width: "100%",
    backgroundColor: "#7c3aed",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  continueButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  cancelButton: {
    width: "100%",
    backgroundColor: "#6b7280",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 10,
  },
  cancelButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  versionFooter: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 20,
  },
});
