import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getManagerContext } from "../stores/store";
import { API_BASE } from "../utils/appconfig";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ChatMessage = {
  id: string;
  personId: string;
  senderName: string;
  message: string;
  createdAt: string;
  isManager?: boolean;
};

export default function TeamChat() {
  const insets = useSafeAreaInsets();
  const [manager, setManager] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [canClearChat, setCanClearChat] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const managerRef = useRef<any>(null);

  function getPersonId(context: any) {
    return String(
      context?.playerId ||
        context?.leagueAppsId ||
        ""
    ).trim();
  }

  const loadChat = useCallback(
    async (context?: any, showLoading = false) => {
      const activeManager = context || managerRef.current;

      if (!activeManager) return;

      const programId = String(activeManager?.programId || "").trim();
      const teamId = String(activeManager?.teamId || "").trim();
      const personId = getPersonId(activeManager);

      if (!programId || !teamId || !personId) {
        setErrorMessage("Team Chat is not available for this assignment.");
        setLoading(false);
        return;
      }

      try {
        if (showLoading) {
          setLoading(true);
        }

        const response = await fetch(
          `${API_BASE}/api/team-chat?programId=${encodeURIComponent(
            programId
          )}&teamId=${encodeURIComponent(
            teamId
          )}&personId=${encodeURIComponent(personId)}`,
          {
            cache: "no-store",
          }
        );

        const json = await response.json();

        if (!response.ok || !json?.ok) {
          throw new Error(json?.message || "Team Chat could not be loaded.");
        }

        setMessages(Array.isArray(json.messages) ? json.messages : []);
        setCanClearChat(json.canClearChat === true);
        setErrorMessage("");
      } catch (error) {
        console.log("TEAM CHAT LOAD ERROR:", error);

        if (showLoading) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Team Chat could not be loaded."
          );
        }
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function initializeChat() {
        try {
          setLoading(true);

          const context = await getManagerContext();

          if (!active) return;

          if (!context) {
            router.replace("/login");
            return;
          }

          managerRef.current = context;
          setManager(context);

          await loadChat(context, true);
        } catch (error) {
          console.log("TEAM CHAT INITIALIZE ERROR:", error);

          if (active) {
            setErrorMessage("Team Chat could not be loaded.");
            setLoading(false);
          }
        }
      }

      initializeChat();

      return () => {
        active = false;
      };
    }, [loadChat])
  );

  useEffect(() => {
    if (!manager) return;

    const interval = setInterval(() => {
      loadChat();
    }, 5000);

    return () => clearInterval(interval);
  }, [manager, loadChat]);

  useEffect(() => {
    if (messages.length === 0) return;

    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 100);

    return () => clearTimeout(timer);
  }, [messages.length]);

  async function sendMessage() {
    const cleanMessage = messageText.trim();

    if (!cleanMessage || sending || !manager) return;

    const programId = String(manager?.programId || "").trim();
    const teamId = String(manager?.teamId || "").trim();
    const personId = getPersonId(manager);

    try {
      setSending(true);

      const response = await fetch(`${API_BASE}/api/team-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          programId,
          teamId,
          personId,
          message: cleanMessage,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || "Your message could not be sent.");
      }

      setMessageText("");

      if (json.message) {
        setMessages((current) => [...current, json.message]);
      } else {
        await loadChat();
      }
    } catch (error) {
      console.log("TEAM CHAT SEND ERROR:", error);

      Alert.alert(
        "Message Not Sent",
        error instanceof Error
          ? error.message
          : "Your message could not be sent."
      );
    } finally {
      setSending(false);
    }
  }

  function requestClearChat() {
    Alert.alert(
      "Clear Team Chat?",
      "This will permanently remove all messages from this team's chat. This cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear Chat",
          style: "destructive",
          onPress: clearChat,
        },
      ]
    );
  }

  async function clearChat() {
    if (!manager || clearing) return;

    const programId = String(manager?.programId || "").trim();
    const teamId = String(manager?.teamId || "").trim();
    const personId = getPersonId(manager);

    try {
      setClearing(true);

      const response = await fetch(`${API_BASE}/api/team-chat/clear`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          programId,
          teamId,
          personId,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || "Team Chat could not be cleared.");
      }

      setMessages([]);

      Alert.alert(
        "Team Chat Cleared",
        "All messages have been removed from this team's chat."
      );
    } catch (error) {
      console.log("TEAM CHAT CLEAR ERROR:", error);

      Alert.alert(
        "Chat Not Cleared",
        error instanceof Error
          ? error.message
          : "Team Chat could not be cleared."
      );
    } finally {
      setClearing(false);
    }
  }

  function formatTimestamp(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString([], {
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const mine = String(item.personId) === getPersonId(manager);

    return (
      <View
        style={[
          styles.messageRow,
          mine ? styles.messageRowMine : styles.messageRowOther,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            mine ? styles.messageBubbleMine : styles.messageBubbleOther,
          ]}
        >
          <View style={styles.senderRow}>
            <Text
              style={[
                styles.senderName,
                mine && styles.senderNameMine,
              ]}
            >
              {mine ? "You" : item.senderName}
            </Text>

            {item.isManager && (
              <View
                style={[
                  styles.managerBadge,
                  mine && styles.managerBadgeMine,
                ]}
              >
                <Text
                  style={[
                    styles.managerBadgeText,
                    mine && styles.managerBadgeTextMine,
                  ]}
                >
                  MANAGER
                </Text>
              </View>
            )}
          </View>

          <Text
            style={[
              styles.messageText,
              mine && styles.messageTextMine,
            ]}
          >
            {item.message}
          </Text>

          <Text
            style={[
              styles.timestamp,
              mine && styles.timestampMine,
            ]}
          >
            {formatTimestamp(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color="#ffffff"
            />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>

          <View style={styles.headerCenter}>
            <View style={styles.titleRow}>
              <Ionicons
                name="chatbubbles"
                size={24}
                color="#ffffff"
                style={{ marginRight: 7 }}
              />
              <Text style={styles.headerTitle}>Team Chat</Text>
            </View>

            <Text
              style={styles.headerTeam}
              numberOfLines={1}
            >
              {manager?.teamName || ""}
            </Text>

            <Text
              style={styles.headerDivision}
              numberOfLines={1}
            >
              {manager?.division || ""}
            </Text>
          </View>

          <View style={styles.headerRight}>
            {canClearChat && (
              <Pressable
                style={[
                  styles.clearButton,
                  clearing && { opacity: 0.55 },
                ]}
                disabled={clearing}
                onPress={requestClearChat}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color="#ffffff"
                />
                <Text style={styles.clearButtonText}>
                  {clearing ? "Clearing" : "Clear"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.chatArea}>
          {loading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>
                Loading Team Chat...
              </Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.centerContent}>
              <Ionicons
                name="alert-circle-outline"
                size={52}
                color="#c62828"
              />

              <Text style={styles.errorTitle}>
                Team Chat Unavailable
              </Text>

              <Text style={styles.errorText}>
                {errorMessage}
              </Text>

              <Pressable
                style={styles.retryButton}
                onPress={() => loadChat(manager, true)}
              >
                <Text style={styles.retryButtonText}>
                  Try Again
                </Text>
              </Pressable>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.centerContent}>
              <Ionicons
                name="chatbubbles-outline"
                size={64}
                color="#9ca3af"
              />

              <Text style={styles.emptyTitle}>
                No Messages Yet
              </Text>

              <Text style={styles.emptyText}>
                Start the conversation with your team.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() =>
                listRef.current?.scrollToEnd({
                  animated: false,
                })
              }
            />
          )}
        </View>

        {!loading && !errorMessage && (
          <View
  style={[
    styles.composer,
    {
      paddingBottom:
        Platform.OS === "android"
          ? Math.max(insets.bottom, 12)
          : 28,
    },
  ]}
>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Message your team..."
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={500}
                editable={!sending}
              />

              {messageText.length > 400 && (
                <Text style={styles.characterCount}>
                  {messageText.length}/500
                </Text>
              )}
            </View>

            <Pressable
              style={[
                styles.sendButton,
                (!messageText.trim() || sending) &&
                  styles.sendButtonDisabled,
              ]}
              disabled={!messageText.trim() || sending}
              onPress={sendMessage}
            >
              {sending ? (
                <ActivityIndicator
                  size="small"
                  color="#ffffff"
                />
              ) : (
                <Ionicons
                  name="send"
                  size={22}
                  color="#ffffff"
                />
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },

  header: {
    backgroundColor: "#1f4e9e",
    paddingTop: Platform.OS === "ios" ? 54 : 36,
    paddingBottom: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 120,
  },

  backButton: {
    width: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },

  backButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },

  headerTeam: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
    maxWidth: "100%",
  },

  headerDivision: {
    color: "#dbeafe",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 1,
    maxWidth: "100%",
  },

  headerRight: {
    width: 76,
    alignItems: "flex-end",
  },

  clearButton: {
    backgroundColor: "#c62828",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
    alignItems: "center",
    minWidth: 60,
  },

  clearButtonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 1,
  },

  chatArea: {
    flex: 1,
  },

  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  loadingText: {
    color: "#4b5563",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 12,
  },

  errorTitle: {
    color: "#c62828",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
  },

  errorText: {
    color: "#4b5563",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 7,
  },

  retryButton: {
    backgroundColor: "#1f4e9e",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 24,
    marginTop: 18,
  },

  retryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  emptyTitle: {
    color: "#374151",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 12,
  },

  emptyText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 5,
    textAlign: "center",
  },

  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },

  messageRow: {
    width: "100%",
    marginBottom: 10,
  },

  messageRowMine: {
    alignItems: "flex-end",
  },

  messageRowOther: {
    alignItems: "flex-start",
  },

  messageBubble: {
    maxWidth: "82%",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingTop: 10,
    paddingBottom: 8,
  },

  messageBubbleMine: {
    backgroundColor: "#1f4e9e",
    borderBottomRightRadius: 4,
  },

  messageBubbleOther: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 3,
  },

  senderName: {
    color: "#1f4e9e",
    fontSize: 12,
    fontWeight: "900",
  },

  senderNameMine: {
    color: "#ffffff",
  },

  managerBadge: {
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },

  managerBadgeMine: {
    backgroundColor: "#ffffff",
  },

  managerBadgeText: {
    color: "#1f4e9e",
    fontSize: 8,
    fontWeight: "900",
  },

  managerBadgeTextMine: {
    color: "#1f4e9e",
  },

  messageText: {
    color: "#111827",
    fontSize: 16,
    lineHeight: 21,
  },

  messageTextMine: {
    color: "#ffffff",
  },

  timestamp: {
    color: "#9ca3af",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 5,
    textAlign: "right",
  },

  timestampMine: {
    color: "#dbeafe",
  },

  composer: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingTop: 9,
    flexDirection: "row",
    alignItems: "flex-end",
  },

  inputWrap: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 4,
    marginRight: 8,
  },

  input: {
    color: "#111827",
    fontSize: 16,
    minHeight: 40,
    maxHeight: 110,
    paddingTop: 9,
    paddingBottom: 8,
  },

  characterCount: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "right",
    paddingBottom: 3,
  },

  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#15803d",
    alignItems: "center",
    justifyContent: "center",
  },

  sendButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
});