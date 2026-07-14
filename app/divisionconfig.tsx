import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { clearAdminLogin, isAdminLoggedIn } from "../stores/adminstore";
import { adminFetch, API_BASE } from "../utils/appconfig";
import { modalStyles } from "../utils/modalStyles";

type LeagueAppsSource = {
  id: string;
  name: string;
  enabled: boolean;
};

type Division = {
  id: string;
  name: string;
  maxTotal: number;
  maxPitchers: number;
  maxPositionPlayers: number;
  isLocked: boolean;
  leagueAppsSources?: LeagueAppsSource[];
};

type Team = {
  id: string;
  name: string;
  divisionId: string;
  squad: string | null;
};

const divisionImages: Record<string, any> = {
  open: require("../assets/OpenACP.png"),
  veterans: require("../assets/VeteransACP.png"),
  masters: require("../assets/MastersACP.png"),
  regency: require("../assets/RegencyACP.png"),
  rookie: require("../assets/RookieACP.png"),
};

const divisionDetailImages: Record<string, any> = {
  open: require("../assets/Open.png"),
  veterans: require("../assets/Veterans.png"),
  masters: require("../assets/Masters.png"),
  regency: require("../assets/Regency.png"),
  rookie: require("../assets/Rookie.png"),
};

export default function DivisionConfigScreen() {
  const [loading, setLoading] = useState(true);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(
    null
  );
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [showTeamsScreen, setShowTeamsScreen] = useState(false);
  const [positionPlayersLimit, setPositionPlayersLimit] = useState(0);
  const [pitchersLimit, setPitchersLimit] = useState(0);
  const [submissionStatus, setSubmissionStatus] = useState<any>({});
  const [toastMessage, setToastMessage] = useState("");

  const [showPosModal, setShowPosModal] = useState(false);
  const [showPitModal, setShowPitModal] = useState(false);
  const [showLeagueSourceModal, setShowLeagueSourceModal] = useState(false);
  const [editingLeagueSourceIndex, setEditingLeagueSourceIndex] = useState<number | null>(null);
  const [leagueSourceName, setLeagueSourceName] = useState("");
  const [leagueSourceId, setLeagueSourceId] = useState("");
  const [leagueSourceEnabled, setLeagueSourceEnabled] = useState(false);
  const [savingLeagueSources, setSavingLeagueSources] = useState(false);

  const { width, height } = useWindowDimensions();
  const isTabletLayout = width >= 700;
  const isShortScreen = height < 760;

  const eastCount = teams.filter((t) => t.squad === "East").length;
  const westCount = teams.filter((t) => t.squad === "West").length;
  const unassignedCount = teams.filter((t) => !t.squad).length;

  useFocusEffect(
    useCallback(() => {
      checkAdmin();
    }, [])
  );

  useEffect(() => {
    loadConfig();
  }, []);

  function showToast(message: string) {
    setToastMessage(message);

    setTimeout(() => {
      setToastMessage("");
    }, 1400);
  }

  async function checkAdmin() {
    const loggedIn = await isAdminLoggedIn();

    if (!loggedIn) {
      router.replace("/login");
    }
  }

  async function handleLogout() {
    await clearAdminLogin();
    router.replace("/login");
  }

  async function loadConfig() {
    try {
      const response = await adminFetch(`${API_BASE}/api/admin/config`);
      const json = await response.json();

      if (json?.ok) {
        setDivisions(json.config.divisions || []);
      }

      const statusResponse = await adminFetch(
        `${API_BASE}/api/admin/submission-status`
      );

      const statusJson = await statusResponse.json();

      if (statusJson?.ok) {
        setSubmissionStatus(statusJson.results || {});
      }
    } catch (e) {
      console.log("DIVISION CONFIG ERROR:", e);
    } finally {
      setLoading(false);
    }
  }

    async function loadTeams(division: Division) {
    try {
      setSelectedDivision(division);
      setPositionPlayersLimit(division.maxPositionPlayers);
      setPitchersLimit(division.maxPitchers);
      setShowTeamsScreen(true);
      setLoadingTeams(true);

      const response = await adminFetch(
        `${API_BASE}/api/admin/divisions/${division.id}/teams`
      );

      const json = await response.json();

      if (json?.ok) {
        setTeams(json.data || []);
      }
    } catch (e) {
      console.log("TEAM LOAD ERROR:", e);
    } finally {
      setLoadingTeams(false);
    }
  }

  async function assignSquad(teamId: string, squad: "East" | "West") {
    setTeams((currentTeams) =>
      currentTeams.map((team) =>
        team.id === teamId ? { ...team, squad } : team
      )
    );

    try {
      await adminFetch(`${API_BASE}/api/admin/teams/${teamId}/assign-squad`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          squad,
          divisionId: selectedDivision?.id,
        }),
      });

      showToast(`${squad} Assigned`);
    } catch (e) {
      console.log("ASSIGN SQUAD ERROR:", e);
      showToast("Assignment Failed");
    }
  }

  async function clearDivisionAssignments() {
    if (!selectedDivision) return;

    setTeams((currentTeams) =>
      currentTeams.map((team) => ({
        ...team,
        squad: null,
      }))
    );

    try {
      await adminFetch(
        `${API_BASE}/api/admin/divisions/${selectedDivision.id}/clear-squads`,
        {
          method: "POST",
        }
      );

      showToast("Cleared!");
    } catch (e) {
      console.log("CLEAR SQUADS ERROR:", e);
      showToast("Clear Failed");
    }
  }

  async function toggleDivisionLock() {
    if (!selectedDivision) return;

    const newLockState = !selectedDivision.isLocked;

    setDivisions((current) =>
      current.map((division) =>
        division.id === selectedDivision.id
          ? { ...division, isLocked: newLockState }
          : division
      )
    );

    setSelectedDivision({
      ...selectedDivision,
      isLocked: newLockState,
    });

    try {
      await adminFetch(
        `${API_BASE}/api/admin/divisions/${selectedDivision.id}/lock`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isLocked: newLockState,
          }),
        }
      );

      showToast(newLockState ? "Locked!" : "Unlocked!");
    } catch (e) {
      console.log("LOCK SAVE ERROR:", e);
      showToast("Lock Update Failed");
    }
  }

  async function saveDivisionLimits(
    newPositionPlayers: number,
    newPitchers: number
  ) {
    if (!selectedDivision) return;

    setDivisions((current) =>
      current.map((division) =>
        division.id === selectedDivision.id
          ? {
              ...division,
              maxPositionPlayers: newPositionPlayers,
              maxPitchers: newPitchers,
              maxTotal: newPositionPlayers + newPitchers,
            }
          : division
      )
    );

    try {
      await adminFetch(
        `${API_BASE}/api/admin/divisions/${selectedDivision.id}/limits`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            maxPositionPlayers: newPositionPlayers,
            maxPitchers: newPitchers,
          }),
        }
      );

      showToast("Saved!");
      loadConfig();
    } catch (e) {
      console.log("SAVE LIMITS ERROR:", e);
      showToast("Save Failed");
    }
  }

  function getLeagueSources(division: Division | null) {
    return Array.isArray(division?.leagueAppsSources)
      ? division!.leagueAppsSources!
      : [];
  }

  function openLeagueSourceModal(source?: LeagueAppsSource, index?: number) {
    setEditingLeagueSourceIndex(typeof index === "number" ? index : null);
    setLeagueSourceName(source?.name || "");
    setLeagueSourceId(source?.id || "");
    setLeagueSourceEnabled(source?.enabled === true);
    setShowLeagueSourceModal(true);
  }

  function closeLeagueSourceModal() {
    setShowLeagueSourceModal(false);
    setEditingLeagueSourceIndex(null);
    setLeagueSourceName("");
    setLeagueSourceId("");
    setLeagueSourceEnabled(false);
  }

  async function persistLeagueSources(nextSources: LeagueAppsSource[]) {
    if (!selectedDivision) return false;

    try {
      setSavingLeagueSources(true);
      const response = await adminFetch(
        `${API_BASE}/api/admin/divisions/${selectedDivision.id}/league-sources`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sources: nextSources }),
        }
      );
      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || "LeagueApps sources could not be saved.");
      }

      const updatedDivision = json.division as Division;
      setSelectedDivision(updatedDivision);
      setDivisions((current) =>
        current.map((division) =>
          division.id === updatedDivision.id ? updatedDivision : division
        )
      );
      setTeams([]);
      await loadTeams(updatedDivision);
      showToast("League Sources Saved!");
      return true;
    } catch (e) {
      console.log("SAVE LEAGUE SOURCES ERROR:", e);
      showToast("League Source Save Failed");
      return false;
    } finally {
      setSavingLeagueSources(false);
    }
  }

  async function saveLeagueSource() {
    const cleanName = leagueSourceName.trim();
    const cleanId = leagueSourceId.trim();

    if (!cleanName || !/^\d+$/.test(cleanId)) {
      showToast("Enter a Name and Numeric League ID");
      return;
    }

    const current = [...getLeagueSources(selectedDivision)];
    const duplicateIndex = current.findIndex((source) => source.id === cleanId);

    if (duplicateIndex >= 0 && duplicateIndex !== editingLeagueSourceIndex) {
      showToast("That League ID Already Exists");
      return;
    }

    const nextSource = {
      id: cleanId,
      name: cleanName,
      enabled: leagueSourceEnabled,
    };

    if (editingLeagueSourceIndex === null) current.push(nextSource);
    else current[editingLeagueSourceIndex] = nextSource;

    if (await persistLeagueSources(current)) closeLeagueSourceModal();
  }

  async function removeLeagueSource() {
    if (editingLeagueSourceIndex === null) return;
    const current = getLeagueSources(selectedDivision).filter(
      (_, index) => index !== editingLeagueSourceIndex
    );
    if (await persistLeagueSources(current)) closeLeagueSourceModal();
  }

  async function toggleLeagueSource(index: number) {
    const current = getLeagueSources(selectedDivision).map((source, sourceIndex) =>
      sourceIndex === index ? { ...source, enabled: !source.enabled } : source
    );
    await persistLeagueSources(current);
  }

  function renderDivisionList() {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTabletLayout && styles.scrollContentTablet,
          isShortScreen && styles.scrollContentShort,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.replace("/admin")}
          >
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
            style={[styles.logo, isShortScreen && styles.logoShort]}
            resizeMode="contain"
          />

          <Text style={styles.title}>NTABL Division Configuration</Text>

          <Text style={styles.subtitle}>
            Configure Division Player Limits
          </Text>
        </View>

        {divisions.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.divisionCard}
            onPress={() => loadTeams(item)}
          >
            <View style={styles.divisionCardRow}>
              <View style={styles.divisionCardText}>
                <Text style={styles.divisionTitle}>{item.name}</Text>

                {submissionStatus[item.id] && (
                  <>
                    <Text style={styles.submittedText}>
                      ✅ Submitted: {submissionStatus[item.id].submitted}
                    </Text>

                    <Text style={styles.notSubmittedText}>
                      ❌ Not Submitted: {submissionStatus[item.id].notSubmitted}
                    </Text>

                    {submissionStatus[item.id].isComplete && (
                      <Text style={styles.completeText}>
                        🏆 ALL TEAMS SUBMITTED
                      </Text>
                    )}
                  </>
                )}

                <Text style={styles.divisionRules}>
                  Total: {item.maxTotal} | Pitchers: {item.maxPitchers} |
                  Position Players: {item.maxPositionPlayers}
                </Text>

                <Text
                  style={[
                    styles.lockStatus,
                    item.isLocked ? styles.lockedText : styles.unlockedText,
                  ]}
                >
                  {item.isLocked ? "🔒 Status: LOCKED" : "🔓 Status: OPEN"}
                </Text>
              </View>

              <Image
                source={divisionImages[item.id]}
                style={styles.divisionCardImage}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.versionFooter}>
          NTABL All-Star App • Version 1.0
        </Text>
      </ScrollView>
    );
  }

    function renderDivisionDetail() {
    if (!selectedDivision) return null;

    const currentSubmissionStatus = submissionStatus[selectedDivision.id];

    return (
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTabletLayout && styles.scrollContentTablet,
          isShortScreen && styles.scrollContentShort,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.teamScreenHeader}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              setShowTeamsScreen(false);
              loadConfig();
            }}
          >
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
            source={divisionDetailImages[selectedDivision.id]}
            style={styles.divisionImage}
            resizeMode="contain"
          />

          <Text style={styles.title}>{selectedDivision.name}</Text>

          <View style={styles.teamTotalsRow}>
            <Text style={styles.eastTotal}>East: {eastCount}</Text>
            <Text style={styles.westTotal}>West: {westCount}</Text>
            <Text style={styles.unassignedTotal}>
              Unassigned: {unassignedCount}
            </Text>
          </View>
        </View>

        {currentSubmissionStatus && (
          <View style={styles.submissionListBox}>
            <Text style={styles.submissionListTitle}>Submitted Teams</Text>

            <View style={styles.submittedBubble}>
              {currentSubmissionStatus.submittedTeams.length > 0 ? (
                <View style={styles.submissionTeamGrid}>
                  {currentSubmissionStatus.submittedTeams.map((team: string) => (
                    <Text key={team} style={styles.submittedTeamItem}>
                      ✅ {team}
                    </Text>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptySubmissionText}>
                  No teams submitted yet.
                </Text>
              )}
            </View>

            <Text style={styles.submissionListTitle}>Pending Teams</Text>

            <View style={styles.pendingBubble}>
              <View style={styles.submissionTeamGrid}>
                {currentSubmissionStatus.pendingTeams.map((team: string) => (
                  <Text key={team} style={styles.pendingTeamItem}>
                    ❌ {team}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        )}

        <View style={styles.controlCard}>
          <View style={styles.pickerGroup}>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>POSITIONS</Text>

              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => {
                  if (!selectedDivision.isLocked) {
                    setShowPosModal(true);
                  }
                }}
              >
                <Text style={styles.dropdownText}>{positionPlayersLimit}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>PITCHERS</Text>

              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => {
                  if (!selectedDivision.isLocked) {
                    setShowPitModal(true);
                  }
                }}
              >
                <Text style={styles.dropdownText}>{pitchersLimit}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              disabled={selectedDivision.isLocked}
              onPress={clearDivisionAssignments}
              style={[
                styles.clearButton,
                selectedDivision.isLocked && styles.disabledButton,
              ]}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color="#ffffff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.clearButtonText}>Clear</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleDivisionLock}
              style={[
                styles.lockButton,
                selectedDivision.isLocked
                  ? styles.unlockButton
                  : styles.lockDivisionButton,
              ]}
            >
              <View style={styles.buttonContentRow}>
                <Ionicons
                  name={
                    selectedDivision.isLocked
                      ? "lock-open-outline"
                      : "lock-closed-outline"
                  }
                  size={18}
                  color="#ffffff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.lockButtonText}>
                  {selectedDivision.isLocked ? "Unlock" : "Lock"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.leagueSourcesCard}>
          <Text style={styles.leagueSourcesTitle}>LeagueApps Sources</Text>
          <Text style={styles.leagueSourcesHelp}>
            Only enabled leagues appear for managers, rosters, submissions, waivers, and reports.
          </Text>

          {getLeagueSources(selectedDivision).map((source, index) => (
            <View key={`${source.id}-${index}`} style={styles.leagueSourceRow}>
              <View style={styles.leagueSourceText}>
                <Text style={styles.leagueSourceName}>{source.name}</Text>
                <Text style={styles.leagueSourceId}>League ID: {source.id}</Text>
                <Text
                  style={[
                    styles.leagueSourceStatus,
                    source.enabled ? styles.sourceEnabledText : styles.sourceDisabledText,
                  ]}
                >
                  {source.enabled ? "INCLUDED IN ALL-STAR APP" : "EXCLUDED FROM ALL-STAR APP"}
                </Text>
              </View>

              <View style={styles.leagueSourceActions}>
                <TouchableOpacity
                  style={[
                    styles.sourceToggleButton,
                    source.enabled ? styles.sourceDisableButton : styles.sourceEnableButton,
                  ]}
                  onPress={() => toggleLeagueSource(index)}
                  disabled={savingLeagueSources}
                >
                  <Text style={styles.sourceActionText}>
                    {source.enabled ? "Disable" : "Enable"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sourceEditButton}
                  onPress={() => openLeagueSourceModal(source, index)}
                  disabled={savingLeagueSources}
                >
                  <Text style={styles.sourceActionText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.addLeagueSourceButton}
            onPress={() => openLeagueSourceModal()}
            disabled={savingLeagueSources}
          >
            <View style={styles.buttonContentRow}>
              <Ionicons name="add-circle-outline" size={20} color="#ffffff" style={{ marginRight: 7 }} />
              <Text style={styles.addLeagueSourceText}>Add League Source</Text>
            </View>
          </TouchableOpacity>
        </View>

        {loadingTeams ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#1d4ed8" />
            <Text style={styles.loadingText}>Loading teams...</Text>
          </View>
        ) : (
          teams.map((item) => (
            <View key={item.id} style={styles.teamCard}>
              <View style={styles.teamTextBlock}>
                <Text style={styles.teamName}>{item.name}</Text>
                <Text style={styles.teamId}>Team ID: {item.id}</Text>
              </View>

              <View style={styles.squadButtonRow}>
                <TouchableOpacity
                  disabled={selectedDivision.isLocked}
                  onPress={() => assignSquad(item.id, "East")}
                  style={[
                    styles.squadButton,
                    styles.squadButtonMargin,
                    item.squad === "East" && styles.eastBadge,
                    selectedDivision.isLocked && styles.disabledButton,
                  ]}
                >
                  <Text style={styles.squadButtonText}>East</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={selectedDivision.isLocked}
                  onPress={() => assignSquad(item.id, "West")}
                  style={[
                    styles.squadButton,
                    item.squad === "West" && styles.westBadge,
                    selectedDivision.isLocked && styles.disabledButton,
                  ]}
                >
                  <Text style={styles.squadButtonText}>West</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity
          disabled={selectedDivision.isLocked}
          onPress={() =>
            saveDivisionLimits(positionPlayersLimit, pitchersLimit)
          }
          style={[
            styles.bottomSaveButton,
            selectedDivision.isLocked && styles.disabledButton,
          ]}
        >
          <View style={styles.buttonContentRow}>
            <Ionicons
              name="save-outline"
              size={22}
              color="#ffffff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.bottomSaveButtonText}>
              Save Division Configuration
            </Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.versionFooter}>
          NTABL All-Star App • Version 1.0
        </Text>
      </ScrollView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#1d4ed8" />
              <Text style={styles.loadingText}>Loading divisions...</Text>
            </View>
          ) : showTeamsScreen && selectedDivision ? (
            renderDivisionDetail()
          ) : (
            renderDivisionList()
          )}
        </View>

        {toastMessage ? (
          <View pointerEvents="none" style={styles.toastOverlay}>
            <View style={styles.saveToast}>
              <Ionicons
                name="checkmark-circle"
                size={42}
                color="#15803d"
                style={{ marginBottom: 6 }}
              />

              <Text style={styles.saveToastText}>{toastMessage}</Text>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <Modal visible={showPosModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Position Players</Text>

            {[...Array(11)].map((_, i) => (
              <TouchableOpacity
                key={i}
                style={styles.modalOption}
                onPress={() => {
                  setPositionPlayersLimit(i);
                  setShowPosModal(false);
                }}
              >
                <Text style={styles.modalOptionText}>{i}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={showPitModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Pitchers</Text>

            {[...Array(6)].map((_, i) => (
              <TouchableOpacity
                key={i}
                style={styles.modalOption}
                onPress={() => {
                  setPitchersLimit(i);
                  setShowPitModal(false);
                }}
              >
                <Text style={styles.modalOptionText}>{i}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLeagueSourceModal}
        transparent
        animationType="fade"
        onRequestClose={closeLeagueSourceModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.leagueSourceModalCard}>
            <Ionicons name="cloud-outline" size={48} color="#1d4ed8" style={{ marginBottom: 8 }} />
            <Text style={styles.modalTitle}>LeagueApps Source</Text>

            <Text style={styles.sourceFieldLabel}>Display Name</Text>
            <TextInput
              style={styles.sourceInput}
              value={leagueSourceName}
              onChangeText={setLeagueSourceName}
              placeholder="Example: 2026 Summer Rookie"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.sourceFieldLabel}>LeagueApps League ID</Text>
            <TextInput
              style={styles.sourceInput}
              value={leagueSourceId}
              onChangeText={setLeagueSourceId}
              keyboardType="numeric"
              placeholder="Example: 5009019"
              placeholderTextColor="#9ca3af"
            />

            <TouchableOpacity
              style={[
                styles.sourceModalToggle,
                leagueSourceEnabled ? styles.sourceModalEnabled : styles.sourceModalDisabled,
              ]}
              onPress={() => setLeagueSourceEnabled((current) => !current)}
            >
              <Ionicons
                name={leagueSourceEnabled ? "checkmark-circle" : "close-circle"}
                size={22}
                color="#ffffff"
                style={{ marginRight: 7 }}
              />
              <Text style={styles.sourceModalToggleText}>
                {leagueSourceEnabled ? "Included in All-Star App" : "Excluded from All-Star App"}
              </Text>
            </TouchableOpacity>

            <View style={styles.sourceModalButtonRow}>
              <TouchableOpacity style={styles.sourceCancelButton} onPress={closeLeagueSourceModal}>
                <Text style={styles.sourceActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sourceSaveButton}
                onPress={saveLeagueSource}
                disabled={savingLeagueSources}
              >
                <Text style={styles.sourceActionText}>
                  {savingLeagueSources ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>

            {editingLeagueSourceIndex !== null && (
              <TouchableOpacity
                style={styles.sourceRemoveButton}
                onPress={removeLeagueSource}
                disabled={savingLeagueSources}
              >
                <Text style={styles.sourceActionText}>Remove League Source</Text>
              </TouchableOpacity>
            )}
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
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
  },

  scrollContent: {
    paddingBottom: 70,
  },

  scrollContentTablet: {
    paddingBottom: 50,
  },

  scrollContentShort: {
    paddingBottom: 80,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 10,
  },

  teamScreenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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

  smallButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
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
    width: 150,
    height: 150,
    alignSelf: "center",
    marginBottom: 8,
  },

  logoShort: {
    width: 130,
    height: 130,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 21,
  },

  divisionCard: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 20,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },

  divisionCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  divisionCardText: {
    flex: 1,
    paddingRight: 10,
  },

  divisionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 6,
  },

  divisionRules: {
    color: "#4b5563",
    fontWeight: "700",
    marginBottom: 6,
  },

  divisionCardImage: {
    width: 76,
    height: 76,
  },

  lockStatus: {
    fontWeight: "900",
  },

  lockedText: {
    color: "#c62828",
  },

  unlockedText: {
    color: "#15803d",
  },

  submittedText: {
    color: "#15803d",
    fontWeight: "900",
    fontSize: 15,
    marginBottom: 2,
  },

  notSubmittedText: {
    color: "#c62828",
    fontWeight: "900",
    fontSize: 15,
    marginBottom: 6,
  },

  completeText: {
    color: "#15803d",
    fontWeight: "900",
    fontSize: 15,
    marginBottom: 6,
  },

  divisionImage: {
    width: "100%",
    height: 120,
    marginBottom: 12,
  },

  teamTotalsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 2,
  },

  eastTotal: {
    color: "#c62828",
    fontWeight: "900",
    fontSize: 15,
    marginHorizontal: 8,
  },

  westTotal: {
    color: "#1565c0",
    fontWeight: "900",
    fontSize: 15,
    marginHorizontal: 8,
  },

  unassignedTotal: {
    color: "#6b7280",
    fontWeight: "900",
    fontSize: 15,
    marginHorizontal: 8,
  },

  submissionListBox: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },

  submissionListTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1f4e9e",
    marginBottom: 8,
    marginTop: 4,
    textAlign: "center",
  },

  submissionTeamGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  submittedBubble: {
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },

  pendingBubble: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },

  submittedTeamItem: {
    width: "50%",
    color: "#15803d",
    fontWeight: "800",
    marginBottom: 4,
  },

  pendingTeamItem: {
    width: "50%",
    color: "#c62828",
    fontWeight: "800",
    marginBottom: 4,
  },

  emptySubmissionText: {
    color: "#6b7280",
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },

  controlCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },

  pickerGroup: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  pickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 6,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: "#1d4ed8",
    paddingVertical: 4,
  },

  pickerLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#ffffff",
    backgroundColor: "#15803d",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 9,
    marginRight: 5,
    overflow: "hidden",
  },

  dropdownButton: {
    width: 50,
    height: 36,
    borderRadius: 9,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    justifyContent: "center",
    alignItems: "center",
  },

  dropdownText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
  },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  saveLimitsButton: {
    backgroundColor: "#15803d",
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },

  saveLimitsButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },

  bottomSaveButton: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 6,
  },

  bottomSaveButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
  },

  clearButton: {
    backgroundColor: "#6b7280",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
    flex: 1,
    alignItems: "center",
  },

  clearButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 14,
  },

  lockButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flex: 1,
    alignItems: "center",
  },

  lockDivisionButton: {
    backgroundColor: "#c62828",
  },

  unlockButton: {
    backgroundColor: "#15803d",
  },

  lockButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 14,
  },

  disabledButton: {
    opacity: 0.45,
  },

  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },

  loadingText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
  },

  teamCard: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 5,
  },

  teamTextBlock: {
    flex: 1,
    paddingRight: 10,
  },

  teamName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },

  teamId: {
    color: "#6b7280",
    marginTop: 4,
    fontWeight: "700",
  },

  squadButtonRow: {
    flexDirection: "row",
  },

  squadButton: {
    backgroundColor: "#9ca3af",
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 999,
  },

  squadButtonMargin: {
    marginRight: 6,
  },

  squadButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 12,
  },

  eastBadge: {
    backgroundColor: "#c62828",
  },

  westBadge: {
    backgroundColor: "#1565c0",
  },

  modalOverlay: {
  ...modalStyles.overlay,
},

