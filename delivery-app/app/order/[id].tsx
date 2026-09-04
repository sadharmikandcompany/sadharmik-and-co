import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, ActivityIndicator, ScrollView, TextInput, Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { fetchOrder, pickupOrder, markDelivered, markFailed, rescheduleOrder, type RiderOrder } from "../../lib/api";
import { theme } from "../../theme";

type ActionMode = "none" | "fail" | "reschedule";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<RiderOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>("none");
  const [failReason, setFailReason] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchOrder(id);
      setOrder(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load order.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handlePickup() {
    setIsSubmitting(true);
    try {
      const result = await pickupOrder(id);
      if (!result.ok) {
        Alert.alert("Couldn't update", result.error ?? "Please try again.");
        return;
      }
      await load();
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeliver() {
    setIsSubmitting(true);
    try {
      const result = await markDelivered(id);
      if (!result.ok) {
        Alert.alert("Couldn't update", result.error ?? "Please try again.");
        return;
      }
      router.back();
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFail() {
    if (!failReason.trim()) {
      Alert.alert("Reason required", "Enter a short reason for the failed delivery.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await markFailed(id, failReason.trim());
      if (!result.ok) {
        Alert.alert("Couldn't update", result.error ?? "Please try again.");
        return;
      }
      router.back();
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReschedule() {
    const parsedDate = new Date(rescheduleDate);
    if (Number.isNaN(parsedDate.getTime())) {
      Alert.alert("Valid date required", "Enter the new date as YYYY-MM-DD.");
      return;
    }
    if (!rescheduleReason.trim()) {
      Alert.alert("Reason required", "Enter a short reason for rescheduling.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await rescheduleOrder(id, parsedDate.toISOString(), rescheduleReason.trim());
      if (!result.ok) {
        Alert.alert("Couldn't update", result.error ?? "Please try again.");
        return;
      }
      router.back();
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Order not found."}</Text>
        <Pressable style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const canPickup = order.status === "OUT_FOR_DELIVERY";
  const canAct = order.status === "PICKED_UP";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {order.isPriority && (
        <View style={styles.priorityBanner}>
          <Text style={styles.priorityBannerText}>PRIORITY ORDER</Text>
        </View>
      )}
      <Text style={styles.orderNumber}>{order.orderNumber}</Text>
      <Text style={styles.customerName}>
        VIP {String(order.customerVipNumber).padStart(4, "0")} · {order.customerName}
      </Text>

      <View style={styles.actionsRow}>
        <Pressable style={styles.actionButton} onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}>
          <Text style={styles.actionButtonText}>Call</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() =>
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customerAddress)}`)
          }
        >
          <Text style={styles.actionButtonText}>Navigate</Text>
        </Pressable>
      </View>

      <Text style={styles.address}>{order.customerAddress}</Text>

      <View style={styles.itemsCard}>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemName}>
              {item.productName} × {item.quantity}
            </Text>
            <Text style={styles.itemPrice}>₹{(item.unitPrice * item.quantity).toLocaleString("en-IN")}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{order.paymentMethod}</Text>
          <Text style={styles.totalValue}>₹{order.total.toLocaleString("en-IN")}</Text>
        </View>
      </View>

      {order.deliveryNotes && <Text style={styles.notes}>Note: {order.deliveryNotes}</Text>}
      {order.rescheduledDate && (
        <Text style={styles.notes}>
          Rescheduled to {new Date(order.rescheduledDate).toLocaleDateString("en-IN")}
          {order.rescheduleReason ? ` — ${order.rescheduleReason}` : ""}
        </Text>
      )}

      {canPickup && (
        <Pressable style={styles.pickupButton} onPress={handlePickup} disabled={isSubmitting}>
          <Text style={styles.pickupButtonText}>{isSubmitting ? "Updating…" : "Mark Picked Up"}</Text>
        </Pressable>
      )}

      {canAct && actionMode === "none" && (
        <View style={styles.footerButtons}>
          <Pressable style={styles.deliverButton} onPress={handleDeliver} disabled={isSubmitting}>
            <Text style={styles.deliverButtonText}>{isSubmitting ? "Updating…" : "Mark Delivered"}</Text>
          </Pressable>
          <Pressable style={styles.failButton} onPress={() => setActionMode("fail")} disabled={isSubmitting}>
            <Text style={styles.failButtonText}>Mark Failed</Text>
          </Pressable>
          <Pressable style={styles.rescheduleButton} onPress={() => setActionMode("reschedule")} disabled={isSubmitting}>
            <Text style={styles.rescheduleButtonText}>Reschedule</Text>
          </Pressable>
        </View>
      )}

      {canAct && actionMode === "fail" && (
        <View style={styles.footerButtons}>
          <TextInput
            style={styles.reasonInput}
            placeholder="Reason (e.g. customer not available)"
            placeholderTextColor={theme.colors.textMuted}
            value={failReason}
            onChangeText={setFailReason}
          />
          <Pressable style={styles.failButton} onPress={handleFail} disabled={isSubmitting}>
            <Text style={styles.failButtonText}>{isSubmitting ? "Updating…" : "Confirm Failed"}</Text>
          </Pressable>
          <Pressable onPress={() => setActionMode("none")} disabled={isSubmitting}>
            <Text style={styles.cancelLink}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {canAct && actionMode === "reschedule" && (
        <View style={styles.footerButtons}>
          <TextInput
            style={styles.reasonInput}
            placeholder="New date (YYYY-MM-DD)"
            placeholderTextColor={theme.colors.textMuted}
            value={rescheduleDate}
            onChangeText={setRescheduleDate}
          />
          <TextInput
            style={styles.reasonInput}
            placeholder="Reason for rescheduling"
            placeholderTextColor={theme.colors.textMuted}
            value={rescheduleReason}
            onChangeText={setRescheduleReason}
          />
          <Pressable style={styles.rescheduleButton} onPress={handleReschedule} disabled={isSubmitting}>
            <Text style={styles.rescheduleButtonText}>{isSubmitting ? "Updating…" : "Confirm Reschedule"}</Text>
          </Pressable>
          <Pressable onPress={() => setActionMode("none")} disabled={isSubmitting}>
            <Text style={styles.cancelLink}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16 },
  center: { flex: 1, backgroundColor: theme.colors.background, justifyContent: "center", alignItems: "center", gap: 12 },
  error: { color: theme.colors.danger },
  retryButton: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { color: theme.colors.primaryText, fontWeight: "700" },
  priorityBanner: {
    backgroundColor: theme.colors.warning,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  priorityBannerText: { color: theme.colors.primaryText, fontSize: 11, fontWeight: "700" },
  orderNumber: { color: theme.colors.text, fontSize: 20, fontWeight: "700" },
  customerName: { color: theme.colors.primary, marginTop: 4, marginBottom: 12 },
  actionsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  actionButton: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionButtonText: { color: theme.colors.text, fontWeight: "600" },
  address: { color: theme.colors.textMuted, marginBottom: 16 },
  itemsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  itemName: { color: theme.colors.text, flex: 1, marginRight: 8 },
  itemPrice: { color: theme.colors.text, fontWeight: "600" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 8,
  },
  totalLabel: { color: theme.colors.textMuted },
  totalValue: { color: theme.colors.primary, fontWeight: "700", fontSize: 16 },
  notes: { color: theme.colors.danger, marginBottom: 16 },
  pickupButton: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: "center", marginBottom: 12 },
  pickupButtonText: { color: theme.colors.primaryText, fontWeight: "700", fontSize: 16 },
  footerButtons: { gap: 12 },
  deliverButton: { backgroundColor: theme.colors.success, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  deliverButtonText: { color: "#04150a", fontWeight: "700", fontSize: 16 },
  failButton: { backgroundColor: theme.colors.danger, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  failButtonText: { color: "#2a0705", fontWeight: "700", fontSize: 16 },
  rescheduleButton: { backgroundColor: theme.colors.warning, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  rescheduleButtonText: { color: "#4a2c00", fontWeight: "700", fontSize: 16 },
  cancelLink: { color: theme.colors.textMuted, textAlign: "center", padding: 8 },
  reasonInput: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
  },
});
