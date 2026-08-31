import { Card, CardContent } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/shared/dashboard-widgets";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <LoadingSkeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <LoadingSkeleton className="h-4 w-24 mb-2" />
              <LoadingSkeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <LoadingSkeleton className="h-48 w-full" />
    </div>
  );
}