modalCard: {
  ...modalStyles.compactCard,
},

  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 10,
  },

  modalOption: {
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },

  modalOptionText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },

  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  toastOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
    zIndex: 99999,
  },

saveToast: {
  ...modalStyles.card,
  backgroundColor: "#ffffff",
  alignItems: "center",
  justifyContent: "center",
  elevation: 12,
},

saveToastText: {
  color: "#15803d",
  fontSize: 26,
  fontWeight: "900",
  textAlign: "center",
},

  leagueSourcesCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  leagueSourcesTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1f4e9e",
    textAlign: "center",
  },
  leagueSourcesHelp: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 17,
    marginTop: 5,
    marginBottom: 12,
  },
  leagueSourceRow: {
    borderWidth: 1,
    borderColor: "#dbe5f1",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#f8fafc",
  },
  leagueSourceText: { marginBottom: 10 },
  leagueSourceName: { fontSize: 16, fontWeight: "900", color: "#111827" },
  leagueSourceId: { color: "#6b7280", fontWeight: "800", marginTop: 3 },
  leagueSourceStatus: { fontSize: 11, fontWeight: "900", marginTop: 6 },
  sourceEnabledText: { color: "#15803d" },
  sourceDisabledText: { color: "#c62828" },
  leagueSourceActions: { flexDirection: "row" },
  sourceToggleButton: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center", marginRight: 5 },
  sourceEnableButton: { backgroundColor: "#15803d" },
  sourceDisableButton: { backgroundColor: "#c62828" },
  sourceEditButton: { flex: 1, backgroundColor: "#1d4ed8", borderRadius: 10, paddingVertical: 10, alignItems: "center", marginLeft: 5 },
  sourceActionText: { color: "#ffffff", fontWeight: "900", fontSize: 14 },
  addLeagueSourceButton: { backgroundColor: "#1f4e9e", borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 2 },
  addLeagueSourceText: { color: "#ffffff", fontSize: 15, fontWeight: "900" },
  leagueSourceModalCard: { ...modalStyles.card, alignItems: "center" },
  sourceFieldLabel: { alignSelf: "flex-start", color: "#6b7280", fontSize: 12, fontWeight: "900", textTransform: "uppercase", marginTop: 8, marginBottom: 4 },
  sourceInput: { width: "100%", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, color: "#111827", fontSize: 15, fontWeight: "700", backgroundColor: "#ffffff" },
  sourceModalToggle: { width: "100%", flexDirection: "row", justifyContent: "center", alignItems: "center", borderRadius: 12, paddingVertical: 12, marginTop: 14 },
  sourceModalEnabled: { backgroundColor: "#15803d" },
  sourceModalDisabled: { backgroundColor: "#c62828" },
  sourceModalToggleText: { color: "#ffffff", fontSize: 15, fontWeight: "900" },
  sourceModalButtonRow: { flexDirection: "row", width: "100%", marginTop: 16 },
  sourceCancelButton: { flex: 1, backgroundColor: "#6b7280", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginRight: 6 },
  sourceSaveButton: { flex: 1, backgroundColor: "#1d4ed8", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginLeft: 6 },
  sourceRemoveButton: { width: "100%", backgroundColor: "#c62828", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 10 },

  versionFooter: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 20,
    marginBottom: 8,
  },
});
