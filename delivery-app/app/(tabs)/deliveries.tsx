import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { fetchMyDeliveries, type RiderOrder } from "../../lib/api";
import { theme } from "../../theme";

type TabKey = "pending" | "in_progress" | "complete" | "failed";
const TABS: { key: TabKey; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "complete", label: "Complete" },
  { key: "failed", label: "Failed" },
];

export default function DeliveriesScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async (tab: TabKey) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchMyDeliveries(tab);
      setOrders(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load deliveries.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(activeTab);
    }, [activeTab, load])
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => load(activeTab)} tintColor={theme.colors.primary} />
        }
        contentContainerStyle={orders.length === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={!isLoading ? <Text style={styles.emptyText}>No {activeTab.replace("_", " ")} deliveries.</Text> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/order/${item.id}`)}>
            {item.isPriority && (
              <View style={styles.priorityBanner}>
                <Text style={styles.priorityBannerText}>PRIORITY ORDER</Text>
              </View>
            )}
            <View style={styles.cardHeader}>
              <Text style={styles.orderNumber}>{item.orderNumber}</Text>
              <Text style={styles.vipBadge}>VIP {String(item.customerVipNumber).padStart(4, "0")}</Text>
            </View>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <Text style={styles.customerPhone}>{item.customerPhone}</Text>
            <Text style={styles.address} numberOfLines={2}>
              {item.customerAddress}
            </Text>
            <View style={styles.cardFooter}>
              <Text style={styles.itemCount}>
                {item.items.length} item{item.items.length === 1 ? "" : "s"}
              </Text>
              <Text style={styles.amount}>
                {item.paymentMethod} · ₹{item.total.toLocaleString("en-IN")}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  tabBar: { flexDirection: "row", padding: 12, gap: 6, flexWrap: "wrap" },
  tab: { flex: 1, minWidth: "22%", paddingVertical: 10, borderRadius: 999, alignItems: "center", backgroundColor: theme.colors.surface },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { color: theme.colors.textMuted, fontWeight: "600", fontSize: 12 },
  tabTextActive: { color: theme.colors.primaryText },
  error: { color: theme.colors.danger, textAlign: "center", marginBottom: 8 },
  listContainer: { padding: 12, gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: theme.colors.textMuted },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  priorityBanner: {
    backgroundColor: theme.colors.warning,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  priorityBannerText: { color: theme.colors.primaryText, fontSize: 11, fontWeight: "700" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  orderNumber: { color: theme.colors.text, fontWeight: "700" },
  vipBadge: { color: theme.colors.gold, fontWeight: "700" },
  customerName: { color: theme.colors.text, fontSize: 16, fontWeight: "600" },
  customerPhone: { color: theme.colors.textMuted, marginBottom: 6 },
  address: { color: theme.colors.textMuted, marginBottom: 10 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  itemCount: { color: theme.colors.textMuted },
  amount: { color: theme.colors.primary, fontWeight: "700" },
});
