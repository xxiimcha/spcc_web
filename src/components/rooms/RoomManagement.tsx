import React, { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import {
  Plus,
  RefreshCw,
  Trash2,
  Users,
  MapPin,
  ChevronDown,
  ChevronRight,
  Pencil,
  UserPlus,
  AlertTriangle,
  Eye,
  MoreVertical,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import RoomForm from "./RoomForm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/* ---------- Types ---------- */

interface Room {
  id: number;
  number: number;
  type: string;
  capacity: number;
  sections?: {
    section_id: number;
    section_name: string;
    grade_level: string;
    strand: string;
  }[];
}

interface FloorGroup {
  floor: number;
  rooms: Room[];
}

interface Section {
  section_id: number;
  section_name: string;
  grade_level: number;
  strand: string;
}

/* ---------- Assign Section Dialog ---------- */

interface RoomSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: number;
  roomNumber: number;
  onSectionAdded: () => void;
}

const RoomSectionDialog: React.FC<RoomSectionDialogProps> = ({
  open,
  onOpenChange,
  roomId,
  roomNumber,
  onSectionAdded,
}) => {
  const [sections, setSections] = React.useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loadingSections, setLoadingSections] = React.useState(false);

  // Load ONLY sections that are NOT assigned to any room
  React.useEffect(() => {
    const loadUnassignedSections = async () => {
      setLoadingSections(true);
      setError(null);
      try {
        const { data } = await axios.get("http://localhost/spcc_database/sections.php");
        if (!data?.success || !Array.isArray(data.data)) {
          throw new Error("Invalid sections response");
        }

        // API returns each section with a `rooms` array
        const unassigned = data.data.filter(
          (s: any) => !Array.isArray(s.rooms) || s.rooms.length === 0
        );

        setSections(unassigned);
      } catch (e: any) {
        setError(e?.message || "Failed to load sections");
        setSections([]);
      } finally {
        setLoadingSections(false);
      }
    };

    if (open) loadUnassignedSections();
  }, [open]);

  const handleAddSection = async () => {
    if (!selectedSection) return;

    setIsLoading(true);
    setError(null);
    try {
      // Double-check the section is still unassigned
      const secRes = await axios.get(
        `http://localhost/spcc_database/sections.php?id=${selectedSection}`
      );
      if (!secRes.data?.success) throw new Error("Failed to fetch section data");

      const section = secRes.data.data;

      // If it already has any room, block (prevents race conditions)
      if (Array.isArray(section.rooms) && section.rooms.length > 0) {
        toast({
          title: "Section already assigned",
          description: "Only unassigned sections can be added to a room.",
          variant: "destructive",
        });
        return;
      }

      // Assign to this room
      const payload = {
        section_name: section.section_name,
        grade_level: section.grade_level,
        number_of_students: section.number_of_students ?? 0,
        strand: section.strand ?? "",
        room_ids: [roomId],
      };

      const resp = await axios.put(
        `http://localhost/spcc_database/sections.php?id=${selectedSection}`,
        payload
      );

      if (resp.data.status === "success") {
        toast({ title: "Section assigned", description: "The section was added to this room." });
        onSectionAdded();
        onOpenChange(false);
      } else {
        throw new Error(resp.data.message || "Failed to add section");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to add section. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const nothingToAssign = !loadingSections && sections.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>Add Section to Room {roomNumber}</DialogTitle>
          <DialogDescription>
            {nothingToAssign ? "All sections are already assigned to rooms." : "Select a section to assign to this room."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div className="space-y-2">
            <span className="text-sm font-medium">Section</span>
            <Select
              value={selectedSection}
              onValueChange={setSelectedSection}
              disabled={loadingSections || nothingToAssign}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingSections ? "Loading..." : "Choose a section..."} />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s: any) => (
                  <SelectItem key={s.section_id} value={s.section_id.toString()}>
                    {s.section_name} • G{s.grade_level} {s.strand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleAddSection}
              disabled={isLoading || !selectedSection || nothingToAssign}
            >
              {isLoading ? "Adding..." : "Add Section"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


/* ---------- Page ---------- */

const RoomManagement = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<number | null>(null);
  const [expandedFloors, setExpandedFloors] = useState<Set<number>>(new Set());
  const [selectedFloor, setSelectedFloor] = useState<string>("all");
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [selectedRoomForSection, setSelectedRoomForSection] = useState<Room | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // fetch
  const fetchRooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get("http://localhost/spcc_database/rooms.php");
      if (response.data.success && Array.isArray(response.data.data)) {
        setRooms(response.data.data);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load rooms. Please try again later.");
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRooms(); }, []);

  // helpers
  const getRoomTypeBadge = (type: string) =>
    type === "Lecture"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : type === "Laboratory"
      ? "bg-purple-50 text-purple-700 border-purple-200"
      : "bg-gray-50 text-gray-700 border-gray-200";

  const groupRoomsByFloor = (all: Room[]): FloorGroup[] => {
    const map: Record<number, Room[]> = {};
    all.forEach((r) => {
      const floor = Math.floor(r.number / 100);
      map[floor] = map[floor] || [];
      map[floor].push(r);
    });
    return Object.entries(map)
      .map(([floor, rs]) => ({ floor: Number(floor), rooms: rs.sort((a, b) => a.number - b.number) }))
      .sort((a, b) => a.floor - b.floor);
  };

  const getUniqueFloors = (all: Room[]): number[] =>
    Array.from(new Set(all.map((r) => Math.floor(r.number / 100)))).sort((a, b) => a - b);

  const getFilteredRooms = (all: Room[]) => {
    if (selectedFloor === "all") return all;
    const fl = Number(selectedFloor);
    return all.filter((r) => Math.floor(r.number / 100) === fl);
  };

  const formatOrdinal = (n: number) => {
    const j = n % 10, k = n % 100;
    if (j === 1 && k !== 11) return `${n}st`;
    if (j === 2 && k !== 12) return `${n}nd`;
    if (j === 3 && k !== 13) return `${n}rd`;
    return `${n}th`;
  };

  const toggleFloor = (f: number) =>
    setExpandedFloors((prev) => {
      const s = new Set(prev);
      s.has(f) ? s.delete(f) : s.add(f);
      return s;
    });

  // actions
  const handleRoomCreated = () => {
    setIsFormOpen(false);
    fetchRooms();
    toast({ title: "Room Saved", description: "Room was created/updated." });
  };

  const confirmDelete = (roomId: number) => {
    setRoomToDelete(roomId);
    setDeleteDialogOpen(true);
  };

  const deleteRoom = async () => {
    if (!roomToDelete) return;
    try {
      const response = await axios.delete(
        `http://localhost/spcc_database/rooms.php?id=${roomToDelete}`
      );
      if (response.data.success || response.data.message?.includes("deleted successfully")) {
        setRooms((prev) => prev.filter((r) => r.id !== roomToDelete));
        setDeleteDialogOpen(false);
        setRoomToDelete(null);
        toast({ title: "Room Deleted", description: "The room has been removed." });
      } else {
        throw new Error(response.data.message || "Failed to delete room");
      }
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setRooms((prev) => prev.filter((r) => r.id !== roomToDelete));
        setDeleteDialogOpen(false);
        setRoomToDelete(null);
        toast({ title: "Room Deleted", description: "The room has been removed." });
        return;
      }
      console.error(err);
      toast({
        title: "Error",
        description: err?.message || "Failed to delete room.",
        variant: "destructive",
      });
    }
  };

  const handleEditRoom = (room: Room) => { setSelectedRoom(room); setIsFormOpen(true); };
  const handleAddSection = (room: Room) => { setSelectedRoomForSection(room); setSectionDialogOpen(true); };

  const fetchRoomDetails = async (roomId: number) => {
    try {
      const response = await axios.get(`http://localhost/spcc_database/rooms.php?id=${roomId}`);
      if (response.data.success) setSelectedRoom(response.data.data);
      else throw new Error("Failed to fetch room details");
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to fetch room details.", variant: "destructive" });
    }
  };

  const openViewDialog = (room: Room) => {
    setSelectedRoom(room);
    setIsViewDialogOpen(true);
    fetchRoomDetails(room.id);
  };

  /* ---------- Render ---------- */

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold">Room Management</h1>
          <p className="text-sm text-muted-foreground">Organize rooms and their assigned sections.</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedFloor} onValueChange={setSelectedFloor}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by floor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Floors</SelectItem>
              {getUniqueFloors(rooms).map((f) => (
                <SelectItem key={f} value={String(f)}>{formatOrdinal(f)} Floor</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchRooms}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Room
          </Button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      ) : error ? (
        <Card className="bg-destructive/10 border-destructive">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : getFilteredRooms(rooms).length === 0 ? (
        <Card className="text-center p-8">
          <CardHeader>
            <CardTitle>No Rooms Found</CardTitle>
            <CardDescription>
              {selectedFloor !== "all"
                ? "No rooms on the selected floor."
                : "Create a room to get started."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Room
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupRoomsByFloor(getFilteredRooms(rooms)).map((grp) => (
            <Card key={grp.floor} className="overflow-hidden border">
              {/* Floor header */}
              <div className="sticky top-0 z-10 bg-muted/40">
                <CardHeader className="py-3">
                  <button
                    className="w-full flex items-center justify-between text-left"
                    onClick={() => toggleFloor(grp.floor)}
                  >
                    <div className="flex items-center gap-3">
                      {expandedFloors.has(grp.floor) ? (
                        <ChevronDown className="h-5 w-5 text-primary" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-primary" />
                      )}
                      <div>
                        <CardTitle className="text-lg">{formatOrdinal(grp.floor)} Floor</CardTitle>
                        <CardDescription className="text-xs">
                          {grp.rooms.length} {grp.rooms.length === 1 ? "Room" : "Rooms"}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline">{grp.rooms.length}</Badge>
                  </button>
                </CardHeader>
              </div>

              {/* Rooms grid */}
              {expandedFloors.has(grp.floor) && (
                <CardContent className="pt-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {grp.rooms.map((room) => (
                      <Card key={room.id} className="hover:shadow-sm transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <CardTitle className="text-base truncate">Room {room.number}</CardTitle>
                              <div className="mt-1">
                                <Badge className={getRoomTypeBadge(room.type)}>{room.type}</Badge>
                              </div>
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => openViewDialog(room)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditRoom(room)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-700"
                                  onClick={() => confirmDelete(room.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-3">
                          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                            <div className="inline-flex items-center gap-1.5">
                              <Users className="h-4 w-4" />
                              <span>{room.capacity} students</span>
                            </div>
                            <div className="inline-flex items-center gap-1.5">
                              <MapPin className="h-4 w-4" />
                              <span>{room.type}</span>
                            </div>
                          </div>

                          {room.sections && room.sections.length > 0 ? (
                            <div className="space-y-1.5">
                              <div className="text-xs font-medium text-muted-foreground">
                                Assigned Sections
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {room.sections.map((s) => (
                                  <Badge key={s.section_id} variant="secondary" className="px-2 py-0.5">
                                    {s.section_name} • G{s.grade_level} {s.strand}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => handleAddSection(room)}
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              Add Section
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete room?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the room.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteRoom} className="bg-red-600 hover:bg-red-700 w-full sm:w-auto">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create / Edit Room */}
      <RoomForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setSelectedRoom(null);
        }}
        onSubmit={handleRoomCreated}
        room={selectedRoom}
      />

      {/* Assign Section */}
      <RoomSectionDialog
        open={sectionDialogOpen}
        onOpenChange={setSectionDialogOpen}
        roomId={selectedRoomForSection?.id || 0}
        roomNumber={selectedRoomForSection?.number || 0}
        onSectionAdded={fetchRooms}
      />

      {/* View Room */}
      {isViewDialogOpen && selectedRoom && (
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Room {selectedRoom.number}</DialogTitle>
              <DialogDescription>Room details and current assignments</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="text-sm font-medium">{selectedRoom.type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Capacity</p>
                <p className="text-sm font-medium">{selectedRoom.capacity} students</p>
              </div>
              {selectedRoom.sections && selectedRoom.sections.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Assigned Sections</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRoom.sections.map((s) => (
                      <Badge key={s.section_id} variant="secondary">
                        {s.section_name} • G{s.grade_level} {s.strand}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default RoomManagement;
