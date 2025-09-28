import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { X, Plus, RefreshCw, Eye, EyeOff } from "lucide-react";
import SuccessMessage from "../popupmsg/SuccessMessage";
import ErrorMessage from "../popupmsg/ErrorMessage";
import {
  Form,
  FormControl,
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
import { Checkbox } from "@/components/ui/checkbox";
import axios from "axios";

/** Absolute backend endpoints */
const ABS_SUBJECTS_URL = "http://localhost/spcc_database/subjects.php";
const ABS_PROFESSORS_URL = "http://localhost/spcc_database/professors.php";

/** Zod schema */
const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  username: z.string().min(4, { message: "Username must be at least 4 characters" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }).optional().or(z.literal("")),
  phone: z.string().min(10, { message: "Please enter a valid phone number" }).optional().or(z.literal("")),
  qualifications: z.array(z.string()).min(1, { message: "Add at least one qualification" }),
  subject_ids: z.array(z.number()).nonempty({ message: "Assign at least one subject" }),
});

interface ProfessorFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional: if provided, we'll call this after the network write succeeds */
  onSaved?: () => void;
  /** For edit mode, pass existing values + optional prof_id */
  initialData?: Partial<z.infer<typeof formSchema>> & { prof_id?: number };
}

interface Subject {
  id: number;
  code: string;
  name: string;
  description?: string;
}

const arraysEqual = (a: number[] = [], b: number[] = []) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

const normalizeSubjectsResponse = (raw: any): Subject[] => {
  const list = Array.isArray(raw?.data) ? raw.data : [];
  return list.map((s: any) => ({
    id: Number(s.subj_id ?? s.id ?? 0),
    code: String(s.subj_code ?? s.code ?? "").trim(),
    name: String(s.subj_name ?? s.name ?? "").trim(),
    description: String(s.subj_description ?? s.description ?? "").trim(),
  }));
};

