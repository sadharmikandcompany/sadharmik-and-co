import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, Modal, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { fetchExpenses, createExpense, type Expense } from "../../lib/api";
import { theme } from "../../theme";

type PeriodKey = "today" | "week" | "month";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

export default function ExpensesScreen() {
  const [activePeriod, setActivePeriod] = useState<PeriodKey>("today");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async (period: PeriodKey) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchExpenses(period);
      setExpenses(result.expenses);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load expenses.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(activePeriod);
    }, [activePeriod, load])
  );

  function closeModal() {
    setShowAddModal(false);
    setAmountInput("");
    setCategoryInput("");
    setNotesInput("");
    setSaveError(null);
  }

  async function handleSave() {
    const amount = Math.round(Number(amountInput));
    if (!Number.isInteger(amount) || amount <= 0) {
      setSaveError("Enter a valid amount.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await createExpense(amount, categoryInput.trim(), notesInput.trim());
      if (!result.ok) {
        setSaveError(result.error ?? "Could not save expense.");
        return;
      }
      closeModal();
      load(activePeriod);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save expense.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {PERIODS.map((period) => (
          <Pressable
            key={period.key}
            onPress={() => setActivePeriod(period.key)}
            style={[styles.tab, activePeriod === period.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activePeriod === period.key && styles.tabTextActive]}>{period.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Expenses</Text>
        <Text style={styles.totalValue}>₹{total.toLocaleString("en-IN")}</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => load(activePeriod)} tintColor={theme.colors.primary} />}
        contentContainerStyle={expenses.length === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={
          !isLoading ? <Text style={styles.emptyText}>No expenses recorded for {activePeriod.replace("_", " ")}.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.category}>{item.category || "Uncategorized"}</Text>
              <Text style={styles.amount}>₹{item.amount.toLocaleString("en-IN")}</Text>
            </View>
            {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
            <Text style={styles.date}>{new Date(item.expenseDate).toLocaleString("en-IN")}</Text>
          </View>
        )}
      />

      <Pressable style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Ionicons name="add" size={28} color={theme.colors.primaryText} />
      </Pressable>

      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Expense</Text>
            <TextInput
              style={styles.input}
              placeholder="Amount (₹)"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="number-pad"
              value={amountInput}
              onChangeText={setAmountInput}
            />
            <TextInput
              style={styles.input}
              placeholder="Category (e.g. Fuel)"
              placeholderTextColor={theme.colors.textMuted}
              value={categoryInput}
              onChangeText={setCategoryInput}
            />
            <TextInput
              style={styles.input}
              placeholder="Notes (optional)"
              placeholderTextColor={theme.colors.textMuted}
              value={notesInput}
              onChangeText={setNotesInput}
            />
            {saveError && <Text style={styles.error}>{saveError}</Text>}
            <View style={styles.modalButtons}>
              <Pressable style={styles.cancelButton} onPress={closeModal} disabled={isSaving}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
                <Text style={styles.saveButtonText}>{isSaving ? "Saving…" : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  tabBar: { flexDirection: "row", padding: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center", backgroundColor: theme.colors.surface },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { color: theme.colors.textMuted, fontWeight: "600", fontSize: 12 },
  tabTextActive: { color: theme.colors.primaryText },
  totalCard: { backgroundColor: theme.colors.surface, marginHorizontal: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  totalLabel: { color: theme.colors.textMuted },
  totalValue: { color: theme.colors.text, fontSize: 22, fontWeight: "800", marginTop: 4 },
  error: { color: theme.colors.danger, textAlign: "center", marginTop: 8 },
  listContainer: { padding: 12, gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: theme.colors.textMuted },
  card: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  category: { color: theme.colors.text, fontWeight: "700" },
  amount: { color: theme.colors.primary, fontWeight: "700" },
  notes: { color: theme.colors.textMuted, marginTop: 6 },
  date: { color: theme.colors.textMuted, marginTop: 6, fontSize: 12 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  modalTitle: { color: theme.colors.text, fontSize: 18, fontWeight: "700" },
  input: {
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
  },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelButton: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  cancelButtonText: { color: theme.colors.textMuted, fontWeight: "600" },
  saveButton: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: 999, backgroundColor: theme.colors.primary },
  saveButtonText: { color: theme.colors.primaryText, fontWeight: "700" },
});
