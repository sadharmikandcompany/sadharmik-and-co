import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import { fetchMe, fetchDashboard, type RiderProfile, type DashboardSummary } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { theme } from "../../theme";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { logout } = useAuth();

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      setError(null);
      Promise.all([fetchMe(), fetchDashboard()])
        .then(([profileResult, summaryResult]) => {
          setProfile(profileResult);
          setSummary(summaryResult);
          setIsLoading(false);
        })
        .catch(() => {
          setError("Could not load your profile. Check your connection and try again.");
          setIsLoading(false);
        });
    }, [])
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarInitial}>{profile?.name?.charAt(0).toUpperCase() ?? "?"}</Text>
      </View>
      <Text style={styles.name}>{profile?.name ?? "Unknown rider"}</Text>
      <Text style={styles.phone}>{profile?.phone}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={styles.row}>
          <Text style={styles.mutedLabel}>Total Deliveries</Text>
          <Text style={styles.valueText}>{summary?.totalDeliveries ?? 0}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.mutedLabel}>Average Rating</Text>
          <Text style={styles.valueText}>{profile?.rating != null ? profile.rating.toFixed(1) : "—"}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Service Areas</Text>
        {profile && profile.servicePincodes.length > 0 ? (
          <View style={styles.pincodeWrap}>
            {profile.servicePincodes.map((pincode) => (
              <View key={pincode} style={styles.pincodeChip}>
                <Text style={styles.pincodeText}>{pincode}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.mutedLabel}>No service areas configured yet.</Text>
        )}
      </View>

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, alignItems: "center", gap: 12 },
  center: { flex: 1, backgroundColor: theme.colors.background, justifyContent: "center", alignItems: "center" },
  error: { color: theme.colors.danger },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", marginTop: 8 },
  avatarInitial: { color: theme.colors.primaryText, fontSize: 28, fontWeight: "800" },
  name: { color: theme.colors.text, fontSize: 20, fontWeight: "700" },
  phone: { color: theme.colors.textMuted },
  card: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border, width: "100%" },
  sectionTitle: { color: theme.colors.text, fontWeight: "700", marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  mutedLabel: { color: theme.colors.textMuted },
  valueText: { color: theme.colors.text, fontWeight: "700" },
  pincodeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pincodeChip: { backgroundColor: theme.colors.background, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.colors.border },
  pincodeText: { color: theme.colors.primary, fontWeight: "600" },
  logoutButton: { backgroundColor: theme.colors.danger, borderRadius: 999, paddingVertical: 14, alignItems: "center", width: "100%", marginTop: 8 },
  logoutText: { color: "#2a0705", fontWeight: "700" },
});
