const baseUrl = "/backend";
export type ApiResult<T> = { data?: T; error?: string };

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = localStorage.getItem("tz_refresh_token");
  if (!refreshToken) return false;
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.accessToken) return false;
      localStorage.setItem("tz_access_token", body.accessToken);
      localStorage.setItem("tz_refresh_token", body.refreshToken);
      if (body.role) localStorage.setItem("tz_role", body.role);
      return true;
    }).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<ApiResult<T>> {
  const token = typeof window !== "undefined" ? localStorage.getItem("tz_access_token") : null;
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers },
    });
  } catch {
    return { error: "Cannot reach the API. Check that the backend is running and CORS allows this frontend." };
  }
  if (response.status === 401 && typeof window !== "undefined" && path !== "/api/v1/auth/login" && path !== "/api/v1/auth/refresh" && retry) {
    const renewed = await refreshSession();
    if (renewed) return api<T>(path, options, false);
    localStorage.removeItem("tz_access_token");
    localStorage.removeItem("tz_refresh_token");
    localStorage.removeItem("tz_role");
    window.location.assign("/login");
  }
  const body = await response.json().catch(() => ({}));
  return response.ok ? { data: body as T } : { error: body.message ?? "Request failed" };
}

export function uuidv7(): string {
  const timestamp = Date.now().toString(16).padStart(12, "0");
  const random = () => Math.floor(Math.random() * 16).toString(16);
  const tail = Array.from({ length: 19 }, random).join("");
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-7${tail.slice(0, 3)}-${["8", "9", "a", "b"][Math.floor(Math.random() * 4)]}${tail.slice(3, 6)}-${tail.slice(6, 18)}`;
}
