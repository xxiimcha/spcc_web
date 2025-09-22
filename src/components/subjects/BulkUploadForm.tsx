import React, { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => Promise<void> | void;
  isUploading?: boolean;
  title?: string;
  description?: string;
};

const ACCEPT =
  ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

const MAX_PREVIEW_ROWS = 10;

const BulkUploadForm: React.FC<Props> = ({
  open,
  onOpenChange,
  onUpload,
  isUploading = false,
  title = "Bulk Upload Subjects",
  description = "Upload an Excel file (.xlsx or .xls) with your subjects. We’ll validate and import them.",
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [sheetName, setSheetName] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);

  // progress animation state
  const [progress, setProgress] = useState(0); // 0..100
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const durationRef = useRef<number>(1500); // dynamically set after parsing

  const resetState = () => {
    setFile(null);
    setError("");
    setSheetName("");
    setColumns([]);
    setRows([]);
    setTotalRows(0);
    stopAnimation(true);
  };

  const validate = (f: File | null) => {
    if (!f) {
      setError("Please choose an Excel file (.xlsx or .xls).");
      return false;
    }
    const ext = f.name.toLowerCase().split(".").pop();
    if (!["xlsx", "xls"].includes(ext || "")) {
      setError("Only Excel files (.xlsx, .xls) are allowed.");
      return false;
    }
    return true;
  };

  const parsePreview = async (f: File) => {
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const firstSheet = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheet];
      if (!ws) {
        setError("No worksheet found in the file.");
        setSheetName("");
        setColumns([]);
        setRows([]);
        setTotalRows(0);
        return;
      }
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      setSheetName(firstSheet);

      setTotalRows(json.length);
      if (json.length === 0) {
        setColumns([]);
        setRows([]);
        return;
      }

      const cols = Object.keys(json[0]);
      setColumns(cols);
      setRows(json.slice(0, MAX_PREVIEW_ROWS));

      // configure animation duration based on row count (1s..8s)
      const est = Math.min(8000, Math.max(1000, json.length * 60)); // ~60ms per row
      durationRef.current = est;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read the Excel file.");
      setColumns([]);
      setRows([]);
      setTotalRows(0);
    }
  };

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    setError("");
    const f = e.target.files?.[0] ?? null;
    setFile(f ?? null);
    setColumns([]);
    setRows([]);
    setSheetName("");
    setTotalRows(0);
    stopAnimation(true);

    if (f && validate(f)) {
      await parsePreview(f);
    }
  };

  // ---- Progress animation helpers ----
  const tick = (t: number) => {
    if (startRef.current == null) startRef.current = t;
    const elapsed = t - startRef.current;
    const dur = durationRef.current;
    // Cap at 99% until parent signals done
    const pct = Math.min(99, Math.floor((elapsed / dur) * 100));
    setProgress(pct);
    if (pct < 99 && isUploading) {
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  const startAnimation = () => {
    setProgress(0);
    startRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  const stopAnimation = (reset: boolean) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    startRef.current = null;
    if (reset) setProgress(0);
  };

  // Smoothly finish to 100%, then clear UI & optionally close.
  const finishAndClear = () => {
    setProgress(100);
    // brief pause so the user sees "100%"
    const id = setTimeout(() => {
      stopAnimation(true);
      resetState();
      onOpenChange(false); // remove this line if you prefer to keep the dialog open
    }, 300);
    return () => clearTimeout(id);
  };

  const handleSubmit = async () => {
    if (!validate(file)) return;

    startAnimation();
    try {
      await onUpload(file!); // parent does API call; throw = failure
      finishAndClear();      // success: show 100%, clear, close
    } catch (err) {
      // failure: stop anim but keep current UI so user can retry
      stopAnimation(false);
    }
  };

  // When uploading finishes externally (parent toggles isUploading),
  // ensure the bar completes to 100 even if we didn't call finishAndClear.
  useEffect(() => {
    if (isUploading) {
      if (!rafRef.current) startAnimation();
    } else if (progress > 0 && progress < 100) {
      setProgress(100);
      const id = setTimeout(() => stopAnimation(false), 300);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUploading]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetState();
        onOpenChange(o);
      }}
    >
      <DialogContent className="bg-white w-[min(92vw,900px)] sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input type="file" accept={ACCEPT} onChange={onFileChange} />
          {file && (
            <div className="text-sm text-gray-700">
              Selected: <span className="font-medium">{file.name}</span>
              {sheetName ? (
                <span className="text-gray-500"> • Sheet: {sheetName}</span>
              ) : null}
              {totalRows > 0 ? (
                <span className="text-gray-500"> • {totalRows} row{totalRows > 1 ? "s" : ""}</span>
              ) : null}
            </div>
          )}
          {!!error && <div className="text-sm text-red-600">{error}</div>}

          {/* Upload progress */}
          {(isUploading || progress > 0) && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>
                  Uploading{totalRows ? ` ${totalRows} row${totalRows > 1 ? "s" : ""}` : ""}...
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full rounded bg-gray-200 overflow-hidden">
                <div
                  className="h-2 bg-blue-600 transition-[width] duration-150 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && (
            <div className="mt-2 border rounded-md overflow-x-auto max-h-80">
              <Table className="table-fixed min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    {columns.map((c) => (
                      <TableHead
                        key={c}
                        className={
                          c.toLowerCase() === "code"
                            ? "w-[120px]"
                            : c.toLowerCase() === "name"
                            ? "w-[280px]"
                            : c.toLowerCase() === "description"
                            ? "w-[380px]"
                            : "w-[200px]"
                        }
                      >
                        {c}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, idx) => (
                    <TableRow key={idx}>
                      {columns.map((c) => (
                        <TableCell
                          key={c}
                          className="whitespace-normal break-words align-top text-sm"
                        >
                          {String(r[c] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {rows.length > 0 && (
            <div className="text-xs text-gray-600">
              Previewing first {Math.min(rows.length, MAX_PREVIEW_ROWS)} row
              {rows.length > 1 ? "s" : ""}. Expected columns: <code>code</code>,{" "}
              <code>name</code>, <code>description</code>.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isUploading || !file}>
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkUploadForm;
