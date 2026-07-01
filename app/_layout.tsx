import { Stack } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

export default function Layout() {
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

  return <Stack />;
}
