import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { listMarketingMedia } from "@/lib/services/marketing-brand-service";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { MediaUploadForm } from "@/components/marketing/media-upload-form";

export default async function MediaLibraryPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const assets = await listMarketingMedia(member.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader title="Media Library" description="Images, banners, and documents for email campaigns" />
      <MediaUploadForm />
      {assets.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No media assets yet. Upload images above to use them in the email designer.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <Card key={asset.id}>
              <CardContent className="p-3 text-sm">
                {asset.mimeType.startsWith("image/") && asset.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.url} alt={asset.altText ?? asset.fileName} className="mb-2 h-24 w-full rounded object-cover" />
                ) : null}
                <p className="font-medium truncate">{asset.fileName}</p>
                <p className="text-xs text-muted-foreground">{asset.folder} · {(asset.sizeBytes / 1024).toFixed(1)} KB</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
