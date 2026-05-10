import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Check, RotateCcw, SkipForward, X } from "lucide-react-native";
import { Task } from "@/types";

interface Props {
  tasks: Task[];
  onUpdate: (
    taskId: string,
    status: "completed" | "pending" | "skipped",
    skipReason?: string
  ) => void;
  isPending: boolean;
}

function TaskRow({
  task,
  onUpdate,
  isPending,
}: {
  task: Task;
  onUpdate: Props["onUpdate"];
  isPending: boolean;
}) {
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipReason, setSkipReason] = useState("");

  const isCompleted = task.status === "completed";
  const isSkipped = task.status === "skipped";
  const isDone = isCompleted || isSkipped;

  const handleSkipConfirm = () => {
    onUpdate(task.id, "skipped", skipReason.trim() || undefined);
    setShowSkipModal(false);
    setSkipReason("");
  };

  return (
    <>
      <View className="flex-row items-start gap-3 py-3 border-b border-slate-700/50 last:border-0">
        {/* Complete toggle */}
        <TouchableOpacity
          onPress={() => onUpdate(task.id, isCompleted ? "pending" : "completed")}
          disabled={isPending || isSkipped}
          className={`w-6 h-6 rounded-full border-2 items-center justify-center mt-0.5 ${
            isCompleted
              ? "bg-green-500 border-green-500"
              : isSkipped
              ? "border-slate-600"
              : "border-slate-500"
          }`}
        >
          {isCompleted && <Check color="#fff" size={13} strokeWidth={3} />}
        </TouchableOpacity>

        {/* Title */}
        <View className="flex-1">
          <Text
            className={`text-sm ${
              isCompleted
                ? "text-slate-500 line-through"
                : isSkipped
                ? "text-slate-600 line-through"
                : "text-slate-200"
            }`}
          >
            {task.title}
          </Text>
          {isSkipped && task.skip_reason && (
            <Text className="text-slate-600 text-xs mt-0.5">
              Skipped: {task.skip_reason}
            </Text>
          )}
        </View>

        {/* Actions */}
        {!isDone && (
          <TouchableOpacity
            onPress={() => setShowSkipModal(true)}
            disabled={isPending}
            className="p-1"
          >
            <SkipForward color="#64748b" size={16} />
          </TouchableOpacity>
        )}
        {isDone && (
          <TouchableOpacity
            onPress={() => onUpdate(task.id, "pending")}
            disabled={isPending}
            className="p-1"
          >
            <RotateCcw color="#64748b" size={15} />
          </TouchableOpacity>
        )}
      </View>

      {/* Skip reason modal */}
      <Modal
        visible={showSkipModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSkipModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 bg-black/60 justify-end"
        >
          <View className="bg-surface-card rounded-t-3xl px-5 pt-5 pb-8">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white font-semibold text-base">Skip task</Text>
              <TouchableOpacity onPress={() => setShowSkipModal(false)}>
                <X color="#64748b" size={20} />
              </TouchableOpacity>
            </View>
            <Text className="text-slate-400 text-sm mb-3">
              Reason for skipping{" "}
              <Text className="text-slate-600">(optional)</Text>
            </Text>
            <TextInput
              className="bg-surface rounded-xl px-4 py-3 text-white text-sm border border-slate-700 mb-4"
              placeholder="e.g. Client request, blocked by other work..."
              placeholderTextColor="#475569"
              value={skipReason}
              onChangeText={setSkipReason}
              multiline
            />
            <TouchableOpacity
              onPress={handleSkipConfirm}
              className="bg-amber-600 rounded-xl py-3 items-center"
              activeOpacity={0.8}
            >
              <Text className="text-white font-semibold">Skip task</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

export function TaskList({ tasks, onUpdate, isPending }: Props) {
  const sorted = [...tasks].sort((a, b) => a.order - b.order);
  return (
    <View className="bg-surface-card rounded-2xl border border-slate-700 px-4">
      {sorted.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onUpdate={onUpdate}
          isPending={isPending}
        />
      ))}
    </View>
  );
}
