import React, { useState, useEffect } from "react";
import { Search, Plus, Edit, Trash2, Eye, KeyRound } from "lucide-react";
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
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import ProfessorForm from "./ProfessorForm";
import CredentialsViewer from "./CredentialsViewer";
import SuccessMessage from "../popupmsg/SuccessMessage";

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
  const [selectedProfessor, setSelectedProfessor] = useState<Professor | null>(
    null
  );
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchProfessors();
  }, []);

  const fetchProfessors = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getProfessors();
      console.log("Fetched professors:", response);

      if (response.success && Array.isArray(response.data)) {
        // Map backend data structure to frontend expected structure
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
        setProfessors([]); // Set to empty array if no valid data
        if (!response.success) {
          throw new Error(response.message || "Failed to fetch professors");
        }
      }
    } catch (err) {
      console.error("Error fetching professors:", err);
      setError("Failed to load professors. Please try again later.");
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof Error
            ? err.message
            : "Could not fetch professors from the server.",
      });
    } finally {
      setLoading(false);
    }
  };

  const addProfessor = async (professorData: Omit<Professor, "id">) => {
    try {
      const response = await fetch(
        "http://localhost/spcc_database/professors.php",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(professorData),
        }
      );

      const result = await response.json();

      if (result.status === "error") {
        throw new Error(result.message || "Failed to add professor");
      }

      // Handle different API response formats
      if (result.data && result.data.id) {
        setProfessors((prevProfessors) => [...prevProfessors, result.data]);
      } else if (result.professor && result.professor.id) {
        setProfessors((prevProfessors) => [
          ...prevProfessors,
          result.professor,
        ]);
      } else {
        fetchProfessors(); // Refetch all professors if we can't extract the new one
      }

      setSuccessMessage(`Professor ${professorData.name} added successfully!`);
      setIsSuccessDialogOpen(true);
      setIsAddDialogOpen(false);

      return true;
    } catch (err) {
      console.error("Error adding professor:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to add professor: ${errorMessage}`,
      });
      return false;
    }
  };

  const updateProfessor = async (
    id: string,
    professorData: Omit<Professor, "id">
  ) => {
    try {
      const response = await fetch(
        `http://localhost/spcc_database/professors.php?id=${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(professorData),
        }
      );

      const result = await response.json();

      if (result.status === "error") {
        throw new Error(result.message || "Failed to update professor");
      }

      setProfessors((prevProfessors) =>
        prevProfessors.map((prof) =>
          prof.id === id ? { ...professorData, id } : prof
        )
      );

      setIsEditDialogOpen(false);
      setSuccessMessage(
        `Professor ${professorData.name} updated successfully!`
      );
      setIsSuccessDialogOpen(true);

      return true;
    } catch (err) {
      console.error("Error updating professor:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof Error
            ? err.message
            : "Failed to update professor. Please try again.",
      });
      return false;
    }
  };

  const deleteProfessor = async (id: string) => {
    try {
      const response = await fetch(
        `http://localhost/spcc_database/professors.php?id=${id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (result.status === "error") {
        throw new Error(result.message || "Failed to delete professor");
      }

      setProfessors((prevProfessors) =>
        prevProfessors.filter((prof) => prof.id !== id)
      );

      setIsDeleteDialogOpen(false);
      const professorName = selectedProfessor?.name || "Professor";
      setSuccessMessage(`${professorName} deleted successfully!`);
      setIsSuccessDialogOpen(true);

      return true;
    } catch (err) {
      console.error("Error deleting professor:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof Error
            ? err.message
            : "Failed to delete professor. Please try again.",
      });
      return false;
    }
  };

  const fetchProfessorSubjects = async (professorId: string) => {
    try {
      const response = await fetch(
        `http://localhost/spcc_database/get_list_of_subjects.php?professor_id=${professorId}`
      );
      const data = await response.json();

      console.log("Fetched professor subjects:", data);

      if (data && data.status === "success" && data.subjects) {
        // Update the selected professor with subjects data
        setSelectedProfessor((prevProfessor) => {
          if (prevProfessor && prevProfessor.id === professorId) {
            return {
              ...prevProfessor,
              subjects: data.subjects.map((subj: any) => ({
                id: subj.subj_id,
                subj_name: subj.subj_name,
                subj_code: subj.subj_code,
              })),
            };
          }
          return prevProfessor;
        });
      } else {
        // If no subjects or error in response, set empty subjects array
        setSelectedProfessor((prevProfessor) => {
          if (prevProfessor && prevProfessor.id === professorId) {
            return { ...prevProfessor, subjects: [] };
          }
          return prevProfessor;
        });
      }
    } catch (err) {
      console.error("Error fetching professor subjects:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof Error
            ? err.message
            : "Could not fetch subjects for this professor.",
      });

      // Even on error, update with empty subjects array to avoid undefined
      setSelectedProfessor((prevProfessor) => {
        if (prevProfessor && prevProfessor.id === professorId) {
          return { ...prevProfessor, subjects: [] };
        }
        return prevProfessor;
      });
    }
  };

  const filteredProfessors = professors.filter(
    (professor) =>
      professor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      professor.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddProfessor = async (data: Omit<Professor, "id">) => {
    return await addProfessor(data);
  };

  const handleUpdateProfessor = async (data: Omit<Professor, "id">) => {
    if (selectedProfessor) {
      const success = await updateProfessor(selectedProfessor.id ?? "", data);
      return success;
    }
    return false;
  };

  const handleDeleteProfessor = async () => {
    if (selectedProfessor) {
      await deleteProfessor(selectedProfessor.id ?? "");
    }
  };

  const openEditDialog = (professor: Professor) => {
    setSelectedProfessor(professor);
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (professor: Professor) => {
    setSelectedProfessor(professor);
    setIsViewDialogOpen(true);
    // Fetch subjects when opening view dialog
    if (professor.id) {
      fetchProfessorSubjects(professor.id);
    }
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Professor Management</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsCredentialsDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <KeyRound className="h-4 w-4" /> View Credentials
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Professor
          </Button>
        </div>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search professors by name or email..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
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
            {filteredProfessors.length > 0 ? (
              filteredProfessors.map((professor) => (
                <TableRow key={professor.id}>
                  <TableCell className="font-medium">
                    {professor.name}
                  </TableCell>
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
                      {professor.qualifications &&
                      professor.qualifications.length > 0 ? (
                        <>
                          {professor.qualifications
                            .slice(0, 2)
                            .map((qual, index) => (
                              <span
                                key={index}
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
                        <span className="text-muted-foreground text-xs">
                          No qualifications
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openViewDialog(professor)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(professor)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(professor)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-6 text-muted-foreground"
                >
                  No professors found. Try a different search or add a new
                  professor.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Professor Dialog */}
      {isAddDialogOpen && (
        <ProfessorForm
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onSubmit={handleAddProfessor}
        />
      )}

      {/* Edit Professor Dialog */}
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

      {/* View Professor Dialog */}
      {isViewDialogOpen && selectedProfessor && (
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="sm:max-w-[600px] bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                Professor Details
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Name
                </h3>
                <p className="text-base">{selectedProfessor.name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Email
                </h3>
                <p className="text-base">{selectedProfessor.email || "N/A"}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Phone
                </h3>
                <p className="text-base">{selectedProfessor.phone || "N/A"}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Workload Status
                </h3>
                <p
                  className={getWorkloadStatusClass(
                    selectedProfessor.subjectCount ||
                      selectedProfessor.subject_count ||
                      0
                  )}
                >
                  {getWorkloadStatusText(
                    selectedProfessor.subjectCount ||
                      selectedProfessor.subject_count ||
                      0
                  )}
                </p>
              </div>

              <div className="col-span-2">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Qualifications
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedProfessor.qualifications &&
                  selectedProfessor.qualifications.length > 0 ? (
                    selectedProfessor.qualifications.map(
                      (qualification, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-secondary text-secondary-foreground"
                        >
                          {qualification}
                        </span>
                      )
                    )
                  ) : (
                    <span className="text-muted-foreground">
                      No qualifications listed
                    </span>
                  )}
                </div>
              </div>

              <div className="col-span-2 mt-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  List of Subjects
                </h3>
                {selectedProfessor.subjects &&
                selectedProfessor.subjects.length > 0 ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject Name</TableHead>
                          <TableHead>Subject Code</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedProfessor.subjects.map((subject) => (
                          <TableRow key={subject.id}>
                            <TableCell>{subject.subj_name}</TableCell>
                            <TableCell>{subject.subj_code || "N/A"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-muted-foreground py-2">
                    No subjects assigned to this professor.
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {isDeleteDialogOpen && selectedProfessor && (
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px] bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                Confirm Deletion
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-base">
                Are you sure you want to delete professor{" "}
                <span className="font-semibold">{selectedProfessor.name}</span>?
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteProfessor}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Success Message Dialog */}
      <SuccessMessage
        isOpen={isSuccessDialogOpen}
        onClose={() => setIsSuccessDialogOpen(false)}
        message={successMessage}
      />

      {/* Credentials Viewer Dialog */}
      <CredentialsViewer
        open={isCredentialsDialogOpen}
        onOpenChange={setIsCredentialsDialogOpen}
        professors={professors}
      />
    </div>
  );
};

export default ProfessorManagement;
