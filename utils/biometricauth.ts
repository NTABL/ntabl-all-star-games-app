import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const MANAGER_EMAIL_KEY = "ntabl_manager_email";
const MANAGER_PASSWORD_KEY = "ntabl_manager_password";

const ADMIN_PASSWORD_KEY = "ntabl_admin_password";

export async function canUseBiometrics() {
  if (Platform.OS === "web") return false;

  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  return hasHardware && isEnrolled;
}

export async function authenticateWithBiometrics() {
  if (Platform.OS === "web") return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Use Fingerprint / Face ID",
    fallbackLabel: "Use Passcode",
    cancelLabel: "Cancel",
  });

  return result.success;
}

export async function saveManagerCredentials(email: string, password: string) {
  if (Platform.OS === "web") return;

  await SecureStore.setItemAsync(MANAGER_EMAIL_KEY, email);
  await SecureStore.setItemAsync(MANAGER_PASSWORD_KEY, password);
}

export async function getManagerCredentials() {
  if (Platform.OS === "web") return null;

  const email = await SecureStore.getItemAsync(MANAGER_EMAIL_KEY);
  const password = await SecureStore.getItemAsync(MANAGER_PASSWORD_KEY);

  if (!email || !password) return null;

  return { email, password };
}

export async function saveAdminPassword(password: string) {
  if (Platform.OS === "web") return;

  await SecureStore.setItemAsync(ADMIN_PASSWORD_KEY, password);
}

export async function getAdminPassword() {
  if (Platform.OS === "web") return null;

  return SecureStore.getItemAsync(ADMIN_PASSWORD_KEY);
}