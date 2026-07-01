import { Platform, Text } from "react-native";

type Props = {
  name: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: string;
  style?: any;
};

const webIconMap: Record<string, string> = {
  "baseball-outline": "⚾",
  heart: "❤️",
  "mic-outline": "🎤",
  "download-outline": "⬇️",
  "chevron-back-outline": "‹",
  "log-out-outline": "↪",
  "refresh": "↻",
  people: "👥",
  "people-outline": "👥",
  "person-outline": "👤",
  "lock-closed-outline": "🔒",
  "settings-outline": "⚙️",
  "clipboard-outline": "📋",
  "checkmark-circle": "✅",
  "checkmark-circle-outline": "✅",
  "close-circle-outline": "✖️",
  "trash-outline": "🗑️",
  "save-outline": "💾",
  "eye-outline": "👁️",
  "eye-off-outline": "🙈",
  "finger-print-outline": "🔐",
  "key-outline": "🔑",
  "mail-outline": "✉️",
  "paper-plane-outline": "📨",
  "calendar-outline": "📅",
  "warning-outline": "⚠️",
  warning: "⚠️",
  "alert-circle": "⚠️",
  "alert-circle-outline": "⚠️",
};

export default function AppIcon({ name, size = 22, color, style }: Props) {
  if (Platform.OS === "web") {
    return (
      <Text
        style={[
          {
            fontSize: size,
            lineHeight: size + 2,
            color,
          },
          style,
        ]}
      >
        {webIconMap[String(name)] || "•"}
      </Text>
    );
  }

  return <AppIcon name={name} size={size} color={color} style={style} />;
}