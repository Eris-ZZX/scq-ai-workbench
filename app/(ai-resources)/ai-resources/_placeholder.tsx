export default function AiResourcesPlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
