import React, { useEffect, useMemo, useRef, useState } from "react";
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

const ABS_SUBJECTS_URL = "https://spcc-scheduler.site/subjects.php";
const ABS_PROFESSORS_URL = "https://spcc-scheduler.site/professors.php";

const MAX_SUBJECTS = 8;

const optionalNonEmpty = (schema: z.ZodTypeAny) =>
  z.union([schema, z.literal("").transform(() => undefined)]);

const phoneRegex = /^(?:\+?63|0)?(?:\d[\s-]?){9,12}\d$/;

const makeSchema = (isEdit: boolean) =>
  z.object({
    name: z.string().min(2, { message: "Name must be at least 2 characters" }),
    username: z
      .string()
      .min(4, { message: "Username must be at least 4 characters" })
      .regex(/^[a-z0-9._-]+$/, {
        message: "Use lowercase letters, numbers, dot, underscore, or dash",
      }),
    password: isEdit
      ? z
          .union([z.string().min(6), z.literal("")])
          .transform((v) => (v === "" ? undefined : v))
      : z.string().min(6, { message: "Password must be at least 6 characters" }),
    email: z
      .string()
      .trim()
      .min(1, { message: "Email is required" })
      .email({ message: "Please enter a valid email address" }),
    phone: optionalNonEmpty(
      z.string().regex(phoneRegex, { message: "Please enter a valid phone number" })
    ),
    qualifications: z
      .array(z.string())
      .min(1, { message: "Add at least one specialization" }),
    subject_ids: z
      .array(z.number())
      .nonempty({ message: "Assign at least one subject" }),
  });

interface ProfessorFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: () => void;
  initialData?: Partial<z.infer<ReturnType<typeof makeSchema>>> & { prof_id?: number };
}

interface Subject {
  id: number;
  code: string;
  name: string;
  description?: string;
  strand?: string;
  grade_level?: string | number;
}

const arraysEqualUnordered = (a: number[] = [], b: number[] = []) => {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
  return true;
};

const normalizeSubjectsResponse = (raw: any): Subject[] => {
  const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
  return list
    .map((s: any) => ({
      id: Number(s.subj_id ?? s.id ?? 0),
      code: String(s.subj_code ?? s.code ?? "").trim(),
      name: String(s.subj_name ?? s.name ?? "").trim(),
      description: (s.subj_description ?? s.description ?? "")?.toString()?.trim() || undefined,
      strand: (s.strand ?? s.track ?? s.strand_code ?? "")?.toString()?.trim() || undefined,
      grade_level: s.grade_level ?? s.grade ?? s.year_level,
    }))
    .filter((s: Subject) => s.id > 0 && (s.code || s.name));
};

const latinize = (str: string) =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const makeUsername = (name: string) => {
  const clean = latinize(name).replace(/[^a-z\s-]/g, " ").trim();
  if (!clean) return `user${Math.floor(Math.random() * 10000)}`;
  const parts = clean.split(/\s+/);
  const base = `${parts[0]}${parts[1]?.charAt(0) ?? ""}`;
  const suffix = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return (base || "user") + suffix;
};

const makePassword = (len = 12) => {
  const sets = ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz", "0123456789"];
  const required = sets.map((s) => s[Math.floor(Math.random() * s.length)]);
  const all = sets.join("");
  const remain = Array.from({ length: Math.max(0, len - required.length) }, () =>
    all[Math.floor(Math.random() * all.length)]
  );
  const raw = [...required, ...remain];
  for (let i = raw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [raw[i], raw[j]] = [raw[j], raw[i]];
  }
  return raw.join("");
};

