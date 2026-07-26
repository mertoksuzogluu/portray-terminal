import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";
import { loadGoalsDashboard } from "@/lib/goals/dashboard-data";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const goalId = req.nextUrl.searchParams.get("goalId");
    const data = await loadGoalsDashboard(user.id, goalId);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
