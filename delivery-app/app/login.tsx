import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { login } from "../lib/api";
import { useAuth } from "../lib/auth";
import { theme } from "../theme";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setLoggedIn } = useAuth();
  const router = useRouter();

  async function handleSubmit() {
    setError(null);
    if (!phone.trim() || !password) {
      setError("Enter your phone and password.");
      return;
    }
    setIsSubmitting(true);
    const result = await login(phone.trim(), password);
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Login failed.");
      return;
    }
    setLoggedIn(true);
    router.replace("/(tabs)");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sadharmik Delivery</Text>
      <Text style={styles.subtitle}>Driver Portal</Text>

      <TextInput
        style={styles.input}
        placeholder="Phone number"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={theme.colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? (
          <ActivityIndicator color={theme.colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, justifyContent: "center", padding: 24 },
  title: { color: theme.colors.primary, fontSize: 28, fontWeight: "700", textAlign: "center" },
  subtitle: { color: theme.colors.textMuted, fontSize: 14, textAlign: "center", marginBottom: 32 },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 12,
  },
  error: { color: theme.colors.danger, marginBottom: 12, textAlign: "center" },
  button: { backgroundColor: theme.colors.primary, borderRadius: 999, padding: 16, alignItems: "center", marginTop: 8 },
  buttonText: { color: theme.colors.primaryText, fontWeight: "700", fontSize: 16 },
});