const ProfessorForm = ({
  open = true,
  onOpenChange = () => {},
  onSaved,
  initialData = {
    name: "",
    username: "",
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

  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectFilterKey, setSubjectFilterKey] = useState<"all" | "code" | "name">("all");
  const [subjectStrandFilter, setSubjectStrandFilter] = useState<string>("ALL");

  const abortRef = useRef<AbortController | null>(null);

  const isEdit = Boolean((initialData as any).prof_id);
  const schema = useMemo(() => makeSchema(isEdit), [isEdit]);

  const form = useForm<z.infer<ReturnType<typeof makeSchema>>>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...initialData,
      password: "",
      qualifications: initialData.qualifications || [],
      subject_ids: (initialData.subject_ids as number[]) || [],
    },
    mode: "onSubmit",
  });

  // --- Helpers for max-cap logic ---
  const reachedMax = selectedSubjectIds.length >= MAX_SUBJECTS;
  const limitAdd = (current: number[], candidates: number[], max: number) => {
    const set = new Set(current);
    const out: number[] = [...current];
    for (const id of candidates) {
      if (out.length >= max) break;
      if (!set.has(id)) {
        set.add(id);
        out.push(id);
      }
    }
    return out;
  };

  const loadSubjects = async () => {
    try {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setSubjectsLoading(true);
      setSubjectsError(null);

      const res = await axios.get(ABS_SUBJECTS_URL, {
        timeout: 15000,
        signal: abortRef.current.signal as any,
      });

      const normalized = normalizeSubjectsResponse(res?.data);
      setSubjects(normalized);
    } catch (e: any) {
      if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
      console.error("Failed to load subjects:", e);
      setSubjects([]);
      setSubjectsError("Failed to load subjects");
    } finally {
      setSubjectsLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const incoming = ((initialData.subject_ids as number[]) || []).map(Number);
    if (!arraysEqualUnordered(incoming, selectedSubjectIds)) {
      // Respect the max cap if initial data tries to exceed it
      const capped = incoming.slice(0, MAX_SUBJECTS);
      setSelectedSubjectIds(capped);
      form.setValue("subject_ids", capped, { shouldValidate: true });
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
    setSubjectSearch("");
    setSubjectFilterKey("all");
    setSubjectStrandFilter("ALL");
  };

  const handleGenerateUsername = () => {
    const name = form.getValues("name");
    const candidate = name && name.trim() !== "" ? makeUsername(name) : makeUsername("");
    form.setValue("username", candidate, { shouldValidate: true, shouldDirty: true });
  };

  const handleGeneratePassword = () => {
    const pwd = makePassword(12);
    form.setValue("password", pwd, { shouldValidate: true, shouldDirty: true });
    setShowPassword(true);
  };

  const addQualification = () => {
    const q = newQualification.trim();
    if (!q) return;
    const next = Array.from(new Set([...qualifications, q]));
    setQualifications(next);
    form.setValue("qualifications", next, { shouldValidate: true });
    setNewQualification("");
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

    const ids = subjects.map((s) => Number(s.id));
    if (allSelected) {
      if (selectedSubjectIds.length === 0) return;
      setSelectedSubjectIds([]);
      form.setValue("subject_ids", [], { shouldValidate: true });
    } else {
      // Select up to MAX_SUBJECTS (respect already-selected)
      const next = limitAdd(selectedSubjectIds, ids, MAX_SUBJECTS);
      setSelectedSubjectIds(next);
      form.setValue("subject_ids", next, { shouldValidate: true });
    }
  };

  const toggleSubject = (id: number, checked: boolean) => {
    const nId = Number(id);
    if (checked) {
      if (selectedSubjectIds.includes(nId)) return;
      if (selectedSubjectIds.length >= MAX_SUBJECTS) return; // UI should disable, but guard too
      const next = [...selectedSubjectIds, nId];
      setSelectedSubjectIds(next);
      form.setValue("subject_ids", next, { shouldValidate: true });
    } else {
      const next = selectedSubjectIds.filter((x) => x !== nId);
      setSelectedSubjectIds(next);
      form.setValue("subject_ids", next, { shouldValidate: true });
    }
  };

  const isNoChange = useMemo(() => {
    const values = form.getValues();
    if (!isEdit) return false;
    const baseSame =
      (values.name || "") === (initialData.name || "") &&
      (values.username || "") === (initialData.username || "") &&
      (values.email || "") === (initialData.email || "") &&
      (values.phone || "") === (initialData.phone || "");
    const qualsSame =
      JSON.stringify((values.qualifications || []).map((s) => s.trim())) ===
      JSON.stringify((initialData.qualifications || []).map((s) => s.trim()));
    const subjectsSame = arraysEqualUnordered(
      (values.subject_ids || []).map(Number),
      ((initialData.subject_ids as number[]) || []).map(Number)
    );
    return baseSame && qualsSame && subjectsSame;
  }, [form.watch(), initialData, isEdit]);

  const availableStrands = useMemo(() => {
    const set = new Set<string>();
    subjects.forEach((s) => {
      const st = (s.strand || "").toString().trim();
      if (st) set.add(st.toUpperCase());
    });
    return Array.from(set).sort();
  }, [subjects]);

  const visibleSubjects = useMemo(() => {
    const q = subjectSearch.trim().toLowerCase();
    const filteredByQuery = !q
      ? subjects
      : subjects.filter((s) => {
          const code = (s.code || "").toLowerCase();
          const name = (s.name || "").toLowerCase();
          if (subjectFilterKey === "code") return code.includes(q);
          if (subjectFilterKey === "name") return name.includes(q);
          return code.includes(q) || name.includes(q);
        });

    if (subjectStrandFilter === "ALL") return filteredByQuery;
    return filteredByQuery.filter((s) => (s.strand || "").toUpperCase() === subjectStrandFilter);
  }, [subjects, subjectSearch, subjectFilterKey, subjectStrandFilter]);

  const handleSubmit = async (data: z.infer<ReturnType<typeof makeSchema>>) => {
    try {
      setIsSubmitting(true);

      // Safety net: block submit if > MAX
      if (selectedSubjectIds.length > MAX_SUBJECTS) {
        setErrorMessage(`You can assign a maximum of ${MAX_SUBJECTS} subjects.`);
        setIsErrorDialogOpen(true);
        setIsSubmitting(false);
        return;
      }

      const payload: any = {
        name: data.name.trim(),
        username: data.username.trim(),
        email: data.email.trim(),
        phone: data.phone || "",
        qualifications: qualifications.map((q) => q.trim()).filter(Boolean),
        subject_ids: selectedSubjectIds.map(Number),
      };

      if (!isEdit || (data.password && String(data.password).trim() !== "")) {
        payload.password = data.password as string;
      }

      let res;
      if (isEdit) {
        const url = `${ABS_PROFESSORS_URL}?id=${(initialData as any).prof_id}`;
        res = await axios.put(url, payload, { timeout: 20000 });
      } else {
        res = await axios.post(ABS_PROFESSORS_URL, payload, { timeout: 20000 });
      }

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
        const msg =
          res?.data?.message ||
          res?.data?.error ||
          "Failed to save professor data. Please try again.";
        setErrorMessage(msg);
        setIsErrorDialogOpen(true);
      }
    } catch (err: any) {
      console.error("❌ Submit error:", err?.response?.data || err?.message || err);
      const serverMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "An error occurred while submitting the form";
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

  const selectedCount = selectedSubjectIds.length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] bg-white">
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
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => {
                      handleGenerateUsername();
                      handleGeneratePassword();
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Auto-generate Credentials
                  </Button>
                </div>

                {/* Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Doe"
                          {...field}
                          onBlur={(e) => {
                            field.onBlur?.(e);
                            const uname = form.getValues("username");
                            if (!uname) handleGenerateUsername();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Username */}
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
                          onClick={handleGenerateUsername}
                          title="Auto-generate username"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Password */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Password{isEdit ? " (leave blank to keep current)" : ""}
                      </FormLabel>
                      <div className="flex items-center space-x-2">
                        <div className="relative flex-1">
                          <FormControl>
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••••••"
                              {...field}
                            />
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
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={handleGeneratePassword}
                          title="Auto-generate password"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="john.doe@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Phone */}
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="+63 923 456 7899" {...field} />
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
                          <div
                            key={`${q}-${i}`}
                            className="flex items-center bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm"
                          >
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
                      <span>
                        Assign Subjects{" "}
                        <span className="text-muted-foreground text-sm">
                          ({selectedCount} selected, max {MAX_SUBJECTS})
                        </span>
                      </span>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={toggleAllSubjects}
                          disabled={subjectsLoading || subjects.length === 0 || (reachedMax && !allSelected)}
                          title={reachedMax && !allSelected ? "Maximum reached" : "Select/Clear All"}
                        >
                          {allSelected ? "Clear All" : "Select All (up to 8)"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={subjectsLoading}
                          onClick={loadSubjects}
                          title="Reload subjects"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </FormLabel>

                    {/* Search + filters */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                      <div className="flex flex-wrap gap-2 items-center">
                        <Input
                          placeholder="Search subjects…"
                          value={subjectSearch}
                          onChange={(e) => setSubjectSearch(e.target.value)}
                          className="w-full sm:w-[260px]"
                        />
                        <select
                          className="border rounded-md px-2 py-2 text-sm"
                          value={subjectFilterKey}
                          onChange={(e) => setSubjectFilterKey(e.target.value as any)}
                          title="Filter field"
                        >
                          <option value="all">All fields</option>
                          <option value="code">Subject Code</option>
                          <option value="name">Subject Name</option>
                        </select>
                        <select
                          className="border rounded-md px-2 py-2 text-sm"
                          value={subjectStrandFilter}
                          onChange={(e) => setSubjectStrandFilter(e.target.value)}
                          title="Filter by Strand"
                        >
                          <option value="ALL">All Strands</option>
                          {availableStrands.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        {(subjectSearch || subjectStrandFilter !== "ALL") && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSubjectSearch("");
                              setSubjectStrandFilter("ALL");
                            }}
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {subjectsLoading
                          ? "Loading…"
                          : `${visibleSubjects.length} / ${subjects.length} subjects`}
                      </div>
                    </div>

                    {reachedMax && (
                      <div className="text-xs text-amber-600 mb-1">
                        Maximum of {MAX_SUBJECTS} subjects reached. Unselect one to choose another.
                      </div>
                    )}

                    <div className="border rounded-lg p-3 max-h-64 overflow-auto bg-white">
                      {subjectsLoading ? (
                        <p className="text-sm text-muted-foreground">Loading subjects…</p>
                      ) : subjectsError ? (
                        <p className="text-sm text-destructive">{subjectsError}</p>
                      ) : visibleSubjects.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No subjects match your filters.</p>
                      ) : (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {visibleSubjects.map((s) => {
                            const checked = selectedSubjectIds.includes(s.id);
                            // Disable if we've reached max and this item is not already checked
                            const disableThis = !checked && reachedMax;
                            return (
                              <li key={s.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`subj-${s.id}`}
                                  checked={checked}
                                  disabled={disableThis}
                                  onCheckedChange={(val) => toggleSubject(s.id, Boolean(val))}
                                />
                                <label
                                  htmlFor={`subj-${s.id}`}
                                  className={`text-sm leading-none select-none ${
                                    disableThis ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                                  }`}
                                  title={disableThis ? "Maximum selected" : ""}
                                >
                                  <span className="font-medium">{s.code || "SUBJ"}</span> - {s.name}
                                  {s.strand ? (
                                    <span className="text-xs text-muted-foreground"> ({s.strand.toUpperCase()})</span>
                                  ) : null}
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
                <Button type="submit" disabled={isSubmitting || isNoChange}>
                  {isSubmitting
                    ? "Submitting…"
                    : (initialData as any).prof_id
                    ? isNoChange
                      ? "No changes"
                      : "Update Professor"
                    : "Add Professor"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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
