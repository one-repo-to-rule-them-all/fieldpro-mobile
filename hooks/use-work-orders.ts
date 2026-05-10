import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workOrdersApi, tasksApi } from "@/lib/api";
import { WorkOrder, PaginatedResponse, Task } from "@/types";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const workOrderKeys = {
  all:    () => ["work-orders"] as const,
  lists:  () => [...workOrderKeys.all(), "list"] as const,
  list:   (filters: object) => [...workOrderKeys.lists(), filters] as const,
  detail: (id: string) => [...workOrderKeys.all(), "detail", id] as const,
};

// ─── My Jobs list ─────────────────────────────────────────────────────────────

export function useMyJobs() {
  return useQuery<PaginatedResponse<WorkOrder>>({
    queryKey: workOrderKeys.list({ status: "scheduled,in_progress" }),
    queryFn: () =>
      workOrdersApi.list({ status: "scheduled,in_progress", page_size: 50 }),
    staleTime: 60_000,
  });
}

// ─── Single work order ────────────────────────────────────────────────────────

export function useWorkOrder(id: string) {
  const queryClient = useQueryClient();
  return useQuery<WorkOrder>({
    queryKey: workOrderKeys.detail(id),
    queryFn: () => workOrdersApi.get(id),
    staleTime: 30_000,
    placeholderData: () => {
      const lists = queryClient.getQueriesData<PaginatedResponse<WorkOrder>>({
        queryKey: workOrderKeys.lists(),
      });
      for (const [, page] of lists) {
        const found = page?.items.find((wo) => wo.id === id);
        if (found) return found;
      }
    },
  });
}

// ─── Check in ─────────────────────────────────────────────────────────────────

export function useCheckIn(workOrderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (coords: { latitude: number; longitude: number }) =>
      workOrdersApi.checkIn(workOrderId, coords),
    onSuccess: (updated) => {
      queryClient.setQueryData(workOrderKeys.detail(workOrderId), updated);
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
    },
  });
}

// ─── Check out ────────────────────────────────────────────────────────────────

export function useCheckOut(workOrderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (coords: { latitude: number; longitude: number }) =>
      workOrdersApi.checkOut(workOrderId, coords),
    onSuccess: (updated) => {
      queryClient.setQueryData(workOrderKeys.detail(workOrderId), updated);
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
    },
  });
}

// ─── Task update ──────────────────────────────────────────────────────────────

export function useUpdateTask(workOrderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      status,
      skip_reason,
    }: {
      taskId: string;
      status: "completed" | "pending" | "skipped";
      skip_reason?: string;
    }) => tasksApi.update(taskId, { status, skip_reason }),
    onSuccess: (updatedTask: Task) => {
      // Optimistically patch the task inside the cached work order
      queryClient.setQueryData<WorkOrder>(
        workOrderKeys.detail(workOrderId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            tasks: old.tasks.map((t) =>
              t.id === updatedTask.id ? updatedTask : t
            ),
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
    },
  });
}
