import PlannerScreen from "@/components/planner/PlannerScreen";
import { localDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default function TodayPage() {
  return <PlannerScreen date={localDate()} />;
}
