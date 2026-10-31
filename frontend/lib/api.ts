const baseUrl = "/backend";
export type ApiResult<T> = { data?: T; error?: string };
export async function api<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const token = typeof window !== "undefined" ? localStorage.getItem("tz_access_token") : null;
  let response: Response;
  try { response = await fetch(`${baseUrl}${path}`, { ...options, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers } }); }
  catch { return { error: "Cannot reach the API. Check that the backend is running and CORS allows this frontend." }; }
  const body = await response.json().catch(() => ({}));
  if (response.status === 401 && typeof window !== "undefined" && path !== "/api/v1/auth/login") {
    localStorage.removeItem("tz_access_token");
    localStorage.removeItem("tz_role");
    window.location.assign("/login");
  }
  return response.ok ? { data: body as T } : { error: body.message ?? "Request failed" };
}

export function uuidv7(): string {
  const timestamp = Date.now().toString(16).padStart(12, "0");
  const random = () => Math.floor(Math.random() * 16).toString(16);
  const tail = Array.from({ length: 19 }, random).join("");
  return `${timestamp.slice(0,8)}-${timestamp.slice(8)}-7${tail.slice(0,3)}-${["8","9","a","b"][Math.floor(Math.random()*4)]}${tail.slice(3,6)}-${tail.slice(6,18)}`;
}
