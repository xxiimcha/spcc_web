import React, { useEffect, useState } from "react";
import axios from "axios";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";

export interface SectionRef {
  section_id: number;
  section_name: string;
}

export interface Subject {
  subj_id: number;
  subj_code: string;
  subj_name: string;
  subj_description?: string | null;
  schedule_count: number;
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  section: SectionRef | null;
  apiBase?: string; // optional override, defaults to http://localhost/spcc_database
  onSaved?: () => void; // optional: callback after successful save
};

/**
 * AssignSubjectsDialog
 * - Lists ALL subjects from the DB
 * - Does NOT fetch/show already assigned subjects yet
 * - Starts with all checkboxes UNCHECKED
 * - Saves selected subject IDs to /section_subjects.php (optional)
 */
const AssignSubjectsDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  section,
  apiBase = "http://localhost/spcc_database",
  onSaved,
}) => {
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSubjects = async () => {
    if (!section) return;
    try {
      setLoading(true);
      const subsRes = await axios.get(`${apiBase}/subjects.php`);
      if (!subsRes.data?.success || !Array.isArray(subsRes.data.data)) {
        throw new Error("Failed to load subjects");
      }
      setAllSubjects(subsRes.data.data as Subject[]);
      // Do NOT pre-check anything (no assigned fetch at this step)
      setSelected(new Set());
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Error",
        description: e?.message || "Failed to load subjects.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, section?.section_id]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const save = async () => {
    if (!section) return;
    try {
      setSaving(true);
      const body = { section_id: section.section_id, subj_ids: Array.from(selected) };
        const res = await axios.put(`${apiBase}/sections.php?id=${section.section_id}`, {
            subj_ids: Array.from(selected),
        });
      if (!res.data?.success) throw new Error(res.data?.message || "Failed to save");
      toast({ title: "Saved", description: "Subjects assigned to section." });
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Error",
        description: e?.message || "Failed to save changes.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Assign Subjects {section ? `• ${section.section_name}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md border">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 text-sm">
            <span>Total subjects: {allSubjects.length}</span>
            <span>Selected: {selected.size}</span>
          </div>

          <div className="max-h-[420px] overflow-auto divide-y">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              </div>
            ) : allSubjects.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No subjects found.
              </div>
            ) : (
              allSubjects.map((s) => {
                const isChecked = selected.has(s.subj_id);
                return (
                  <label
                    key={s.subj_id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer"
                  >
                    <Checkbox checked={isChecked} onCheckedChange={() => toggle(s.subj_id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="font-medium truncate">
                          {s.subj_code} — {s.subj_name}
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">
                          used in {s.schedule_count} schedule{s.schedule_count === 1 ? "" : "s"}
                        </div>
                      </div>
                      {s.subj_description && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {s.subj_description}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving || loading} onClick={save}>
            {saving ? "Saving..." : "Save Assignments"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignSubjectsDialog;
