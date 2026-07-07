import { StyleSheet } from "react-native";

export const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

card: {
  backgroundColor: "#ffffff",
  borderRadius: 20,
  padding: 20,
  width: "88%",
  maxWidth: 900,
  shadowColor: "#000",
  shadowOpacity: 0.15,
  shadowRadius: 12,
  shadowOffset: {
    width: 0,
    height: 6,
  },
  elevation: 10,
},

compactCard: {
  backgroundColor: "#ffffff",
  borderRadius: 20,
  padding: 20,
  width: "88%",
  maxWidth: 520,
  shadowColor: "#000",
  shadowOpacity: 0.15,
  shadowRadius: 12,
  shadowOffset: {
    width: 0,
    height: 6,
  },
  elevation: 10,
},

  buttonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 18,
  },
});