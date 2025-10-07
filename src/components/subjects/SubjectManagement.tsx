import React, { useState, useEffect, useMemo } from "react";
import {
  PlusCircle,
  Pencil,
  Trash2,
  Search,
  Eye,
  Upload,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { apiService } from "@/services/apiService";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import SubjectForm from "./SubjectForm";
import BulkUploadForm from "./BulkUploadForm";

// NEW: shadcn Selects for filters
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Subject {
  id: string;
  code: string;
  name: string;
  description?: string;
  units?: number;
  type?: string;          // e.g., "Core", "Applied", etc.
  hoursPerWeek?: number;
  // NEW:
  gradeLevel?: string;    // e.g., "11", "12"
  strand?: string;        // e.g., "ICT", "STEM"
  schedule_count?: number;
}

interface Professor {
  id: string;
  name: string;
  email?: string;
  qualifications?: string[];
  phone?: string;
}

interface AssignedProfessor extends Professor {
  assignmentId?: string;
  scheduleInfo?: string;
}

const API_URL = "http://localhost/spcc_database/subjects.php";
const ASSIGNMENT_API_URL = "http://localhost/spcc_database/get_subject_professors.php";

const PAGE_SIZES = [10, 25, 50];

const ALL_VALUES = {
  strand: "__ALL_STRAND__",
  type: "__ALL_TYPE__",
  grade: "__ALL_GRADE__",
} as const;

const SubjectManagement = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [currentSubject, setCurrentSubject] = useState<Subject | null>(null);
  const [assignedProfessors, setAssignedProfessors] = useState<AssignedProfessor[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // bulk upload
  const [isUploading, setIsUploading] = useState(false);

  // PAGINATION (client-side)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);

  // NEW: filter states
  const [filterStrand, setFilterStrand] = useState<string>("");      // "" means All
  const [filterType, setFilterType] = useState<string>("");
  const [filterGrade, setFilterGrade] = useState<string>("");

  // Fetch subjects
  const fetchSubjects = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getSubjects();
      if (response.success && Array.isArray(response.data)) {
        const mappedSubjects: Subject[] = response.data.map((subject: any) => ({
          id: subject.subj_id?.toString() || subject.id?.toString(),
          name: subject.subj_name || subject.name,
          code: subject.subj_code || subject.code,
          description: subject.subj_description || subject.description,
          units: subject.subj_units || subject.units,
          type: subject.subj_type || subject.type,                   // map type
          hoursPerWeek: subject.subj_hours_per_week || subject.hoursPerWeek,
          gradeLevel: subject.grade_level || subject.gradeLevel || "", // map grade level
          strand: subject.strand || "",                                // map strand
          schedule_count: subject.schedule_count || 0,
        }));
        setSubjects(mappedSubjects);
        setError(null);
      } else {
        throw new Error(response.message || "Failed to fetch subjects");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to fetch subjects: ${errorMessage}`);
      setSubjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch assigned professors
  const fetchAssignedProfessors = async (subjectId: string) => {
    try {
      setIsLoadingAssignments(true);
      const response = await apiService.getSubjectProfessors(Number(subjectId));
      const profs = response?.data?.professors;
      if (response.success && Array.isArray(profs)) {
        const professors: AssignedProfessor[] = profs.map((prof: any) => ({
          id: String(prof.prof_id),
          name: prof.prof_name,
          email: prof.prof_email || "",
          phone: prof.prof_phone || "",
          qualifications: (() => {
            try {
              const q = prof.prof_qualifications;
              if (!q) return [];
              const parsed = JSON.parse(q);
              return Array.isArray(parsed) ? parsed : [String(parsed)];
            } catch {
              return String(prof.prof_qualifications).split(",").map((s) => s.trim());
            }
          })(),
          scheduleInfo: prof.schedules || "",
        }));
        setAssignedProfessors(professors);
      } else {
        setAssignedProfessors([]);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to load assigned professors: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
      setAssignedProfessors([]);
    } finally {
      setIsLoadingAssignments(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  // Build filter option lists from current subjects
  const strandOptions = useMemo(() => {
    const set = new Set<string>();
    subjects.forEach((s) => s.strand && set.add(String(s.strand)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [subjects]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    subjects.forEach((s) => s.type && set.add(String(s.type)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [subjects]);

  const gradeOptions = useMemo(() => {
    const set = new Set<string>();
    subjects.forEach((s) => s.gradeLevel && set.add(String(s.gradeLevel)));
    // numeric-ish sort if all numeric, else lexicographic
    const allNum = Array.from(set).every((v) => /^\d+$/.test(v));
    const arr = Array.from(set);
    return allNum ? arr.sort((a, b) => Number(a) - Number(b)) : arr.sort((a, b) => a.localeCompare(b));
  }, [subjects]);

  // Filter logic (search + filters)
  const filteredSubjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return subjects.filter((subject) => {
      if (!subject) return false;
      // search
      const matchSearch =
        !q ||
        (subject.code && subject.code.toLowerCase().includes(q)) ||
        (subject.name && subject.name.toLowerCase().includes(q));
      if (!matchSearch) return false;

      // filters
      const matchStrand = !filterStrand || (subject.strand && String(subject.strand) === filterStrand);
      if (!matchStrand) return false;

      const matchType = !filterType || (subject.type && String(subject.type) === filterType);
      if (!matchType) return false;

      const matchGrade = !filterGrade || (subject.gradeLevel && String(subject.gradeLevel) === filterGrade);
      if (!matchGrade) return false;

      return true;
    });
  }, [subjects, searchQuery, filterStrand, filterType, filterGrade]);

  // Reset to page 1 when search, page size, OR filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize, filterStrand, filterType, filterGrade]);

  // Client-side pagination math
  const totalItems = filteredSubjects.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pageStartIndex = (currentPage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, totalItems);
  const paginatedSubjects = filteredSubjects.slice(pageStartIndex, pageEndIndex);

  const gotoFirst = () => setCurrentPage(1);
  const gotoPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const gotoNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));
  const gotoLast = () => setCurrentPage(totalPages);

  // Manual add submit
  const handleAddSubject = async (data: Omit<Subject, "id">) => {
    try {
      const subjectData = {
        subj_code: data.code,
        subj_name: data.name,
        subj_description: data.description || "",
        subj_units: data.units ?? 3,
        subj_type: data.type ?? "Core",
        subj_hours_per_week: data.hoursPerWeek ?? 3,

        code: data.code,
        name: data.name,
        description: data.description || "",
        units: data.units ?? 3,
        type: data.type ?? "Core",
        hoursPerWeek: data.hoursPerWeek ?? 3,
      };

      const response = await apiService.createSubject(subjectData);
      if (response.success || response.status === "success") {
        await fetchSubjects();
        toast({ title: "Success", description: response.message || "Subject added successfully" });
        setIsAddDialogOpen(false);
      } else {
        throw new Error(response.message || "Failed to add subject");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast({ title: "Error", description: `Failed to add subject: ${errorMessage}`, variant: "destructive" });
    }
  };

  // UPDATE
  const handleEditSubject = async (data: Omit<Subject, "id">) => {
    if (!currentSubject) return;
    try {
      const subjectData = {
        subj_code: data.code,
        subj_name: data.name,
        subj_description: data.description || "",
        subj_units: data.units ?? 3,
        subj_type: data.type ?? "Core",
        subj_hours_per_week: data.hoursPerWeek ?? 3,

        code: data.code,
        name: data.name,
        description: data.description || "",
        units: data.units ?? 3,
        type: data.type ?? "Core",
        hoursPerWeek: data.hoursPerWeek ?? 3,
      };

      const response = await apiService.updateSubject(Number(currentSubject.id), subjectData);
      if (response.success || response.status === "success") {
        await fetchSubjects();
        toast({ title: "Success", description: response.message || "Subject updated successfully" });
        setIsEditDialogOpen(false);
      } else {
        throw new Error(response.message || "Failed to update subject");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast({ title: "Error", description: `Failed to update subject: ${errorMessage}`, variant: "destructive" });
    }
  };

  // Bulk upload submit
  const handleBulkUpload = async (file: File) => {
    const ext = file.name.toLowerCase().split(".").pop();
    if (!["xlsx", "xls"].includes(ext || "")) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Only Excel files (.xlsx, .xls) are allowed.",
      });
      return;
    }

    try {
      setIsUploading(true);
      const form = new FormData();
      form.append("file", file, file.name);
      const resp = await apiService.bulkUploadSubjects(form);
      if (resp?.success) {
        toast({
          title: "Bulk upload complete",
          description: resp.message || "Subjects processed successfully.",
        });
        setIsBulkDialogOpen(false);
        await fetchSubjects();
      } else {
        throw new Error(resp?.message || "Bulk upload failed");
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsUploading(false);
    }
  };

  const openViewDialog = async (subject: Subject) => {
    setCurrentSubject(subject);
    setIsViewDialogOpen(true);
    if (subject.id) await fetchAssignedProfessors(subject.id);
  };

  const handleDeleteSubject = async () => {
    if (!currentSubject) return;
    try {
      const response = await apiService.deleteSubject(Number(currentSubject.id));
      if (response.success) {
        await fetchSubjects();
        toast({
          title: "Success",
          description: response.message || "Subject deleted successfully",
        });
      } else {
        throw new Error(response.message || "Failed to delete subject");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast({
        title: "Error",
        description: `Failed to delete subject: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const openEditDialog = (subject: Subject) => {
    setCurrentSubject(subject);
    setIsEditDialogOpen(true);
  };
  const openDeleteDialog = (subject: Subject) => {
    setCurrentSubject(subject);
    setIsDeleteDialogOpen(true);
  };

  const clearFilters = () => {
    setFilterStrand("");
    setFilterType("");
    setFilterGrade("");
  };

  return (
    <div className="w-full p-6 bg-white rounded-lg shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold">Subject Management</h1>

        {/* Dropdown Add Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Subject
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setIsAddDialogOpen(true)}>
              Manual add
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsBulkDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Bulk Upload (Excel)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 md:grid md:grid-cols-2 lg:grid-cols-5 mb-6">
        <div className="relative col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Strand filter */}
        <Select
          value={filterStrand}
          onValueChange={(v) => setFilterStrand(v === ALL_VALUES.strand ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All strands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUES.strand}>All strands</SelectItem>
            {strandOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type filter */}
        <Select
          value={filterType}
          onValueChange={(v) => setFilterType(v === ALL_VALUES.type ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUES.type}>All types</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Grade level filter */}
        <Select
          value={filterGrade}
          onValueChange={(v) => setFilterGrade(v === ALL_VALUES.grade ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All grade levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUES.grade}>All grade levels</SelectItem>
            {gradeOptions.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>


        {/* Clear filters button (full width on small, inline on large) */}
        <div className="lg:col-span-1">
          <Button variant="outline" className="w-full" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 mb-6 rounded-md border border-red-200">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10">Loading subjects...</div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSubjects.length > 0 ? (
                paginatedSubjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.code}</TableCell>
                    <TableCell>{subject.name}</TableCell>
                    <TableCell className="max-w-md truncate">
                      {subject.description || ""}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openViewDialog(subject)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(subject)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(subject)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6">
                    {filteredSubjects.length === 0 ? "No subjects found" : "No subjects on this page"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination footer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
            <div className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium">{totalItems === 0 ? 0 : pageStartIndex + 1}</span>
              –<span className="font-medium">{pageEndIndex}</span> of{" "}
              <span className="font-medium">{totalItems}</span> subjects
              {searchQuery || filterStrand || filterType || filterGrade ? (
                <span>
                  {" "}
                  (filtered from <span className="font-medium">{subjects.length}</span>)
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={gotoFirst} disabled={currentPage === 1}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={gotoPrev} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className="text-sm px-2">
                Page <span className="font-medium">{currentPage}</span> of{" "}
                <span className="font-medium">{totalPages}</span>
              </span>

              <Button
                variant="outline"
                size="icon"
                onClick={gotoNext}
                disabled={currentPage === totalPages || totalItems === 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={gotoLast}
                disabled={currentPage === totalPages || totalItems === 0}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Manual Add Dialog */}
      <SubjectForm open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onSubmit={handleAddSubject} />

      {/* Edit Subject Dialog */}
      {currentSubject && (
        <SubjectForm
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          initialData={{
            code: currentSubject.code,
            name: currentSubject.name,
            description: currentSubject.description || "",
          }}
          onSubmit={handleEditSubject}
        />
      )}

      {/* View Subject Dialog */}
      {currentSubject && (
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="sm:max-w-[600px] bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                Subject Details: {currentSubject.code} - {currentSubject.name}
              </DialogTitle>
              <DialogDescription>View details and assigned professors for this subject.</DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                <p className="text-base mt-1">{currentSubject.description || "No description provided"}</p>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Assigned Professors</h3>

                {isLoadingAssignments ? (
                  <div className="text-center py-4">Loading assigned professors...</div>
                ) : assignedProfessors.length > 0 ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Schedule</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignedProfessors.map((professor) => (
                          <TableRow key={professor.id}>
                            <TableCell className="font-medium">{professor.name}</TableCell>
                            <TableCell>{professor.scheduleInfo || "No schedule information"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-muted-foreground py-4 text-center bg-muted/20 rounded-md">
                    No professors are currently assigned to this subject.
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>Please confirm you want to delete this subject.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>
              Are you sure you want to delete the subject{" "}
              <span className="font-semibold">
                {currentSubject?.code} - {currentSubject?.name}
              </span>
              ? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSubject}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <BulkUploadForm
        open={isBulkDialogOpen}
        onOpenChange={setIsBulkDialogOpen}
        onUpload={handleBulkUpload}
        isUploading={isUploading}
      />
    </div>
  );
};

export default SubjectManagement;
