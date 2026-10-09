import React from "react";
import { View, Text } from "react-native";

export default function PlaceholderScreen() {
  return (
    <View style={{
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24
    }}>
      <Text style={{
        fontSize: 20,
        fontWeight: "bold"
      }}>
        Coming Soon
      </Text>
    </View>
  );
}
