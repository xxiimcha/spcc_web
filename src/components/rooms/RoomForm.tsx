import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";

// Form schema
const formSchema = z.object({
  number: z
    .string()
    .min(1, "Room number is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Room number must be a positive number",
    }),
  type: z.enum(["Lecture", "Laboratory"], {
    required_error: "Room type is required",
  }),
  capacity: z
    .string()
    .min(1, "Capacity is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Capacity must be a positive number",
    }),
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

const RoomForm: React.FC<RoomFormProps> = ({
  open = false,
  onOpenChange,
  onSubmit,
  room,
}) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      number: room?.number.toString() || "",
      type: (room?.type as "Lecture" | "Laboratory") || "Lecture",
      capacity: room?.capacity.toString() || "",
      section_id: room?.section_id?.toString() || "",
    },
  });

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    setError(null);
    try {
      const roomData = {
        number: parseInt(values.number),
        type: values.type,
        capacity: parseInt(values.capacity),
        section_id: values.section_id ? parseInt(values.section_id) : null,
      };

      const response = room
        ? await axios.put(
            `http://localhost/spcc_database/rooms.php?id=${room.id}`,
            roomData
          )
        : await axios.post(
            "http://localhost/spcc_database/rooms.php",
            roomData
          );

      if (response.data.success || response.data.status === "success") {
        form.reset();
        onSubmit?.();
        onOpenChange?.(false);
      } else {
        throw new Error(response.data.message || "Failed to save room");
      }
    } catch (error) {
      console.error("Error creating room:", error);
      if (axios.isAxiosError(error)) {
        setError(
          error.response?.data?.message ||
            "Failed to save room. Please try again."
        );
      } else {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to save room. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-gray-100 p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold mb-2">
            {room ? "Edit Room" : "Create New Room"}
          </DialogTitle>
          <DialogDescription>
            {room
              ? "Update the room information below."
              : "Fill in the details to create a new room."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Room Number</Label>
            <Input
              className="rounded-lg"
              {...form.register("number")}
              placeholder=""
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label>Room Type</Label>
              <select
                className="rounded-lg w-full h-10 px-2 border border-gray-300"
                {...form.register("type")}
              >
                <option value="Lecture">Lecture</option>
                <option value="Laboratory">Laboratory</option>
              </select>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Capacity</Label>
              <Input
                className="rounded-lg"
                type="number"
                {...form.register("capacity")}
                placeholder=""
              />
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-lg bg-gray-400 text-white hover:bg-gray-500"
              onClick={() => onOpenChange?.(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 rounded-lg bg-black text-white hover:bg-gray-800"
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : room ? "Save Changes" : "Add Room"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RoomForm;
