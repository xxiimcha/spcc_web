import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  FileText,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import ProfessorForm from "./ProfessorForm";
import CredentialsViewer from "./CredentialsViewer";
import SuccessMessage from "../popupmsg/SuccessMessage";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Professor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  qualifications: string[];
  username?: string;
  password?: string;
  subjectCount?: number;
  subject_count?: number;
  subjects?: {
    id: string;
    subj_name: string;
    subj_code?: string;
  }[];
}

const PAGE_SIZES = [10, 25, 50];

const ProfessorManagement = () => {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCredentialsDialogOpen, setIsCredentialsDialogOpen] = useState(false);
  const [selectedProfessor, setSelectedProfessor] = useState<Professor | null>(null);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);

  const { toast } = useToast();

  useEffect(() => {
    fetchProfessors();
  }, []);

  const fetchProfessors = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getProfessors();
      if (response.success && Array.isArray(response.data)) {
        const mappedProfessors = response.data.map((prof: any) => ({
          id: prof.prof_id?.toString() || prof.id?.toString(),
          name: prof.prof_name || prof.name,
          email: prof.prof_email || prof.email,
          phone: prof.prof_phone || prof.phone,
          qualifications: prof.qualifications || [],
          username: prof.prof_username || prof.username,
          password: prof.prof_password || prof.password,
          subjectCount: prof.subjectCount || prof.subject_count || 0,
        }));
        setProfessors(mappedProfessors);
      } else {
        setProfessors([]);
        if (!response.success) throw new Error(response.message || "Failed to fetch professors");
      }
    } catch (err) {
      setError("Failed to load professors. Please try again later.");
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Could not fetch professors from the server.",
      });
    } finally {
      setLoading(false);
    }
  };

  const addProfessor = async (professorData: Omit<Professor, "id">) => {
    try {
      const response = await fetch("http://localhost/spcc_database/professors.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(professorData),
      });
      const result = await response.json();
      if (result.status === "error") throw new Error(result.message || "Failed to add professor");

      if (result.data?.id) {
        setProfessors((prev) => [...prev, result.data]);
      } else if (result.professor?.id) {
        setProfessors((prev) => [...prev, result.professor]);
      } else {
        await fetchProfessors();
      }

      setSuccessMessage(`Professor ${professorData.name} added successfully!`);
      setIsSuccessDialogOpen(true);
      setIsAddDialogOpen(false);
      return true;
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to add professor: ${err instanceof Error ? err.message : String(err)}`,
      });
      return false;
    }
  };

  const updateProfessor = async (id: string, professorData: Omit<Professor, "id">) => {
    try {
      const response = await fetch(`http://localhost/spcc_database/professors.php?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(professorData),
      });
      const result = await response.json();
      if (result.status === "error") throw new Error(result.message || "Failed to update professor");

      setProfessors((prev) => prev.map((p) => (p.id === id ? ({ ...professorData, id } as Professor) : p)));
      setIsEditDialogOpen(false);
      setSuccessMessage(`Professor ${professorData.name} updated successfully!`);
      setIsSuccessDialogOpen(true);
      return true;
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update professor. Please try again.",
      });
      return false;
    }
  };

  const deleteProfessor = async (id: string) => {
    try {
      const response = await fetch(`http://localhost/spcc_database/professors.php?id=${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (result.status === "error") throw new Error(result.message || "Failed to delete professor");

      setProfessors((prev) => prev.filter((p) => p.id !== id));
      setIsDeleteDialogOpen(false);
      const professorName = selectedProfessor?.name || "Professor";
      setSuccessMessage(`${professorName} deleted successfully!`);
      setIsSuccessDialogOpen(true);
      return true;
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete professor. Please try again.",
      });
      return false;
    }
  };

  const fetchProfessorSubjects = async (professorId: string) => {
    try {
      const res = await fetch(`http://localhost/spcc_database/professors.php?id=${professorId}`);
      const json = await res.json();
      if (json?.status === "success" && json?.data?.subjects) {
        setSelectedProfessor((prev) =>
          prev && prev.id === professorId
            ? {
                ...prev,
                subjects: json.data.subjects.map((s: any) => ({
                  id: String(s.subj_id),
                  subj_name: s.subj_name,
                  subj_code: s.subj_code,
                })),
              }
            : prev
        );
      } else {
        setSelectedProfessor((prev) => (prev && prev.id === professorId ? { ...prev, subjects: [] } : prev));
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Could not fetch subjects for this professor.",
      });
      setSelectedProfessor((prev) => (prev && prev.id === professorId ? { ...prev, subjects: [] } : prev));
    }
  };


  const filteredProfessors = professors.filter(
    (prof) =>
      prof.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prof.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  const totalItems = filteredProfessors.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pageStartIndex = (currentPage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, totalItems);
  const paginatedProfessors = filteredProfessors.slice(pageStartIndex, pageEndIndex);

  const gotoFirst = () => setCurrentPage(1);
  const gotoPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const gotoNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));
  const gotoLast = () => setCurrentPage(totalPages);

  const handleAddProfessor = async (data: Omit<Professor, "id">) => addProfessor(data);
  const handleUpdateProfessor = async (data: Omit<Professor, "id">) =>
    selectedProfessor ? await updateProfessor(selectedProfessor.id ?? "", data) : false;
  const handleDeleteProfessor = async () => {
    if (selectedProfessor) await deleteProfessor(selectedProfessor.id ?? "");
  };

  const openEditDialog = (professor: Professor) => {
    setSelectedProfessor(professor);
    setIsEditDialogOpen(true);
  };
  const openViewDialog = (professor: Professor) => {
    setSelectedProfessor(professor);
    setIsViewDialogOpen(true);
    if (professor.id) fetchProfessorSubjects(professor.id);
  };
  const openDeleteDialog = (professor: Professor) => {
    setSelectedProfessor(professor);
    setIsDeleteDialogOpen(true);
  };

  const getWorkloadStatusClass = (subjectCount: number) => {
    if (subjectCount >= 8) return "text-destructive font-medium";
    if (subjectCount >= 6) return "text-amber-500 font-medium";
    return "text-emerald-600 font-medium";
  };
  const getWorkloadStatusText = (subjectCount: number) => {
    if (subjectCount >= 8) return `${subjectCount} subjects (Maximum)`;
    if (subjectCount >= 6) return `${subjectCount} subjects (Warning)`;
    return `${subjectCount} subjects`;
  };

  const getSubjectsForProfessor = async (professorId: string) => {
    try {
      const res = await fetch(
        `http://localhost/spcc_database/get_list_of_subjects.php?professor_id=${professorId}`
      );
      const data = await res.json();
      if (data?.status === "success" && Array.isArray(data.subjects)) {
        return data.subjects.map((s: any) => ({
          id: s.subj_id?.toString?.() ?? String(s.subj_id ?? ""),
          subj_name: s.subj_name ?? "",
          subj_code: s.subj_code ?? "",
        }));
      }
    } catch (_) {}
    return [];
  };

  const ensureSubjectsFor = async (list: Professor[]) => {
    const enriched = await Promise.all(
      list.map(async (p) => {
        if (Array.isArray(p.subjects)) return p;
        const subjects = await getSubjectsForProfessor(p.id);
        return { ...p, subjects };
      })
    );
    return enriched;
  };

  const toFlatRows = (list: Professor[]) => {
    const rows: Array<[string, string, string, string]> = [];
    list.forEach((p) => {
      const email = p.email || "N/A";
      if (!p.subjects || p.subjects.length === 0) {
        rows.push([p.name, email, "—", "No subjects"]);
      } else {
        p.subjects.forEach((s) => {
          rows.push([p.name, email, s.subj_code || "N/A", s.subj_name || ""]);
        });
      }
    });
    return rows;
  };

  const exportToExcel = async () => {
    try {
      const list = await ensureSubjectsFor(filteredProfessors);
      const rows = toFlatRows(list);
      const header = ["Professor", "Email", "Subject Code", "Subject Name"];
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      ws["!cols"] = [{ wch: 28 }, { wch: 28 }, { wch: 16 }, { wch: 48 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Professors-Subjects");
      const date = new Date();
      const stamp = date.toISOString().slice(0, 19).replace(/[:T]/g, "-");
      XLSX.writeFile(wb, `professors-subjects_${stamp}.xlsx`);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: err instanceof Error ? err.message : "Could not export to Excel.",
      });
    }
  };

  const exportToPDF = async () => {
    try {
      const list = await ensureSubjectsFor(filteredProfessors);
      const rows = toFlatRows(list);
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const title = "Professors and Assigned Subjects";
      doc.setFontSize(14);
      doc.text(title, 40, 40);
      autoTable(doc, {
        startY: 60,
        head: [["Professor", "Email", "Subject Code", "Subject Name"]],
        body: rows,
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: undefined },
        columnStyles: { 0: { cellWidth: 180 }, 1: { cellWidth: 200 }, 2: { cellWidth: 120 }, 3: { cellWidth: "auto" } },
        didDrawPage: () => {
          const page = (doc as any).getCurrentPageInfo?.().pageNumber ?? 1;
          const pages = (doc as any).internal.getNumberOfPages?.() || 1;
          doc.setFontSize(9);
          doc.text(
            `Page ${page} of ${pages}`,
            doc.internal.pageSize.getWidth() - 80,
            doc.internal.pageSize.getHeight() - 20
          );
        },
      });
      const date = new Date();
      const stamp = date.toISOString().slice(0, 19).replace(/[:T]/g, "-");
      doc.save(`professors-subjects_${stamp}.pdf`);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: err instanceof Error ? err.message : "Could not export to PDF.",
      });
    }
  };

  if (loading) {
    return (
      <div className="w-full p-6 bg-white rounded-lg shadow-sm flex justify-center">
        <div className="text-center">
          <p className="text-lg">Loading professors...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="w-full p-6 bg-white rounded-lg shadow-sm">
        <div className="text-center">
          <p className="text-lg text-destructive">{error}</p>
          <Button className="mt-4" onClick={fetchProfessors}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 bg-white rounded-lg shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <h2 className="text-2xl font-bold">Professor Management</h2>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setIsCredentialsDialogOpen(true)} className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> View Credentials
          </Button>
          <Button variant="outline" onClick={exportToExcel} className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={exportToPDF} className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Export PDF
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Professor
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div className="relative grow">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search professors by name or email..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <select
            className="border rounded-md px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Workload Status</TableHead>
              <TableHead>Specialization</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProfessors.length > 0 ? (
              paginatedProfessors.map((professor) => (
                <TableRow key={professor.id}>
                  <TableCell className="font-medium">{professor.name}</TableCell>
                  <TableCell>{professor.email}</TableCell>
                  <TableCell>
                    <span
                      className={getWorkloadStatusClass(
                        professor.subjectCount || professor.subject_count || 0
                      )}
                    >
                      {getWorkloadStatusText(
                        professor.subjectCount || professor.subject_count || 0
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {professor.qualifications && professor.qualifications.length > 0 ? (
                        <>
                          {professor.qualifications.slice(0, 2).map((qual, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground"
                            >
                              {qual}
                            </span>
                          ))}
                          {professor.qualifications.length > 2 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-muted text-muted-foreground">
                              +{professor.qualifications.length - 2} more
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs">No qualifications</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openViewDialog(professor)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(professor)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(professor)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                  {filteredProfessors.length === 0 ? "No professors found. Try a different search or add a new professor." : "No professors on this page."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium">{totalItems === 0 ? 0 : pageStartIndex + 1}</span>–
          <span className="font-medium">{pageEndIndex}</span> of <span className="font-medium">{totalItems}</span> professors
          {searchQuery ? (
            <span> (filtered from <span className="font-medium">{professors.length}</span>)</span>
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
            Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
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

      {isAddDialogOpen && (
        <ProfessorForm open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onSubmit={addProfessor} />
      )}

      {isEditDialogOpen && selectedProfessor && (
        <ProfessorForm
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSubmit={handleUpdateProfessor}
          initialData={{
            name: selectedProfessor.name,
            email: selectedProfessor.email || "",
            phone: selectedProfessor.phone || "",
            qualifications: selectedProfessor.qualifications || [],
          }}
        />
      )}

      {isViewDialogOpen && selectedProfessor && (
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="sm:max-w-[600px] bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Professor Details</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Name</h3>
                <p className="text-base">{selectedProfessor.name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Email</h3>
                <p className="text-base">{selectedProfessor.email || "N/A"}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Phone</h3>
                <p className="text-base">{selectedProfessor.phone || "N/A"}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Workload Status</h3>
                <p
                  className={getWorkloadStatusClass(
                    selectedProfessor.subjectCount || selectedProfessor.subject_count || 0
                  )}
                >
                  {getWorkloadStatusText(
                    selectedProfessor.subjectCount || selectedProfessor.subject_count || 0
                  )}
                </p>
              </div>

              <div className="col-span-2">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Qualifications</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedProfessor.qualifications?.length ? (
                    selectedProfessor.qualifications.map((q, i) => (
                      <span key={i} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-secondary text-secondary-foreground">
                        {q}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground">No qualifications listed</span>
                  )}
                </div>
              </div>

              <div className="col-span-2 mt-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">List of Subjects</h3>
                {selectedProfessor.subjects?.length ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject Name</TableHead>
                          <TableHead>Subject Code</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedProfessor.subjects.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell>{s.subj_name}</TableCell>
                            <TableCell>{s.subj_code || "N/A"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-muted-foreground py-2">No subjects assigned to this professor.</div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {isDeleteDialogOpen && selectedProfessor && (
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px] bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Confirm Deletion</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-base">
                Are you sure you want to delete professor <span className="font-semibold">{selectedProfessor.name}</span>?
              </p>
              <p className="text-sm text-muted-foreground mt-2">This action cannot be undone.</p>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteProfessor}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <SuccessMessage
        isOpen={isSuccessDialogOpen}
        onClose={() => setIsSuccessDialogOpen(false)}
        message={successMessage}
      />

      <CredentialsViewer
        open={isCredentialsDialogOpen}
        onOpenChange={setIsCredentialsDialogOpen}
        professors={professors}
      />
    </div>
  );
};

export default ProfessorManagement;
