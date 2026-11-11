import { Alert, Linking } from "react-native";

import { ORDERING_URL } from "@/src/config";

export async function openOnlineOrdering(): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL(ORDERING_URL);
    if (!canOpen) {
      Alert.alert(
        "Couldn’t open ordering",
        "Your device couldn’t open FloBama’s online ordering site. Try again in a moment.",
        [{ text: "OK" }],
      );
      return false;
    }
    await Linking.openURL(ORDERING_URL);
    return true;
  } catch {
    Alert.alert(
      "Couldn’t open ordering",
      "Something went wrong opening FloBama’s online ordering site.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Try again",
          onPress: () => {
            void openOnlineOrdering();
          },
        },
      ],
    );
    return false;
  }
}
