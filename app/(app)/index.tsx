import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMyJobs } from "@/hooks/use-work-orders";
import { WorkOrder } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { format, parseISO } from "date-fns";

function JobCard({ item }: { item: WorkOrder }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/jobs/${item.id}`)}
      className="bg-surface-card rounded-2xl p-4 mb-3 border border-slate-700"
      activeOpacity={0.75}
    >
      <View className="flex-row items-start justify-between mb-2">
        <Text
          className="text-white font-semibold text-base flex-1 mr-3"
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <StatusBadge status={item.status} />
      </View>

      {item.client_name && (
        <Text className="text-slate-400 text-sm mb-0.5">{item.client_name}</Text>
      )}
      {item.location_name && (
        <Text className="text-slate-500 text-sm">{item.location_name}</Text>
      )}

      <View className="flex-row items-center mt-3 pt-3 border-t border-slate-700">
        <Text className="text-slate-400 text-xs">
          {item.scheduled_start_time
            ? format(parseISO(item.scheduled_start_time), "h:mm a")
            : format(parseISO(item.scheduled_date), "MMM d")}
        </Text>
        {item.tasks?.length > 0 && (
          <Text className="text-slate-500 text-xs ml-auto">
            {item.tasks.filter((t) => t.status === "completed").length}/
            {item.tasks.length} tasks
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function MyJobsScreen() {
  const { data, isLoading, isRefetching, refetch, isError } = useMyJobs();

  const inProgress = data?.items.filter((wo) => wo.status === "in_progress") ?? [];
  const scheduled = data?.items.filter((wo) => wo.status === "scheduled") ?? [];
  const sections = [
    { title: "In Progress", data: inProgress },
    { title: "Scheduled", data: scheduled },
  ].filter((s) => s.data.length > 0);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      <View className="px-4 pt-4 pb-2">
        <Text className="text-white text-2xl font-bold">My Jobs</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#38bdf8" size="large" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-slate-400 text-center">
            Failed to load jobs. Pull down to retry.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(s) => s.title}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#38bdf8"
            />
          }
          renderItem={({ item: section }) => (
            <View className="mb-2">
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3 mt-2">
                {section.title}
              </Text>
              {section.data.map((wo) => (
                <JobCard key={wo.id} item={wo} />
              ))}
            </View>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center pt-24">
              <Text className="text-slate-400 text-base">No jobs assigned.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
