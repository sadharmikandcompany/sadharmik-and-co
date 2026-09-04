import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Switch } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { fetchDashboard, fetchMe, type DashboardSummary, type RiderProfile } from "../../lib/api";
import { theme } from "../../theme";

export default function DashboardScreen() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [summaryResult, profileResult] = await Promise.all([fetchDashboard(), fetchMe()]);
      setSummary(summaryResult);
      setProfile(profileResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !summary) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Could not load dashboard."}</Text>
        <Pressable style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.welcome}>Welcome, {profile?.name ?? "Rider"}!</Text>
        <Text style={styles.date}>{new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.availabilityRow}>
          <View>
            <Text style={styles.availabilityLabel}>Availability Status</Text>
            <Text style={[styles.availabilityValue, { color: isAvailable ? theme.colors.success : theme.colors.textMuted }]}>
              {isAvailable ? "Available for Deliveries" : "Currently Unavailable"}
            </Text>
          </View>
          <Switch value={isAvailable} onValueChange={setIsAvailable} trackColor={{ true: theme.colors.success }} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Today's Summary</Text>
      <View style={styles.grid}>
        <View style={[styles.statTile, { backgroundColor: "#E3F2FD" }]}>
          <Text style={styles.statValue}>{summary.totalAssigned}</Text>
          <Text style={styles.statLabel}>Total Assigned</Text>
        </View>
        <View style={[styles.statTile, { backgroundColor: "#E8F5E9" }]}>
          <Text style={styles.statValue}>{summary.delivered}</Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>
        <View style={[styles.statTile, { backgroundColor: "#FFF8E1" }]}>
          <Text style={styles.statValue}>{summary.pickedUp}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statTile, { backgroundColor: "#FFEBEE" }]}>
          <Text style={styles.statValue}>{summary.failed}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Today's Collections</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.mutedLabel}>Today's Total</Text>
          <Text style={styles.collectionsValue}>₹{summary.todaysCollectionsTotal.toLocaleString("en-IN")}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Performance</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.mutedLabel}>Total Deliveries</Text>
          <Text style={styles.performanceValue}>{summary.totalDeliveries}</Text>
        </View>
        <View style={[styles.rowBetween, { marginTop: 8 }]}>
          <Text style={styles.mutedLabel}>Average Rating</Text>
          <Text style={styles.performanceValue}>{summary.rating != null ? summary.rating.toFixed(1) : "—"}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <Pressable style={styles.primaryButton} onPress={() => router.push("/(tabs)/deliveries")}>
        <Text style={styles.primaryButtonText}>View All Deliveries</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, backgroundColor: theme.colors.background, justifyContent: "center", alignItems: "center", gap: 12 },
  error: { color: theme.colors.danger },
  retryButton: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { color: theme.colors.primaryText, fontWeight: "700" },
  card: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  welcome: { color: theme.colors.text, fontSize: 18, fontWeight: "700" },
  date: { color: theme.colors.textMuted, marginTop: 4 },
  availabilityRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  availabilityLabel: { color: theme.colors.text, fontWeight: "600" },
  availabilityValue: { marginTop: 2, fontWeight: "600" },
  sectionTitle: { color: theme.colors.text, fontWeight: "700", fontSize: 15, marginTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statTile: { width: "47%", borderRadius: 16, padding: 16 },
  statValue: { fontSize: 24, fontWeight: "800", color: theme.colors.text },
  statLabel: { color: theme.colors.textMuted, marginTop: 4 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mutedLabel: { color: theme.colors.textMuted },
  collectionsValue: { color: theme.colors.success, fontWeight: "800", fontSize: 18 },
  performanceValue: { color: theme.colors.text, fontWeight: "700" },
  primaryButton: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  primaryButtonText: { color: theme.colors.primaryText, fontWeight: "700" },
});
