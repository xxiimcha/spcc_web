import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertTriangle, Plus } from "lucide-react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import SuccessMessage from "@/components/popupmsg/SuccessMessage";

const formSchema = z.object({
  section_name: z
    .string({ required_error: "Please enter section name" })
    .min(1, "Section name is required")
    .max(50, "Section name must be less than 50 characters")
    .regex(/^[A-Za-z0-9\s-]+$/, "Only letters, numbers, spaces, and hyphens"),
  grade_level: z.enum(["11", "12"], {
    required_error: "Please select a grade level",
  }),
  number_of_students: z
    .string()
    .refine((val) => {
      const num = parseInt(val);
      return !isNaN(num) && num >= 0;
    }, "Number of students must be a non-negative number"),
  strand: z
    .string({ required_error: "Please select a strand" })
    .max(10, "Strand must be less than 10 characters"),
});

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
  onSectionAdded: () => void;
  sections: Section[];
  editingSection?: Section | null;
}

interface Room {
  id: number;
  number: number;
  type: string;
  capacity: number;
}

const SectionForm: React.FC<SectionFormProps> = ({
  open = false,
  onOpenChange,
  onSectionAdded,
  sections,
  editingSection,
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      section_name: "",
      grade_level: "11",
      number_of_students: "",
      strand: "",
    },
  });

  useEffect(() => {
    const values = editingSection
      ? {
          section_name: editingSection.section_name ?? "",
          grade_level: editingSection.grade_level ?? "11",
          number_of_students:
            editingSection.number_of_students != null
              ? String(editingSection.number_of_students)
              : "",
          strand: editingSection.strand ?? "",
        }
      : {
          section_name: "",
          grade_level: "11",
          number_of_students: "",
          strand: "",
        };

    if (open) {
      form.reset(values);
    }
  }, [editingSection, open, form]);

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    setError(null);

    try {
      const isDuplicate = sections.some(
        (section) =>
          section.section_name.toLowerCase() ===
            values.section_name.toLowerCase() &&
          (!editingSection || section.section_id !== editingSection.section_id)
      );
      if (isDuplicate) {
        setError("A section with this name already exists");
        return;
      }

      const sectionData = { ...values };
      let response;

      if (editingSection) {
        response = await axios.put(
          `http://localhost/spcc_database/sections.php?id=${editingSection.section_id}`,
          sectionData
        );
      } else {
        response = await axios.post(
          "http://localhost/spcc_database/sections.php",
          sectionData
        );
      }

      if (
        response?.data?.success ||
        response?.data?.status === "success" ||
        response?.data?.message?.toString()?.toLowerCase()?.includes("success") ||
        response?.status === 200 ||
        response?.status === 201
      ) {
        setSuccessMessage(
          `Section ${editingSection ? "updated" : "created"} successfully`
        );
        setShowSuccess(true);
        onSectionAdded?.();
        onOpenChange?.(false);
      } else {
        // If the backend is inconsistent, treat 2xx as success
        if (response?.status && response.status >= 200 && response.status < 300) {
          setSuccessMessage(
            `Section ${editingSection ? "updated" : "created"} successfully`
          );
          setShowSuccess(true);
          onSectionAdded?.();
          onOpenChange?.(false);
        } else {
          throw new Error(
            response?.data?.message || "Failed to save the section"
          );
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error saving section";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[425px]"
          // ✅ forces a fresh mount per record; great when fields get “sticky”
          key={editingSection ? editingSection.section_id : "new"}
        >
          <DialogHeader>
            <DialogTitle>
              {editingSection ? "Edit Section" : "Add New Section"}
            </DialogTitle>
            <DialogDescription>
              {editingSection
                ? "Update the section information below."
                : "Fill in the details to create a new section."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="section_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter section name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="grade_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select grade level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="11">Grade 11</SelectItem>
                        <SelectItem value="12">Grade 12</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="strand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Strand</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select strand" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="STEM">STEM</SelectItem>
                        <SelectItem value="HUMSS">HUMSS</SelectItem>
                        <SelectItem value="GAS">GAS</SelectItem>
                        <SelectItem value="ABM">ABM</SelectItem>
                        <SelectItem value="TVL">TVL</SelectItem>
                        <SelectItem value="ICT">ICT</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="number_of_students"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Students</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter number of students"
                        // keep it as string for the schema; coerce on submit if needed
                        {...field}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange?.(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading
                    ? "Saving..."
                    : editingSection
                    ? "Save Changes"
                    : "Create Section"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <SuccessMessage
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        message={successMessage}
      />
    </>
  );
};

export default SectionForm;
