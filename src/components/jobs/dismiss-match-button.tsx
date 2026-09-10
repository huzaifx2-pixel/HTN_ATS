import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dismissJobMatchAction } from "@/app/actions";

export function DismissMatchButton({
  jobId,
  candidateId,
  candidateName,
}: {
  jobId: string;
  candidateId: string;
  candidateName: string;
}) {
  return (
    <form action={dismissJobMatchAction.bind(null, jobId, candidateId)}>
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-destructive"
        title={`Remove ${candidateName} from matching list`}
        aria-label={`Remove ${candidateName} from matching list`}
      >
        <X className="h-4 w-4" />
      </Button>
    </form>
  );
}
