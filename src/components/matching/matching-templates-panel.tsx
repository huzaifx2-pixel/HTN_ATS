import { CreateEmailTemplateForm } from "@/components/email/create-email-template-form";
import { EmailTemplatePreview } from "@/components/email/email-template-preview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { deleteEmailTemplateAction } from "@/app/actions";

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

export function MatchingTemplatesPanel({ templates }: { templates: EmailTemplate[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Create template</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateEmailTemplateForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Saved templates ({templates.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates yet.</p>
          ) : (
            templates.map((template) => (
              <div key={template.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{template.name}</div>
                  </div>
                  <form action={deleteEmailTemplateAction.bind(null, template.id)}>
                    <Button type="submit" variant="outline" size="sm">
                      Delete
                    </Button>
                  </form>
                </div>
                <EmailTemplatePreview subject={template.subject} html={template.body} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
