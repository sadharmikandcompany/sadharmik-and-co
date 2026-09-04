import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { fetchMyDeliveries, type RiderOrder } from "../../lib/api";
import { theme } from "../../theme";

type FilterKey = "today" | "overdue" | "all";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "all", label: "All" },
];

export default function RescheduledScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("today");
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchMyDeliveries("rescheduled");
      setOrders(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load rescheduled deliveries.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filteredOrders = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    return orders.filter((order) => {
      if (!order.rescheduledDate) return false;
      const date = new Date(order.rescheduledDate);
      if (activeFilter === "today") return date >= startOfToday && date < endOfToday;
      if (activeFilter === "overdue") return date < startOfToday;
      return true;
    });
  }, [orders, activeFilter]);

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {FILTERS.map((filter) => (
          <Pressable
            key={filter.key}
            onPress={() => setActiveFilter(filter.key)}
            style={[styles.tab, activeFilter === filter.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeFilter === filter.key && styles.tabTextActive]}>{filter.label}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={theme.colors.primary} />}
        contentContainerStyle={filteredOrders.length === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={
          !isLoading ? <Text style={styles.emptyText}>No rescheduled deliveries scheduled for {activeFilter}.</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/order/${item.id}`)}>
            <View style={styles.cardHeader}>
              <Text style={styles.orderNumber}>{item.orderNumber}</Text>
              <Text style={styles.rescheduledDate}>
                {item.rescheduledDate ? new Date(item.rescheduledDate).toLocaleDateString("en-IN") : ""}
              </Text>
            </View>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <Text style={styles.address} numberOfLines={2}>
              {item.customerAddress}
            </Text>
            {item.rescheduleReason && <Text style={styles.reason}>{item.rescheduleReason}</Text>}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  tabBar: { flexDirection: "row", padding: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center", backgroundColor: theme.colors.surface },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { color: theme.colors.textMuted, fontWeight: "600" },
  tabTextActive: { color: theme.colors.primaryText },
  error: { color: theme.colors.danger, textAlign: "center", marginBottom: 8 },
  listContainer: { padding: 12, gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  emptyText: { color: theme.colors.textMuted, textAlign: "center" },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  orderNumber: { color: theme.colors.text, fontWeight: "700" },
  rescheduledDate: { color: theme.colors.warning, fontWeight: "700" },
  customerName: { color: theme.colors.text, fontSize: 16, fontWeight: "600" },
  address: { color: theme.colors.textMuted, marginTop: 4 },
  reason: { color: theme.colors.textMuted, marginTop: 8, fontStyle: "italic" },
});
