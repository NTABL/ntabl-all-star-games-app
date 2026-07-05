import Constants from "expo-constants";
import { Platform } from "react-native";
import { getAuthToken } from "../stores/adminstore";

const DEV_API_BASE =
  Platform.OS === "web"
    ? "https://ntabl-backend.onrender.com"
    : "https://ntabl-backend.onrender.com";

export const API_BASE =
  Constants.expoConfig?.extra?.apiBase || DEV_API_BASE;

export async function adminFetch(
  url: string,
  options: RequestInit = {}
) {
  const token = await getAuthToken();

  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
      ...(options.headers || {}),
    },
  });
}