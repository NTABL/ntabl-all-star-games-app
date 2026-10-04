import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { getManagerContext } from "../stores/store";

export default function Layout() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const manifestLink = document.createElement("link");
    manifestLink.rel = "manifest";
    manifestLink.href = "/manifest.json";
    document.head.appendChild(manifestLink);

    const iconLink = document.createElement("link");
    iconLink.rel = "icon";
    iconLink.href = "/NTABL-Logo.png";
    document.head.appendChild(iconLink);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.log);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const manager = await getManagerContext();

        if (active && manager) {
          router.replace("/dashboard");
        }
      } catch (error) {
        console.log("SESSION RESTORE ERROR:", error);
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const openNotification = (response: Notifications.NotificationResponse) => {
      const content = response.notification.request.content;
      const data: any = content.data || {};
      const screen = String(data.screen || "").trim().toLowerCase();

      if (screen === "teamchat") {
        router.replace({
          pathname: "/teamchat",
          params: {
            programId: String(data.programId || ""),
            teamId: String(data.teamId || ""),
          },
        });
        return;
      }

      if (screen === "seasonschedules") {
        router.replace({
          pathname: "/seasonschedules",
          params: {
            programId: String(data.programId || ""),
            teamId: String(data.teamId || ""),
            gameId: String(data.gameId || ""),
            alertId: String(
              data.alertId ||
                response.notification.request.identifier ||
                Date.now(),
            ),
            alertTitle: String(content.title || "Team Alert"),
            alertMessage: String(content.body || ""),
          },
        });
        return;
      }

      router.replace("/dashboard");
    };

    const subscription =
      Notifications.addNotificationResponseReceivedListener(openNotification);

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          openNotification(response);
        }
      })
      .catch((error) => {
        console.log("LAST NOTIFICATION RESPONSE ERROR:", error);
      });

    return () => subscription.remove();
  }, [router]);

  return <Stack />;
}
