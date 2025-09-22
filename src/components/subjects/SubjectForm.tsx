import React, { useState, useEffect } from "react";
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
import SuccessMessage from "../popupmsg/SuccessMessage";
import ErrorMessage from "../popupmsg/ErrorMessage";

interface SubjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Omit<Subject, "id">) => void;
  initialData?: Omit<Subject, "id">;
}

interface Subject {
  id?: string;
  code: string;
  name: string;
  description?: string;
}

const SubjectForm: React.FC<SubjectFormProps> = ({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}) => {
  const [code, setCode] = useState<string>(initialData?.code || "");
  const [name, setName] = useState<string>(initialData?.name || "");
  const [description, setDescription] = useState<string>(
    initialData?.description || ""
  );

  // Success and Error message states (using your component prop names)
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isErrorOpen, setIsErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Reset form when initialData changes or dialog opens
  useEffect(() => {
    if (initialData) {
      setCode(initialData.code || "");
      setName(initialData.name || "");
      setDescription(initialData.description || "");
    } else if (open) {
      // Clear form when opening for a new subject
      setCode("");
      setName("");
      setDescription("");
    }
  }, [initialData, open]);

  const handleCloseSuccess = () => {
    setIsSuccessOpen(false);
  };

  const handleCloseError = () => {
    setIsErrorOpen(false);
  };

  const handleSubmit = () => {
    // Validate form fields
    if (!code.trim() || !name.trim()) {
      setErrorMessage("Subject code and name are required.");
      setIsErrorOpen(true);
      return;
    }

    try {
      onSubmit({ code, name, description });
      setSuccessMessage(
        initialData
          ? "Subject updated successfully!"
          : "Subject added successfully!"
      );
      setIsSuccessOpen(true);

      // Close the form dialog after successful submission
      setTimeout(() => {
        onOpenChange(false);
      }, 500);
    } catch (error) {
      setErrorMessage("Failed to save subject. Please try again.");
      setIsErrorOpen(true);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px] bg-white">
          <DialogHeader>
            <DialogTitle>
              {initialData ? "Edit Subject" : "Add New Subject"}
            </DialogTitle>
            <DialogDescription>
              {initialData
                ? "Update the subject information below."
                : "Fill in the details to create a new subject."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="code"
                className="block text-sm font-medium text-gray-700"
              >
                Code
              </label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter subject code"
              />
            </div>

            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700"
              >
                Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter subject name"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700"
              >
                Description
              </label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter subject description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleSubmit}>
              {initialData ? "Update Subject" : "Add Subject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Message Dialog */}
      <SuccessMessage
        isOpen={isSuccessOpen}
        onClose={handleCloseSuccess}
        message={successMessage}
      />

      {/* Error Message Dialog */}
      <ErrorMessage
        isOpen={isErrorOpen}
        onClose={handleCloseError}
        message={errorMessage}
      />
    </>
  );
};

export default SubjectForm;
