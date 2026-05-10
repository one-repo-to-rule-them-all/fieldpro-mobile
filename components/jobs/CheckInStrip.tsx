import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { MapPin, LogIn, LogOut } from "lucide-react-native";
import { CheckIn, WorkOrderStatus } from "@/types";
import { format, parseISO } from "date-fns";

interface Props {
  workOrderId: string;
  status: WorkOrderStatus;
  activeCheckIn?: CheckIn;
  onCheckIn: () => void;
  onCheckOut: () => void;
  isLoading: boolean;
}

export function CheckInStrip({
  status,
  activeCheckIn,
  onCheckIn,
  onCheckOut,
  isLoading,
}: Props) {
  const canCheckIn = status === "scheduled" || status === "in_progress";
  if (!canCheckIn && !activeCheckIn) return null;

  const isCheckedIn = !!activeCheckIn && !activeCheckIn.checked_out_at;

  return (
    <View className="mx-4 mt-2 bg-surface-card rounded-2xl border border-slate-700 px-4 py-3 flex-row items-center gap-3">
      <MapPin color={isCheckedIn ? "#4ade80" : "#38bdf8"} size={18} />

      <View className="flex-1">
        <Text className="text-slate-300 text-sm font-medium">
          {isCheckedIn ? "Checked in" : "Not checked in"}
        </Text>
        {isCheckedIn && activeCheckIn?.checked_in_at && (
          <Text className="text-slate-500 text-xs">
            Since {format(parseISO(activeCheckIn.checked_in_at), "h:mm a")}
          </Text>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#38bdf8" size="small" />
      ) : isCheckedIn ? (
        <TouchableOpacity
          onPress={onCheckOut}
          className="flex-row items-center gap-1.5 bg-slate-700 rounded-xl px-3 py-2"
          activeOpacity={0.75}
        >
          <LogOut color="#94a3b8" size={15} />
          <Text className="text-slate-300 text-sm font-medium">Check out</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onCheckIn}
          className="flex-row items-center gap-1.5 bg-brand-700 rounded-xl px-3 py-2"
          activeOpacity={0.75}
        >
          <LogIn color="#38bdf8" size={15} />
          <Text className="text-brand-400 text-sm font-medium">Check in</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
