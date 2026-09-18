import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, FileText, Loader2, Plus, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/page-header";
import { ChartCard } from "@/components/common/chart-card";
import { KpiTile } from "@/components/common/kpi-tile";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { chunkText, extractTextFromFile, MIN_USEFUL_TEXT } from "@/lib/extraction";
import { formatDate } from "@/lib/format";
import { usePermissions } from "@/hooks/use-permissions";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

interface DocumentRow {
  id: string;
  title: string;
  category: string;
  version: number;
  status: string;
  created_at: string;
  chunks: Array<{ id: string; section: string | null; chunk_text: string }>;
}

async function listDocuments(): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("talent_policy_documents")
    .select("id, title, category, version, status, created_at, chunks:talent_policy_chunks(id, section, chunk_text)")
    .order("title");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DocumentRow[];
}

export default function PoliciesPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { profile, org } = useProfile();
  const canManage = can("manage_policies");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [openDocument, setOpenDocument] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [body, setBody] = useState("");
  const [extractionNote, setExtractionNote] = useState<string | null>(null);

  const query = useQuery({ queryKey: ["talent360-policies"], queryFn: listDocuments });
  const documents = useMemo(() => query.data ?? [], [query.data]);

  const stats = useMemo(() => {
    const passages = documents.reduce((sum, document) => sum + document.chunks.length, 0);
    return {
      documents: documents.length,
      passages,
      categories: new Set(documents.map((document) => document.category)).size,
    };
  }, [documents]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!org?.id) throw new Error("Your workspace could not be resolved.");

      const chunks = chunkText(body.trim());
      if (!chunks.length) throw new Error("There is no text to index.");

      const { data: document, error: documentError } = await supabase
        .from("talent_policy_documents")
        .insert({
          org_id: org.id,
          title: title.trim(),
          category,
          version: 1,
          status: "indexed",
          uploaded_by: profile?.id ?? null,
        })
        .select("id")
        .single();

      if (documentError) throw new Error(documentError.message);

      const rows = chunks.map((chunk, index) => ({
        org_id: org.id,
        document_id: document.id,
        section: `Part ${index + 1}`,
        chunk_index: index,
        chunk_text: chunk,
      }));

      const { error: chunkError } = await supabase.from("talent_policy_chunks").insert(rows);
      if (chunkError) throw new Error(chunkError.message);

      return { passages: rows.length };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["talent360-policies"] });
      toast.success("Policy indexed", { description: `${result.passages} searchable passage(s) stored.` });
      setDialogOpen(false);
      setTitle("");
      setBody("");
      setExtractionNote(null);
    },
    onError: (error) => {
      toast.error("Policy not indexed", {
        description: error instanceof Error ? error.message : "The document could not be stored.",
      });
    },
  });

  const handleFile = async (file: File) => {
    setExtractionNote("Reading the document…");
    const result = await extractTextFromFile(file);
    if (!result.ok) {
      setExtractionNote(`${result.reason} Paste the text instead.`);
      return;
    }
    setBody(result.text);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    setExtractionNote(`${result.text.length.toLocaleString()} characters read from ${file.name}.`);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Policy library"
        description="This is the corpus the Policy Copilot retrieves from. Only text stored here can be cited, which is what keeps answers grounded."
        statusLabel={`${stats.documents} documents indexed`}
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Upload policy
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiTile label="Documents" value={String(stats.documents)} icon={FileText} tone="primary" />
        <KpiTile label="Searchable passages" value={String(stats.passages)} icon={BookOpen} tone="info" />
        <KpiTile label="Categories" value={String(stats.categories)} icon={FileText} tone="accent" />
      </div>

      {query.isLoading ? <LoadingState label="Reading the policy library" /> : null}

      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "The policy library could not be loaded."}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error && !documents.length ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="No policy documents yet"
          description={
            canManage
              ? "Upload the leave, conduct and remote working policies so the copilot has something to cite."
              : "HR has not added policy documents to this workspace yet."
          }
          action={
            canManage ? (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Upload policy
              </Button>
            ) : null
          }
        />
      ) : null}

      {!query.isLoading && !query.error && documents.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {documents.map((document) => {
            const expanded = openDocument === document.id;
            return (
              <ChartCard
                key={document.id}
                title={document.title}
                subtitle={`${document.category} · version ${document.version} · added ${formatDate(
                  document.created_at,
                )}`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone="success">{document.chunks.length} passages</StatusPill>
                    <StatusPill tone={document.status === "indexed" ? "primary" : "warning"}>
                      {document.status}
                    </StatusPill>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenDocument(expanded ? null : document.id)}
                    disabled={!document.chunks.length}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    {expanded ? "Hide passages" : "View indexed passages"}
                  </Button>

                  {expanded ? (
                    <ul className="talent-scroll flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
                      {document.chunks.map((chunk) => (
                        <li key={chunk.id} className="rounded-lg bg-muted/40 px-3 py-2">
                          <div className="talent-label">{chunk.section ?? "Passage"}</div>
                          <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-muted-foreground">
                            {chunk.chunk_text}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </ChartCard>
            );
          })}
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-extrabold">Upload a policy document</DialogTitle>
            <DialogDescription className="text-[12.5px] font-medium leading-relaxed">
              The text is read in your browser, split into overlapping passages and indexed for retrieval.
              Only the extracted text is stored.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="policyTitle">Title</Label>
                <Input
                  id="policyTitle"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Leave & Time Off Policy"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="policyCategory">Category</Label>
                <select
                  id="policyCategory"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className={cn(
                    "h-9 w-full rounded-lg border border-input bg-card px-3 text-[13px] font-medium text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  )}
                >
                  {["Leave", "Conduct", "Ways of working", "Compensation", "Benefits", "General"].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-input bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[12.5px] font-bold text-foreground">Source document</div>
                  <div className="text-[11px] font-medium text-muted-foreground">
                    PDF, DOCX, TXT or Markdown
                  </div>
                </div>
                <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg bg-primary-soft px-3 text-[12px] font-bold text-primary-soft-foreground transition-colors hover:bg-primary-soft/70">
                  <Upload className="h-3.5 w-3.5" />
                  Choose file
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md,application/pdf"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleFile(file);
                    }}
                  />
                </label>
              </div>
              {extractionNote ? (
                <p className="text-[11.5px] font-semibold leading-snug text-muted-foreground">{extractionNote}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="policyBody">Policy text</Label>
              <Textarea
                id="policyBody"
                className="min-h-[200px]"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Paste the policy text, or upload the document above."
              />
              <span className="text-[11px] font-medium text-muted-foreground">
                {body.trim().length.toLocaleString()} characters ·{" "}
                {chunkText(body.trim()).length} passage(s) will be indexed
                {body.trim().length > 0 && body.trim().length < MIN_USEFUL_TEXT
                  ? " · add more text before indexing"
                  : ""}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => uploadMutation.mutate()}
              disabled={
                uploadMutation.isPending || !title.trim() || body.trim().length < MIN_USEFUL_TEXT
              }
            >
              {uploadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Index document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
