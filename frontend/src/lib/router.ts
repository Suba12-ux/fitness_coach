export type RouteName =
  | "compose"
  | "run"
  | "generations"
  | "programs"
  | "program"
  | "workouts"
  | "workout"
  | "profile";

export interface Route {
  name: RouteName;
  id: string | null;
}

const COMPOSE: Route = { name: "compose", id: null };

function decode(raw: string): string | null {
  if (!raw) {
    return null;
  }
  try {
    const value = decodeURIComponent(raw);
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function withId(name: RouteName, rawId: string, fallback: Route): Route {
  const id = decode(rawId);
  return id ? { name, id } : fallback;
}

export function parseRoute(hash: string): Route {
  const value = (hash ?? "").replace(/^#/, "");
  if (!value) {
    return COMPOSE;
  }

  const slash = value.indexOf("/");
  const name = slash === -1 ? value : value.slice(0, slash);
  const rawId = slash === -1 ? "" : value.slice(slash + 1);

  switch (name) {
    case "run":
      return withId("run", rawId, COMPOSE);
    case "history":
      return { name: "generations", id: null };
    case "programs":
      return withId("program", rawId, { name: "programs", id: null });
    case "workouts":
      return withId("workout", rawId, { name: "workouts", id: null });
    case "profile":
      return { name: "profile", id: null };
    default:
      return COMPOSE;
  }
}

export function hashFor(route: Route): string {
  switch (route.name) {
    case "compose":
      return "";
    case "run":
      return route.id ? `#run/${encodeURIComponent(route.id)}` : "";
    case "generations":
      return "#history";
    case "programs":
      return "#programs";
    case "program":
      return route.id ? `#programs/${encodeURIComponent(route.id)}` : "#programs";
    case "workouts":
      return "#workouts";
    case "workout":
      return route.id ? `#workouts/${encodeURIComponent(route.id)}` : "#workouts";
    case "profile":
      return "#profile";
    default:
      return "";
  }
}
