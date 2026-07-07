import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { modalStyles } from "../utils/modalStyles";

const teams = [
  "(18+) Dallas Mustangs",
  "(18+) Denton Mean Bears",
  "(18+) NTX Reapers",
  "(18+) Pelicans",
  "(18+) Royals",
  "(18+) The Dark Horse",
  "(30+) Briscoe Co. Reds",
  "(30+) Dallas Orioles",
  "(30+) Texas Diablos",
  "(30+) The Old Fashioneds",
  "(45+) Dallas Spirits",
  "(45+) Hurricanes",
  "(45+) Knights",
  "(45+) North Dallas Expos",
  "(45+) Red Sox (45)",
  "(45+) Reds",
  "(60+) Blue Jays",
  "(60+) Dallas Orioles",
  "(60+) Dallas Rangers",
  "(60+) Red Sox",
  "(18-80+) Dallas Giants",
  "(18-80+) Dallas Monsters",
  "(18-80+) Ganns Bulls",
  "(18-80+) Grand Prairie Expos",
  "(18-80+) Uptown Grays",
  "(18-80+) Victory Park Indians",
];

export default function DonateTextScreen() {
  const [selectedTeam, setSelectedTeam] = useState("");
  const [showTeamModal, setShowTeamModal] = useState(false);

  const donationMessage =
    `Please help me support Texas Scottish Rite Hospital for Children through our North Texas Adult Baseball League Charity All-Star Games fundraiser. Follow the site instructions and be sure to select our team below as the team to support.${selectedTeam ? `\n\nTeam: ${selectedTeam}` : ""}\n\nDonate here:\nhttp://community.tsrhc.org/NTABL_Donation`;

async function handleShare() {
  if (!selectedTeam) {
    Alert.alert(
      "Team Required",
      "Please Select a Team Before Selecting Share."
    );
    return;
  }

  try {
    await Share.share({
      message: donationMessage,
    });
  } catch (e) {
    console.log(e);
    Alert.alert(
      "Share Error",
      "Unable to Open Sharing Options."
    );
  }
}

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

<View style={styles.screen}>
<Pressable
  style={styles.backButton}
  onPress={() => router.replace("/donate")}
>
  <View style={styles.smallButtonRow}>
    <Ionicons
      name="chevron-back-outline"
      size={16}
      color="#ffffff"
      style={{ marginRight: 3 }}
    />

    <Text style={styles.backButtonText}>Back</Text>
  </View>
</Pressable>

  <ScrollView contentContainerStyle={styles.container}>
    <View style={styles.card}>
            <Image
              source={require("../assets/SendText.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <View style={styles.titleSpacer} />

            <Text style={styles.title}>Send Text Message</Text>

<View style={styles.instructionsCard}>
  <Text style={styles.instructions}>
    <Text style={styles.boldText}>INSTRUCTIONS</Text>: Select your team below,
    then tap the <Text style={styles.boldText}>Share Donation Message</Text>{" "}
    button to send the donation request to your family, friends, teammates, or
    coworkers.
  </Text>
</View>

            <Pressable
              style={styles.teamPicker}
              onPress={() => setShowTeamModal(true)}
            >
<Text
  style={[
    styles.teamPickerText,
    selectedTeam && styles.teamPickerSelected,
  ]}
>
  {selectedTeam
    ? `🏆 ${selectedTeam}`
    : "Select Your Team"}
</Text>
              <Ionicons name="chevron-down" size={20} color="#111827" />
            </Pressable>

            <View style={styles.messageBox}>
              <Text style={styles.messageText}>{donationMessage}</Text>
            </View>

            <Pressable
  style={[
    styles.shareButton,
    !selectedTeam && styles.disabledButton,
  ]}
  onPress={handleShare}
>
<View style={styles.buttonContentRow}>
  <Ionicons
    name="share-social"
    size={22}
    color="#ffffff"
    style={{ marginRight: 8 }}
  />

  <Text style={styles.buttonText}>
    Share Donation Message
  </Text>
</View>
            </Pressable>
            <Text style={styles.versionFooter}>
  NTABL All-Star App • Version 1.0
</Text>
          </View>
        </ScrollView>
      </View>

      <Modal visible={showTeamModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Your Team</Text>

            <ScrollView>
              {teams.map((team) => (
                <Pressable
                  key={team}
                  style={styles.modalOption}
                  onPress={() => {
                    setSelectedTeam(team);
                    setShowTeamModal(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{team}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f7fb",
  },

container: {
  paddingHorizontal: 20,
  paddingTop: 95,
  paddingBottom: 70,
},

headerRow: {
  flexDirection: "row",
  justifyContent: "flex-start",
  alignItems: "center",
  marginBottom: 12,
},

backButton: {
  position: "absolute",
  top: 50,
  left: 20,
  backgroundColor: "#1d4ed8",
  borderRadius: 8,
  paddingVertical: 6,
  paddingHorizontal: 12,
  zIndex: 100,
},

  backButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

card: {
  backgroundColor: "#ffffff",
  borderRadius: 20,
  padding: 22,

  shadowColor: "#000",
  shadowOpacity: 0.12,
  shadowRadius: 12,
  shadowOffset: {
    width: 0,
    height: 6,
  },
  elevation: 8,
},

logo: {
  width: 235,
  height: 154,
  alignSelf: "center",
  marginBottom: 8,
},

  titleSpacer: {
    height: 40,
  },

title: {
  fontSize: 28,
  fontWeight: "900",
  textAlign: "center",
  color: "#1f4e9e",
  marginBottom: 12,
},

  instructions: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
    marginBottom: 14,
  },

teamPicker: {
  borderWidth: 1,
  borderColor: "#1d4ed8",
  borderRadius: 12,
  paddingVertical: 14,
  paddingHorizontal: 14,
  marginBottom: 14,
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  backgroundColor: "#ffffff",

  shadowColor: "#000",
  shadowOpacity: 0.05,
  shadowRadius: 6,
  shadowOffset: {
    width: 0,
    height: 2,
  },
  elevation: 2,
},

  teamPickerText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },

messageBox: {
  backgroundColor: "#ffffff",
  borderWidth: 2,
  borderColor: "#d1d5db",
  borderRadius: 14,
  padding: 16,
  marginBottom: 16,
},

  messageText: {
    fontSize: 15,
    color: "#111827",
    lineHeight: 22,
  },

shareButton: {
  backgroundColor: "#15803d",
  borderRadius: 12,
  paddingVertical: 14,
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "row",

  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 8,
  shadowOffset: {
    width: 0,
    height: 3,
  },
  elevation: 5,
},

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  boldText: {
    fontWeight: "900",
    color: "#111827",
  },

modalOverlay: {
  ...modalStyles.overlay,
},

modalCard: {
  ...modalStyles.card,
  maxHeight: "75%",
},

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f4e9e",
    textAlign: "center",
    marginBottom: 10,
  },

  modalOption: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },

  modalOptionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },

  disabledButton: {
  opacity: 0.5,
},

buttonContentRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
},

smallButtonRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
},

instructionsCard: {
  backgroundColor: "#FFFBEA",
  borderRadius: 16,
  padding: 14,
  marginBottom: 14,
  borderWidth: 1,
  borderColor: "#F6E58D",

  shadowColor: "#000",
  shadowOpacity: 0.05,
  shadowRadius: 6,
  shadowOffset: {
    width: 0,
    height: 2,
  },
  elevation: 2,
},

teamPickerSelected: {
  color: "#1f4e9e",
  fontWeight: "900",
},

versionFooter: {
  color: "#6b7280",
  fontSize: 12,
  fontWeight: "700",
  textAlign: "center",
  marginTop: 22,
},
});
