import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "axios";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

const formSchema = z.object({
  number: z.string().min(1).refine(v => !isNaN(+v) && +v > 0, { message: "Room number must be a positive number" }),
  type: z.enum(["Lecture", "Laboratory"]),
  capacity: z.string().min(1).refine(v => !isNaN(+v) && +v > 0, { message: "Capacity must be a positive number" }),
  section_id: z.string().optional(),
});

interface Room {
  id: number;
  number: number;
  type: string;
  capacity: number;
  section_id?: number;
}

interface RoomFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit?: () => void;
  room?: Room | null;
}

const RoomForm: React.FC<RoomFormProps> = ({ open = false, onOpenChange, onSubmit, room }) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      number: "",
      type: "Lecture",
      capacity: "",
      section_id: "",
    },
  });

  // 🔑 Reset form values whenever the dialog opens or the room changes
  React.useEffect(() => {
    form.reset({
      number: room?.number ? String(room.number) : "",
      type: (room?.type as "Lecture" | "Laboratory") ?? "Lecture",
      capacity: room?.capacity ? String(room.capacity) : "",
      section_id: room?.section_id ? String(room.section_id) : "",
    });
  }, [room, open, form]);

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = {
        number: parseInt(values.number, 10),
        type: values.type,
        capacity: parseInt(values.capacity, 10),
        section_id: values.section_id ? parseInt(values.section_id, 10) : null,
      };

      const resp = room
        ? await axios.put(`http://localhost/spcc_database/rooms.php?id=${room.id}`, payload)
        : await axios.post("http://localhost/spcc_database/rooms.php", payload);

      if (resp.data.success || resp.data.status === "success") {
        form.reset();
        onSubmit?.();
        onOpenChange?.(false);
      } else {
        throw new Error(resp.data.message || "Failed to save room");
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to save room. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* key forces a remount when switching between “new” and an existing room */}
      <DialogContent key={room?.id ?? "new"} className="max-w-md rounded-2xl bg-gray-100 p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold mb-2">
            {room ? "Edit Room" : "Create New Room"}
          </DialogTitle>
          <DialogDescription>
            {room ? "Update the room information below." : "Fill in the details to create a new room."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Room Number</Label>
            <Input {...form.register("number")} className="rounded-lg" />
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label>Room Type</Label>
              <select {...form.register("type")} className="rounded-lg w-full h-10 px-2 border border-gray-300">
                <option value="Lecture">Lecture</option>
                <option value="Laboratory">Laboratory</option>
              </select>
            </div>

            <div className="flex-1 space-y-2">
              <Label>Capacity</Label>
              <Input type="number" {...form.register("capacity")} className="rounded-lg" />
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button type="button" variant="outline" className="flex-1 rounded-lg bg-gray-400 text-white hover:bg-gray-500"
              onClick={() => onOpenChange?.(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 rounded-lg bg-black text-white hover:bg-gray-800" disabled={isLoading}>
              {isLoading ? "Saving..." : room ? "Save Changes" : "Add Room"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RoomForm;
