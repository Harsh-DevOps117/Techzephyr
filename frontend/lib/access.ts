export type Role = "admin" | "department_coordinator" | "faculty" | "club";

const all: Role[] = ["admin", "department_coordinator", "faculty", "club"];

export const routeAccess: Record<string, Role[]> = {
  "/dashboard": all,
  "/datasets": ["admin", "department_coordinator", "faculty"],
  "/schedule": all,
  "/approvals": ["admin"],
  "/approve": ["admin"],
  "/bookings": all,
  "/repair": ["admin", "department_coordinator", "faculty"],
  "/manual": ["admin", "department_coordinator"],
  "/jobs": all,
  "/profile": all,
};

export function canOpen(role: string, path: string) {
  const allowed = routeAccess[path];
  if (!allowed) return true;
  return allowed.includes(role as Role);
}
