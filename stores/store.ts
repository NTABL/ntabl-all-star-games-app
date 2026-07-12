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

export async function switchManagerAssignment(assignmentKey: string) {
  const current = await getManagerContext();
  const assignments = Array.isArray(current?.assignments)
    ? current.assignments
    : [];

  const selected = assignments.find(
    (assignment: any) => assignment?.assignmentKey === assignmentKey
  );

  if (!selected) return null;

  const nextContext = {
    ...selected,
    assignments,
    activeAssignmentKey: assignmentKey,
  };

  await setManagerContext(nextContext);
  return nextContext;
}
