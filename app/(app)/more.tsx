import { View, Text, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth-store";
import { LogOut, User } from "lucide-react-native";

export default function MoreScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      <View className="px-4 pt-4 pb-2">
        <Text className="text-white text-2xl font-bold">More</Text>
      </View>

      {/* Profile info */}
      <View className="mx-4 mt-4 bg-surface-card rounded-2xl p-4 border border-slate-700">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-brand-700 items-center justify-center">
            <User color="#38bdf8" size={20} />
          </View>
          <View>
            <Text className="text-white font-semibold">{user?.full_name ?? "—"}</Text>
            <Text className="text-slate-400 text-sm">{user?.email ?? "—"}</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View className="mx-4 mt-4 bg-surface-card rounded-2xl border border-slate-700 overflow-hidden">
        <TouchableOpacity
          onPress={handleLogout}
          className="flex-row items-center px-4 py-4 gap-3"
          activeOpacity={0.7}
        >
          <LogOut color="#f87171" size={20} />
          <Text className="text-red-400 font-medium">Sign out</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-slate-600 text-xs text-center mt-6">
        FieldPro Mobile v1.0.0
      </Text>
    </SafeAreaView>
  );
}
