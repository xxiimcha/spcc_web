import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import SectionForm from "./SectionForm";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Room {
  id: number;
  number: number;
  type: string;
  capacity: number;
}

interface Section {
  section_id: number;
  section_name: string;
  grade_level: "11" | "12";
  number_of_students: number;
  strand: string;
  room?: {
    id: number;
    number: number;
    type: string;
    capacity: number;
  } | null;
}

interface SectionFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit?: () => void;
  editingSection?: Section | null;
  onSectionAdded: () => void;
  sections: Section[];
}

const SectionManagement: React.FC = () => {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGradeLevel, setSelectedGradeLevel] = useState("all");
  const [selectedStrand, setSelectedStrand] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<number | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);

  // Fetch sections
  const fetchSections = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        "http://localhost/spcc_database/sections.php"
      );

      if (response.data.success && Array.isArray(response.data.data)) {
        setSections(response.data.data);
        setError(null);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error("Error fetching sections:", err);
      setError("Failed to load sections. Please try again later.");
      setSections([]); // Set empty array on error
      toast({
        title: "Error",
        description: "Failed to load sections. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  // Filter sections based on search query and filters
  const filteredSections = React.useMemo(() => {
    if (!Array.isArray(sections)) return [];

    return sections.filter((section) => {
      const matchesSearch = section.section_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesGradeLevel =
        selectedGradeLevel === "all" ||
        section.grade_level === selectedGradeLevel;
      const matchesStrand =
        selectedStrand === "all" || section.strand === selectedStrand;

      return matchesSearch && matchesGradeLevel && matchesStrand;
    });
  }, [sections, searchQuery, selectedGradeLevel, selectedStrand]);

  // Get unique strands from sections
  const uniqueStrands = React.useMemo(() => {
    if (!Array.isArray(sections)) return [];
    const strands = Array.from(
      new Set(
        sections.map((section) => section.strand || "none").filter(Boolean)
      )
    );
    return strands.length > 0 ? strands : ["none"];
  }, [sections]);

  // Handle section deletion
  const handleDelete = async () => {
    if (!sectionToDelete) return;

    try {
      const response = await axios.delete(
        `http://localhost/spcc_database/sections.php?id=${sectionToDelete}`
      );

      if (response.data.success || response.data.status === "success") {
        setSections((prevSections) =>
          prevSections.filter(
            (section) => section.section_id !== sectionToDelete
          )
        );
        toast({
          title: "Success",
          description: "Section deleted successfully",
        });
      } else {
        throw new Error(response.data.message || "Failed to delete section");
      }
    } catch (err) {
      console.error("Error deleting section:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error
            ? err.message
            : "Failed to delete section. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setSectionToDelete(null);
    }
  };

  // Handle section edit
  const handleEdit = (section: Section) => {
    setEditingSection(section);
    setIsFormOpen(true);
  };

  // Handle section creation
  const handleCreate = () => {
    setEditingSection(null);
    setIsFormOpen(true);
  };

  // Handle section creation/update
  const handleSectionSubmit = async (updatedSection?: any) => {
    try {
      if (updatedSection) {
        setSections((prevSections) => {
          if (editingSection) {
            return prevSections.map((section) =>
              section.section_id === editingSection.section_id
                ? { ...section, ...updatedSection }
                : section
            );
          } else {
            return [...prevSections, updatedSection];
          }
        });
      } else {
        await fetchSections();
      }
    } catch (err) {
      console.error("Error refreshing sections:", err);
      toast({
        title: "Error",
        description: "Failed to refresh sections list. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsFormOpen(false);
      setEditingSection(null);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Section Management</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Section
        </Button>
      </div>

      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select
            value={selectedGradeLevel}
            onValueChange={setSelectedGradeLevel}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by Grade Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grade Levels</SelectItem>
              <SelectItem value="11">Grade 11</SelectItem>
              <SelectItem value="12">Grade 12</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStrand} onValueChange={setSelectedStrand}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Strand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Strands</SelectItem>
              {uniqueStrands.map((strand) => (
                <SelectItem key={strand} value={strand || "none"}>
                  {strand || "No Strand"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(selectedGradeLevel !== "all" || selectedStrand !== "all") && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedGradeLevel("all");
                setSelectedStrand("all");
              }}
            >
              Clear Filters
            </Button>
            <span className="text-sm text-muted-foreground">
              {filteredSections.length} section
              {filteredSections.length !== 1 ? "s" : ""} found
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <Card className="bg-destructive/10 border-destructive">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : filteredSections.length === 0 ? (
        <Card className="text-center p-8">
          <CardHeader>
            <CardTitle>No Sections Found</CardTitle>
            <CardDescription>
              {searchQuery || selectedGradeLevel || selectedStrand
                ? "No sections match your search criteria."
                : "There are no sections available. Create a new section to get started."}
            </CardDescription>
          </CardHeader>
          {!searchQuery && !selectedGradeLevel && !selectedStrand && (
            <CardFooter className="justify-center">
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create Section
              </Button>
            </CardFooter>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSections.map((section) => (
            <Card key={section.section_id}>
              <CardHeader>
                <CardTitle>{section.section_name}</CardTitle>
                <CardDescription>
                  Grade {section.grade_level}
                  {section.strand && ` - ${section.strand}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Students:</Label>
                    <span>{section.number_of_students}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(section)}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setSectionToDelete(section.section_id);
                    setIsDeleteDialogOpen(true);
                  }}
                >
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <SectionForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        editingSection={editingSection}
        onSectionAdded={fetchSections}
        sections={sections}
      />

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SectionManagement;
