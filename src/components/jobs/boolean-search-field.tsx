import { BooleanSearchEditor } from "@/components/jobs/boolean-search-editor";

/** @deprecated Use BooleanSearchEditor */
export function BooleanSearchField({
  id = "booleanSearch",
  name = "booleanSearch",
  defaultValue = "",
}: {
  id?: string;
  name?: string;
  defaultValue?: string | null;
}) {
  return (
    <BooleanSearchEditor
      id={id}
      name={name}
      defaultValue={defaultValue}
      titleInputId="title"
      descriptionInputId="description"
    />
  );
}
