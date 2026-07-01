import AsyncStorage from "@react-native-async-storage/async-storage";

const MANAGER_KEY = "ntabl_manager_context";

let managerCache: any = null;

export async function setManagerContext(data: any) {
  managerCache = data;
  await AsyncStorage.setItem(MANAGER_KEY, JSON.stringify(data));
}

export async function getManagerContext() {
  if (managerCache) return managerCache;

  const saved = await AsyncStorage.getItem(MANAGER_KEY);
  if (!saved) return null;

  managerCache = JSON.parse(saved);
  return managerCache;
}

export async function clearManagerContext() {
  managerCache = null;
  await AsyncStorage.removeItem(MANAGER_KEY);
}