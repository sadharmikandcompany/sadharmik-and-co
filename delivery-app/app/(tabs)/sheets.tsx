import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { fetchDeliverySheet, type DeliverySheet } from "../../lib/api";
import { theme } from "../../theme";

type FilterKey = "today" | "all";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "all", label: "All Active" },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSheetHtml(sheet: DeliverySheet): string {
  const rows = sheet.orders
    .map(
      (order, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(order.orderNumber)}</td>
          <td>${escapeHtml(order.customerName)}</td>
          <td>${escapeHtml(order.customerPhone)}</td>
          <td>${escapeHtml(order.customerAddress)}</td>
          <td>${order.items.map((i) => `${escapeHtml(i.productName)} x${i.quantity}`).join("<br/>")}</td>
          <td>${order.paymentMethod}</td>
          <td>₹${order.total.toLocaleString("en-IN")}</td>
        </tr>
      `
    )
    .join("");

  return `
    <html>
      <head><meta charset="utf-8" /></head>
      <body style="font-family: -apple-system, sans-serif; padding: 16px;">
        <h2>My Delivery Sheet</h2>
        <p>Orders: ${sheet.totalOrders} · Items: ${sheet.totalItems} · Total: ₹${sheet.totalAmount.toLocaleString(
    "en-IN"
  )} · COD: ₹${sheet.totalCod.toLocaleString("en-IN")}</p>
        <table style="width:100%; border-collapse: collapse;" border="1" cellpadding="6">
          <thead>
            <tr>
              <th>#</th><th>Order #</th><th>Customer</th><th>Phone</th><th>Address</th><th>Items</th><th>Payment</th><th>Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
}

export default function DeliverySheetsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("today");
  const [sheet, setSheet] = useState<DeliverySheet | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const load = useCallback(async (filter: FilterKey) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchDeliverySheet(filter);
      setSheet(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load delivery sheet.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(activeFilter);
    }, [activeFilter, load])
  );

  async function handleDownloadPdf() {
    if (!sheet) return;
    setIsExporting(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildSheetHtml(sheet) });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Delivery Sheet" });
      } else {
        Alert.alert("PDF created", `Saved to: ${uri}`);
      }
    } catch (err) {
      Alert.alert("Couldn't create PDF", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

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

      {sheet && (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{sheet.totalOrders}</Text>
              <Text style={styles.statLabel}>ORDERS</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{sheet.totalItems}</Text>
              <Text style={styles.statLabel}>ITEMS</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>₹{sheet.totalAmount.toLocaleString("en-IN")}</Text>
              <Text style={styles.statLabel}>TOTAL</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>₹{sheet.totalCod.toLocaleString("en-IN")}</Text>
              <Text style={styles.statLabel}>COD</Text>
            </View>
          </View>

          <Pressable style={styles.downloadButton} onPress={handleDownloadPdf} disabled={isExporting || sheet.orders.length === 0}>
            <Text style={styles.downloadButtonText}>{isExporting ? "Preparing…" : "Download Delivery Sheet PDF"}</Text>
          </Pressable>
        </>
      )}

      <FlatList
        data={sheet?.orders ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => load(activeFilter)} tintColor={theme.colors.primary} />}
        contentContainerStyle={(sheet?.orders.length ?? 0) === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={!isLoading ? <Text style={styles.emptyText}>No deliveries for {activeFilter}.</Text> : null}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.indexBubble}>
                <Text style={styles.indexText}>{index + 1}</Text>
              </View>
              <Text style={styles.orderNumber}>{item.orderNumber}</Text>
            </View>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <Text style={styles.address}>{item.customerAddress}</Text>
            <Text style={styles.itemsLabel}>Items ({item.items.length})</Text>
            {item.items.map((line, i) => (
              <Text key={i} style={styles.itemLine}>
                {line.productName} · Qty: {line.quantity}
              </Text>
            ))}
          </View>
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
  statsRow: { flexDirection: "row", paddingHorizontal: 12, gap: 8 },
  statBox: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: theme.colors.border },
  statValue: { color: theme.colors.text, fontWeight: "800" },
  statLabel: { color: theme.colors.textMuted, fontSize: 10, marginTop: 2 },
  downloadButton: { backgroundColor: theme.colors.primary, marginHorizontal: 12, marginTop: 12, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  downloadButtonText: { color: theme.colors.primaryText, fontWeight: "700" },
  listContainer: { padding: 12, gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: theme.colors.textMuted },
  card: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  indexBubble: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  indexText: { color: theme.colors.primaryText, fontSize: 12, fontWeight: "700" },
  orderNumber: { color: theme.colors.text, fontWeight: "700" },
  customerName: { color: theme.colors.text, fontWeight: "600" },
  address: { color: theme.colors.textMuted, marginTop: 2 },
  itemsLabel: { color: theme.colors.text, fontWeight: "600", marginTop: 10 },
  itemLine: { color: theme.colors.textMuted, marginTop: 2 },
});
