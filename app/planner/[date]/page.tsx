import { notFound } from "next/navigation";
import { isValidDateKey } from "@/lib/time";
import PlannerScreen from "@/components/planner/PlannerScreen";

export const dynamic = "force-dynamic";

export default async function PlannerDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidDateKey(date)) notFound();
  return <PlannerScreen date={date} />;
}
