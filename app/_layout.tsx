import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

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
    if (Platform.OS === "web") return;

    const subscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const content = response.notification.request.content;
        router.replace({
          pathname: "/seasonschedules",
          params: {
            alertTitle: String(content.title || "Team Alert"),
            alertMessage: String(content.body || ""),
            alertId: String(response.notification.request.identifier || Date.now()),
          },
        });
      });

    return () => subscription.remove();
  }, [router]);

  return <Stack />;
}
