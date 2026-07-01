import Constants from "expo-constants";
import { Platform } from "react-native";
import { getAdminToken } from "../stores/adminstore";

const DEV_API_BASE =
  Platform.OS === "web"
    ? "https://ntabl-backend.onrender.com"
    : "https://ntabl-backend.onrender.com";

export const API_BASE =
  Constants.expoConfig?.extra?.apiBase || DEV_API_BASE;

export const ADMIN_API_KEY =
  Constants.expoConfig?.extra?.adminApiKey ||
  "NTABL_ADMIN_LOCAL_2026_5X!!rt867qbzxXyGe435309";

export async function adminFetch(url: string, options: RequestInit = {}) {
  const token = await getAdminToken();

  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-api-key": ADMIN_API_KEY,
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
      ...(options.headers || {}),
    },
  });
}