const ProfessorForm = ({
  open = true,
  onOpenChange = () => {},
  onSaved,
  initialData = {
    name: "",
    username: "",
    password: "",
    email: "",
    phone: "",
    qualifications: [],
    subject_ids: [],
  },
}: ProfessorFormProps) => {
  const [qualifications, setQualifications] = useState<string[]>(initialData.qualifications || []);
  const [newQualification, setNewQualification] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shouldCloseForm, setShouldCloseForm] = useState(false);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>(
    (initialData.subject_ids as number[]) || []
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...initialData,
      qualifications: initialData.qualifications || [],
      subject_ids: (initialData.subject_ids as number[]) || [],
    },
    mode: "onSubmit",
  });

  /** Load subjects */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setSubjectsLoading(true);
        setSubjectsError(null);
        const { data } = await axios.get(ABS_SUBJECTS_URL, { timeout: 15000 });
        if (!mounted) return;
        const normalized = normalizeSubjectsResponse(Array.isArray(data) ? { data } : data);
        setSubjects(normalized);
      } catch (e) {
        if (!mounted) return;
        console.error("Failed to load subjects:", e);
        setSubjectsError("Failed to load subjects");
        setSubjects([]);
      } finally {
        if (mounted) setSubjectsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /** Keep subject_ids in sync when editing */
  useEffect(() => {
    const incoming = (initialData.subject_ids as number[]) || [];
    if (!arraysEqual(incoming, selectedSubjectIds)) {
      setSelectedSubjectIds(incoming);
      form.setValue("subject_ids", incoming, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialData.subject_ids)]);

  const resetForm = () => {
    form.reset({
      name: "",
      username: "",
      password: "",
      email: "",
      phone: "",
      qualifications: [],
      subject_ids: [],
    });
    setQualifications([]);
    setNewQualification("");
    setShowPassword(false);
    setSelectedSubjectIds([]);
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
      nameParts[0] + (nameParts.length > 1 ? nameParts[1].charAt(0) : "") + Math.floor(Math.random() * 1000);
    form.setValue("username", generatedUsername);
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    form.setValue("password", password);
    setShowPassword(true);
  };

  const addQualification = () => {
    if (newQualification.trim() !== "") {
      const updated = [...qualifications, newQualification.trim()];
      setQualifications(updated);
      form.setValue("qualifications", updated, { shouldValidate: true });
      setNewQualification("");
    }
  };

  const removeQualification = (index: number) => {
    const updated = qualifications.filter((_, i) => i !== index);
    setQualifications(updated);
    form.setValue("qualifications", updated, { shouldValidate: true });
  };

  const allSelected = useMemo(
    () => subjects.length > 0 && selectedSubjectIds.length === subjects.length,
    [subjects.length, selectedSubjectIds.length]
  );

  const toggleAllSubjects = () => {
    if (subjects.length === 0) return;
    const ids = subjects.map((s) => s.id);
    if (allSelected) {
      if (selectedSubjectIds.length === 0) return;
      setSelectedSubjectIds([]);
      form.setValue("subject_ids", [], { shouldValidate: true });
    } else {
      if (arraysEqual(selectedSubjectIds, ids)) return;
      setSelectedSubjectIds(ids);
      form.setValue("subject_ids", ids, { shouldValidate: true });
    }
  };

  const toggleSubject = (id: number, checked: boolean) => {
    const next = checked ? Array.from(new Set([...selectedSubjectIds, id])) : selectedSubjectIds.filter((x) => x !== id);
    setSelectedSubjectIds(next);
    form.setValue("subject_ids", next, { shouldValidate: true });
  };

  /** Create/Update submit wired to PHP directly */
  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);

      const payload = {
        name: data.name,
        username: data.username,
        password: data.password,
        email: data.email || "",
        phone: data.phone || "",
        qualifications: qualifications,      // string[]
        subject_ids: selectedSubjectIds,     // number[]
      };

      const isEdit = Boolean(initialData.prof_id);
      let res;
      if (isEdit) {
        // PUT /professors.php?id={prof_id}
        const url = `${ABS_PROFESSORS_URL}?id=${initialData.prof_id}`;
        console.log("➡️ Updating professor:", url, payload);
        res = await axios.put(url, payload, { timeout: 20000 });
      } else {
        // POST /professors.php
        console.log("➡️ Creating professor:", ABS_PROFESSORS_URL, payload);
        res = await axios.post(ABS_PROFESSORS_URL, payload, { timeout: 20000 });
      }

      console.log("✅ Server response:", res?.status, res?.data);

      const ok =
        res?.data?.status === "success" ||
        res?.data?.success === true ||
        (typeof res?.status === "number" && res.status >= 200 && res.status < 300);

      if (ok) {
        const actionText = isEdit ? "updated" : "added";
        setSuccessMessage(`Professor ${data.name} ${actionText} successfully!`);
        setIsSuccessDialogOpen(true);
        setShouldCloseForm(true);
        resetForm();
        onSaved?.();
      } else {
        const msg = res?.data?.message || "Failed to save professor data. Please try again.";
        setErrorMessage(msg);
        setIsErrorDialogOpen(true);
      }
    } catch (err: any) {
      console.error("❌ Submit error:", err?.response?.data || err?.message || err);
      const serverMsg = err?.response?.data?.message || err?.message || "An error occurred while submitting the form";
      setErrorMessage(serverMsg);
      setIsErrorDialogOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessDialogClose = () => {
    setIsSuccessDialogOpen(false);
    if (shouldCloseForm && onOpenChange) onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[720px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {initialData.name ? "Edit Professor" : "Add New Professor"}
            </DialogTitle>
            <DialogDescription>
              {initialData.name ? "Update the professor information below." : "Fill in the details to create a new professor account."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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
                        <Button type="button" size="icon" variant="outline" onClick={generateUsername} title="Auto-generate username">
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
                            <Input type={showPassword ? "text" : "password"} placeholder="••••••" {...field} />
                          </FormControl>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => setShowPassword(!showPassword)}
                            title={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <Button type="button" size="icon" variant="outline" onClick={generatePassword} title="Auto-generate password">
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

              {/* Qualifications */}
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
                        <Button type="button" onClick={addQualification} size="icon" variant="outline">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {qualifications.map((q, i) => (
                          <div key={`${q}-${i}`} className="flex items-center bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm">
                            {q}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 ml-1 p-0"
                              onClick={() => removeQualification(i)}
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

              {/* Subject assignment */}
              <FormField
                control={form.control}
                name="subject_ids"
                render={() => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between">
                      <span>Assign Subjects</span>
                      <div className="flex items-center gap-3">
                        <Button type="button" size="sm" variant="outline" onClick={toggleAllSubjects} disabled={subjectsLoading}>
                          {allSelected ? "Clear All" : "Select All"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={subjectsLoading}
                          onClick={async () => {
                            try {
                              setSubjectsLoading(true);
                              const { data } = await axios.get(ABS_SUBJECTS_URL, { timeout: 15000 });
                              const normalized = normalizeSubjectsResponse(Array.isArray(data) ? { data } : data);
                              setSubjects(normalized);
                              setSubjectsError(null);
                            } catch (e) {
                              console.error("Failed to reload subjects:", e);
                              setSubjectsError("Failed to reload subjects");
                            } finally {
                              setSubjectsLoading(false);
                            }
                          }}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </FormLabel>

                    <div className="border rounded-lg p-3 max-h-56 overflow-auto">
                      {subjectsLoading ? (
                        <p className="text-sm text-muted-foreground">Loading subjects…</p>
                      ) : subjectsError ? (
                        <p className="text-sm text-destructive">{subjectsError}</p>
                      ) : subjects.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No subjects found.</p>
                      ) : (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {subjects.map((s) => {
                            const checked = selectedSubjectIds.includes(s.id);
                            return (
                              <li key={s.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`subj-${s.id}`}
                                  checked={checked}
                                  onCheckedChange={(val) => toggleSubject(s.id, Boolean(val))}
                                />
                                <label htmlFor={`subj-${s.id}`} className="text-sm leading-none cursor-pointer select-none">
                                  <span className="font-medium">{s.code || "SUBJ"}</span> - {s.name}
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting…" : initialData.prof_id ? "Update Professor" : "Add Professor"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <SuccessMessage isOpen={isSuccessDialogOpen} onClose={handleSuccessDialogClose} message={successMessage} />
      <ErrorMessage isOpen={isErrorDialogOpen} onClose={() => setIsErrorDialogOpen(false)} message={errorMessage} />
    </>
  );
};

export default ProfessorForm;
