import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth-store";

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      // Backend wraps errors as { error: { message, code } } — not { detail }
      const message =
        err?.response?.data?.error?.message ??
        err?.response?.data?.detail ??
        "Check your credentials and try again.";
      Alert.alert("Login failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-center px-6"
      >
        {/* Logo / wordmark */}
        <View className="mb-10">
          <Text className="text-white text-3xl font-bold tracking-tight">
            FieldPro
          </Text>
          <Text className="text-slate-400 text-base mt-1">
            Sign in to your account
          </Text>
        </View>

        {/* Email */}
        <View className="mb-4">
          <Text className="text-slate-300 text-sm mb-1.5">Email</Text>
          <TextInput
            className="bg-surface-card text-white rounded-xl px-4 py-3.5 text-base border border-slate-700"
            placeholder="you@example.com"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* Password */}
        <View className="mb-6">
          <Text className="text-slate-300 text-sm mb-1.5">Password</Text>
          <TextInput
            className="bg-surface-card text-white rounded-xl px-4 py-3.5 text-base border border-slate-700"
            placeholder="••••••••"
            placeholderTextColor="#64748b"
            secureTextEntry
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
            returnKeyType="done"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          className="bg-brand-600 rounded-xl py-4 items-center"
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Sign in</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
