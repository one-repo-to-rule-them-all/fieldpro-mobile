import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "fieldpro_access_token";
const REFRESH_TOKEN_KEY = "fieldpro_refresh_token";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8000";

// ─── Token helpers ────────────────────────────────────────────────────────────

export const tokenStorage = {
  getAccess: () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  getRefresh: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  setAccess: (token: string) => SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token),
  setRefresh: (token: string) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),
  clear: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};

// ─── Axios instance ───────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// Attach access token to every request
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Token refresh interceptor ────────────────────────────────────────────────

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

const processQueue = (token: string) => {
  refreshQueue.forEach((resolve) => resolve(token));
  refreshQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token: string) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await tokenStorage.getRefresh();
      if (!refreshToken) throw new Error("No refresh token");

      const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const newAccessToken: string = data.access_token;
      await tokenStorage.setAccess(newAccessToken);
      if (data.refresh_token) {
        await tokenStorage.setRefresh(data.refresh_token);
      }

      processQueue(newAccessToken);
      original.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(original);
    } catch (refreshError) {
      await tokenStorage.clear();
      // Auth store will detect missing token and redirect to login
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// ─── Auth endpoints ───────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string) => {
    // ?client=mobile tells the backend to include refresh_token in the JSON body
    const { data } = await axios.post(
      `${BASE_URL}/api/v1/auth/login?client=mobile`,
      { email, password }
    );
    return data; // { access_token, refresh_token, token_type }
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      await tokenStorage.clear();
    }
  },

  me: async () => {
    const { data } = await api.get("/auth/me");
    return data;
  },
};

// ─── Work order endpoints ─────────────────────────────────────────────────────

export const workOrdersApi = {
  list: async (params?: {
    status?: string;
    page?: number;
    page_size?: number;
  }) => {
    const { data } = await api.get("/work-orders", { params });
    return data;
  },

  get: async (id: string) => {
    const { data } = await api.get(`/work-orders/${id}`);
    return data;
  },

  checkIn: async (id: string, coords: { latitude: number; longitude: number }) => {
    const { data } = await api.post(`/work-orders/${id}/check-in`, coords);
    return data;
  },

  checkOut: async (id: string, coords: { latitude: number; longitude: number }) => {
    const { data } = await api.post(`/work-orders/${id}/check-out`, coords);
    return data;
  },
};

// ─── Task endpoints ───────────────────────────────────────────────────────────

export const tasksApi = {
  update: async (
    id: string,
    payload: { status: "completed" | "pending" | "skipped"; skip_reason?: string }
  ) => {
    const { data } = await api.patch(`/tasks/${id}`, payload);
    return data;
  },
};

export default api;
