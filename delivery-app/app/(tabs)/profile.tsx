import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { fetchMe, type RiderProfile } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { theme } from "../../theme";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { logout } = useAuth();

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      setError(null);
      fetchMe()
        .then((result) => {
          setProfile(result);
          setIsLoading(false);
        })
        .catch(() => {
          setError("Could not load your profile. Check your connection and try again.");
          setIsLoading(false);
        });
    }, [])
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : error ? (
        <Text style={styles.phone}>{error}</Text>
      ) : (
        <>
          <Text style={styles.name}>{profile?.name ?? "Unknown rider"}</Text>
          <Text style={styles.phone}>{profile?.phone}</Text>
        </>
      )}

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: 16 },
  name: { color: theme.colors.text, fontSize: 20, fontWeight: "700" },
  phone: { color: theme.colors.textMuted, marginTop: 4, marginBottom: 24 },
  logoutButton: { backgroundColor: theme.colors.danger, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  logoutText: { color: "#2a0705", fontWeight: "700" },
});
