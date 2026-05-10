// Shared types — mirrors FieldPro web frontend/src/types/index.ts
// When the backend schema changes, update both files.
// Future: extract to @fieldpro/types workspace package.

export type UserRole = "admin" | "manager" | "employee";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  tenant_id: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export type WorkOrderStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "on_hold";

export type WorkOrderPriority = "low" | "medium" | "high" | "urgent";

export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  skip_reason?: string;
  work_order_id: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface CheckIn {
  id: string;
  work_order_id: string;
  user_id: string;
  checked_in_at: string;
  checked_out_at?: string;
  latitude?: number;
  longitude?: number;
  distance_meters?: number;
}

export interface WorkOrder {
  id: string;
  title: string;
  description?: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  scheduled_date: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  estimated_hours?: number;
  client_id: string;
  client_name?: string;
  location_id?: string;
  location_name?: string;
  location_address?: string;
  crew_id?: string;
  assigned_to?: string;
  tasks?: Task[];
  check_ins?: CheckIn[];
  is_overdue: boolean;
  recurrence_rule?: string;
  is_recurring: boolean;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}
