import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../lib/auth";
import { theme } from "../theme";

function RootNavigation() {
  const { isLoading, isLoggedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "login";
    if (!isLoggedIn && !inAuthGroup) {
      router.replace("/login");
    } else if (isLoggedIn && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isLoading, isLoggedIn, segments]);

  if (isLoading) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="order/[id]" options={{ title: "Delivery" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}
