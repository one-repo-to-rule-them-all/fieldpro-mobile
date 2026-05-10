import { View, Text } from "react-native";
import { WorkOrderStatus } from "@/types";

const CONFIG: Record<WorkOrderStatus, { label: string; bg: string; text: string }> = {
  scheduled:   { label: "Scheduled",   bg: "#1e3a5f", text: "#60a5fa" },
  in_progress: { label: "In Progress", bg: "#14532d", text: "#4ade80" },
  completed:   { label: "Completed",   bg: "#1a2e05", text: "#86efac" },
  cancelled:   { label: "Cancelled",   bg: "#3b1818", text: "#f87171" },
  on_hold:     { label: "On Hold",     bg: "#3b2e00", text: "#fbbf24" },
};

export function StatusBadge({ status }: { status: WorkOrderStatus }) {
  const cfg = CONFIG[status] ?? { label: status, bg: "#1e293b", text: "#94a3b8" };
  return (
    <View
      style={{ backgroundColor: cfg.bg }}
      className="rounded-full px-2.5 py-0.5"
    >
      <Text style={{ color: cfg.text }} className="text-xs font-medium">
        {cfg.label}
      </Text>
    </View>
  );
}
