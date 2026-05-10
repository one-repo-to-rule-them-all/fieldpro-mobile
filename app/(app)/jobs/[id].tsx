import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useWorkOrder, useCheckIn, useCheckOut, useUpdateTask } from "@/hooks/use-work-orders";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TaskList } from "@/components/jobs/TaskList";
import { CheckInStrip } from "@/components/jobs/CheckInStrip";
import { format, parseISO } from "date-fns";
import { ChevronLeft } from "lucide-react-native";

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: workOrder, isLoading, isError } = useWorkOrder(id);
  const checkIn = useCheckIn(id);
  const checkOut = useCheckOut(id);
  const updateTask = useUpdateTask(id);
  const [locationLoading, setLocationLoading] = useState(false);

  const getCoords = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location access is required to check in.");
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch {
      Alert.alert("Location error", "Could not get your location. Try again.");
      return null;
    } finally {
      setLocationLoading(false);
    }
  };

  const handleCheckIn = async () => {
    const coords = await getCoords();
    if (!coords) return;
    try {
      await checkIn.mutateAsync(coords);
    } catch {
      Alert.alert("Check-in failed", "Please try again.");
    }
  };

  const handleCheckOut = async () => {
    const coords = await getCoords();
    if (!coords) return;
    try {
      await checkOut.mutateAsync(coords);
    } catch {
      Alert.alert("Check-out failed", "Please try again.");
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#38bdf8" size="large" />
      </SafeAreaView>
    );
  }

  if (isError || !workOrder) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center px-6">
        <Text className="text-slate-400 text-center">
          Could not load this job. Go back and try again.
        </Text>
      </SafeAreaView>
    );
  }

  const activeCheckIn = workOrder.check_ins.find((c) => !c.checked_out_at);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-slate-700">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ChevronLeft color="#94a3b8" size={24} />
        </TouchableOpacity>
        <Text className="text-white font-semibold text-base flex-1" numberOfLines={1}>
          {workOrder.title}
        </Text>
        <StatusBadge status={workOrder.status} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Job info */}
        <View className="px-4 pt-4 mb-4">
          {workOrder.client_name && (
            <Text className="text-slate-300 text-sm mb-0.5">{workOrder.client_name}</Text>
          )}
          {workOrder.location_name && (
            <Text className="text-slate-400 text-sm mb-0.5">{workOrder.location_name}</Text>
          )}
          {workOrder.location_address && (
            <Text className="text-slate-500 text-xs">{workOrder.location_address}</Text>
          )}
          <Text className="text-slate-500 text-xs mt-2">
            {workOrder.scheduled_start_time
              ? `${format(parseISO(workOrder.scheduled_start_time), "MMM d · h:mm a")}${
                  workOrder.scheduled_end_time
                    ? ` – ${format(parseISO(workOrder.scheduled_end_time), "h:mm a")}`
                    : ""
                }`
              : format(parseISO(workOrder.scheduled_date), "MMM d, yyyy")}
          </Text>
          {workOrder.description && (
            <Text className="text-slate-400 text-sm mt-3 leading-5">
              {workOrder.description}
            </Text>
          )}
        </View>

        {/* Check-in strip */}
        <CheckInStrip
          workOrderId={workOrder.id}
          status={workOrder.status}
          activeCheckIn={activeCheckIn}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          isLoading={checkIn.isPending || checkOut.isPending || locationLoading}
        />

        {/* Tasks */}
        {workOrder.tasks.length > 0 && (
          <View className="px-4 mt-4">
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">
              Tasks
            </Text>
            <TaskList
              tasks={workOrder.tasks}
              onUpdate={(taskId, status, skipReason) =>
                updateTask.mutate({ taskId, status, skip_reason: skipReason })
              }
              isPending={updateTask.isPending}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
