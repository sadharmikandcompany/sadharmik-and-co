import { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { fetchBalance, type BalanceCollection } from "../../lib/api";
import { theme } from "../../theme";

export default function BalanceScreen() {
  const [balance, setBalance] = useState<BalanceCollection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchBalance();
      setBalance(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load balance.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (isLoading && !balance) {
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

  const orders = balance?.orders ?? [];

  if (orders.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={64} color={theme.colors.success} />
        <Text style={styles.allClearTitle}>All Clear!</Text>
        <Text style={styles.allClearSubtitle}>No pending balance collections.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total to Collect</Text>
        <Text style={styles.totalValue}>₹{balance!.total.toLocaleString("en-IN")}</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={theme.colors.primary} />}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.orderNumber}>{item.orderNumber}</Text>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.paymentMethod}>{item.paymentMethod}</Text>
              <Text style={styles.amount}>₹{item.total.toLocaleString("en-IN")}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, backgroundColor: theme.colors.background, justifyContent: "center", alignItems: "center", gap: 8, padding: 24 },
  error: { color: theme.colors.danger },
  allClearTitle: { color: theme.colors.text, fontSize: 20, fontWeight: "700", marginTop: 8 },
  allClearSubtitle: { color: theme.colors.textMuted },
  totalCard: { backgroundColor: theme.colors.primary, margin: 12, borderRadius: 16, padding: 20, alignItems: "center" },
  totalLabel: { color: theme.colors.primaryText, opacity: 0.85 },
  totalValue: { color: theme.colors.primaryText, fontSize: 28, fontWeight: "800", marginTop: 4 },
  listContainer: { padding: 12, paddingTop: 0, gap: 12 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  orderNumber: { color: theme.colors.text, fontWeight: "700" },
  customerName: { color: theme.colors.textMuted, marginTop: 2 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  paymentMethod: { color: theme.colors.textMuted },
  amount: { color: theme.colors.primary, fontWeight: "700" },
});
