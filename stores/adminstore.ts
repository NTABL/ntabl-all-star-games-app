import AsyncStorage from "@react-native-async-storage/async-storage";

const ADMIN_KEY = "ntabl_admin_logged_in";
const ADMIN_TOKEN_KEY = "ntabl_admin_token";

export async function setAdminLoggedIn(
  value: boolean,
  token?: string
) {
  await AsyncStorage.setItem(
    ADMIN_KEY,
    value ? "true" : "false"
  );

  if (value && token) {
    await AsyncStorage.setItem(
      ADMIN_TOKEN_KEY,
      token
    );
  }
}

export async function isAdminLoggedIn() {
  const value = await AsyncStorage.getItem(ADMIN_KEY);
  return value === "true";
}

export async function getAdminToken() {
  return await AsyncStorage.getItem(
    ADMIN_TOKEN_KEY
  );
}

export async function clearAdminLogin() {
  await AsyncStorage.removeItem(ADMIN_KEY);
  await AsyncStorage.removeItem(ADMIN_TOKEN_KEY);
}