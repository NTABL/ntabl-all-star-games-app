import AsyncStorage from "@react-native-async-storage/async-storage";

const MANAGER_KEY = "ntabl_manager_context";
const ADMIN_CONTEXT_KEY = "ntabl_pre_impersonation_context";

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
  await AsyncStorage.multiRemove([MANAGER_KEY, ADMIN_CONTEXT_KEY]);
}

export async function beginImpersonation(impersonatedContext: any) {
  const current = await getManagerContext();

  if (current && !current?.isImpersonating) {
    await AsyncStorage.setItem(ADMIN_CONTEXT_KEY, JSON.stringify(current));
  }

  await setManagerContext(impersonatedContext);
  return impersonatedContext;
}

export async function switchManagerAssignment(assignmentKey: string) {
  const current = await getManagerContext();
  const assignments = Array.isArray(current?.assignments)
    ? current.assignments
    : [];

  const selected = assignments.find(
    (assignment: any) =>
      String(assignment?.assignmentKey || "") === String(assignmentKey || "")
  );

  if (!selected) return null;

  const nextContext = {
    ...selected,
    assignments,
    activeAssignmentKey: selected.assignmentKey,
    isImpersonating:
      selected?.isImpersonating === true || current?.isImpersonating === true,
    impersonatedBy: selected?.impersonatedBy || current?.impersonatedBy || "",
    impersonationStartedAt:
      selected?.impersonationStartedAt ||
      current?.impersonationStartedAt ||
      "",
  };

  await setManagerContext(nextContext);
  return nextContext;
}

export async function exitImpersonation() {
  const current = await getManagerContext();

  if (!current?.isImpersonating) {
    return false;
  }

  const savedAdminContext = await AsyncStorage.getItem(ADMIN_CONTEXT_KEY);

  if (!savedAdminContext) {
    await clearManagerContext();
    return false;
  }

  const restoredContext = JSON.parse(savedAdminContext);
  await setManagerContext(restoredContext);
  await AsyncStorage.removeItem(ADMIN_CONTEXT_KEY);
  return true;
}
