import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { X, Plus, RefreshCw, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import SuccessMessage from "../popupmsg/SuccessMessage";
import ErrorMessage from "../popupmsg/ErrorMessage";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  username: z
    .string()
    .min(4, { message: "Username must be at least 4 characters" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
  email: z
    .string()
    .email({ message: "Please enter a valid email address" })
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .min(10, { message: "Please enter a valid phone number" })
    .optional()
    .or(z.literal("")),
  qualifications: z
    .array(z.string())
    .min(1, { message: "Add at least one qualification" }),
});

interface ProfessorFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit?: (data: z.infer<typeof formSchema>) => Promise<boolean>;
  initialData?: Partial<z.infer<typeof formSchema>>;
}

// Define an interface for the subject data from the database
interface Subject {
  id: number;
  name: string;
  value?: string; // Optional computed value for select component
}

const ProfessorForm = ({
  open = true,
  onOpenChange = () => {},
  onSubmit = () => Promise.resolve(true),
  initialData = {
    name: "",
    username: "",
    password: "",
    email: "",
    phone: "",
    qualifications: [],
  },
}: ProfessorFormProps) => {
  const [qualifications, setQualifications] = React.useState<string[]>(
    initialData.qualifications || []
  );
  const [newQualification, setNewQualification] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Track submission status
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Track if form dialog should close
  const [shouldCloseForm, setShouldCloseForm] = useState(false);
  // State for subjects from database
  const [subjects, setSubjects] = useState<Subject[]>([]);
  // State for loading subjects
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...initialData,
      qualifications: initialData.qualifications || [],
    },
  });

  const resetForm = () => {
    form.reset({
      name: "",
      username: "",
      password: "",
      email: "",
      phone: "",
      qualifications: [],
    });
    setQualifications([]);
    setNewQualification("");
    setShowPassword(false);
  };

  const generateUsername = () => {
    const name = form.getValues("name");
    if (!name || name.trim() === "") {
      const randomName = "user" + Math.floor(Math.random() * 10000);
      form.setValue("username", randomName);
      return;
    }

    const nameParts = name.toLowerCase().trim().split(" ");
    const generatedUsername =
      nameParts[0] +
      (nameParts.length > 1 ? nameParts[1].charAt(0) : "") +
      Math.floor(Math.random() * 1000);

    form.setValue("username", generatedUsername);
  };

  const generatePassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    form.setValue("password", password);
    setShowPassword(true);
  };

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);

      // Include qualifications from state
      const submissionData = {
        ...data,
        qualifications: qualifications,
      };

      // Set success message with the professor's name
      const actionText = initialData.name ? "updated" : "added";
      setSuccessMessage(`Professor ${data.name} ${actionText} successfully!`);

      // Submit to parent component and get result
      const result = await onSubmit(submissionData);

      if (result) {
        // Reset form
        resetForm();

        // Show success message
        setIsSuccessDialogOpen(true);

        // Set flag to close form after success dialog is dismissed
        setShouldCloseForm(true);
      } else {
        // If submission failed but no error was thrown
        setErrorMessage("Failed to save professor data. Please try again.");
        setIsErrorDialogOpen(true);
      }
    } catch (error) {
      console.error("Error submitting data:", error);
      setErrorMessage("An error occurred while submitting the form");
      setIsErrorDialogOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addQualification = () => {
    if (newQualification.trim() !== "") {
      const updatedQualifications = [...qualifications, newQualification];
      setQualifications(updatedQualifications);
      form.setValue("qualifications", updatedQualifications);
      setNewQualification("");
    }
  };

  const removeQualification = (index: number) => {
    const updatedQualifications = qualifications.filter((_, i) => i !== index);
    setQualifications(updatedQualifications);
    form.setValue("qualifications", updatedQualifications);
  };

  // Handle success dialog close
  const handleSuccessDialogClose = () => {
    setIsSuccessDialogOpen(false);

    // Close the form dialog if needed
    if (shouldCloseForm && onOpenChange) {
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {initialData.name ? "Edit Professor" : "Add New Professor"}
            </DialogTitle>
            <DialogDescription>
              {initialData.name
                ? "Update the professor information below."
                : "Fill in the details to create a new professor account."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => {
                      generateUsername();
                      generatePassword();
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Auto-generate Credentials
                  </Button>
                </div>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <div className="flex items-center space-x-2">
                        <FormControl>
                          <Input placeholder="johndoe" {...field} />
                        </FormControl>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={generateUsername}
                          title="Auto-generate username"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <div className="flex items-center space-x-2">
                        <div className="relative flex-1">
                          <FormControl>
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••"
                              {...field}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => setShowPassword(!showPassword)}
                            title={
                              showPassword ? "Hide password" : "Show password"
                            }
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={generatePassword}
                          title="Auto-generate password"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="john.doe@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="+(63) 923 456 7899" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="qualifications"
                  render={() => (
                    <FormItem>
                      <FormLabel>Specialization</FormLabel>
                      <div className="flex items-center space-x-2">
                        <Input
                          placeholder="Add Specialization"
                          value={newQualification}
                          onChange={(e) => setNewQualification(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addQualification();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={addQualification}
                          size="icon"
                          variant="outline"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormDescription>
                        Press Enter or click the plus icon to add a
                        qualification
                      </FormDescription>
                      <FormMessage />

                      <div className="mt-2 flex flex-wrap gap-2">
                        {qualifications.map((qualification, index) => (
                          <div
                            key={index}
                            className="flex items-center bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm"
                          >
                            {qualification}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 ml-1 p-0"
                              onClick={() => removeQualification(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? "Submitting..."
                    : initialData.name
                    ? "Update Professor"
                    : "Add Professor"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Success and Error Messages */}
      <SuccessMessage
        isOpen={isSuccessDialogOpen}
        onClose={handleSuccessDialogClose}
        message={successMessage}
      />

      <ErrorMessage
        isOpen={isErrorDialogOpen}
        onClose={() => setIsErrorDialogOpen(false)}
        message={errorMessage}
      />
    </>
  );
};

export default ProfessorForm;
