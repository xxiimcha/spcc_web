import React, { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import {
  Plus,
  RefreshCw,
  Trash2,
  Users,
  MapPin,
  Filter,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Pencil,
  UserPlus,
  AlertTriangle,
  Eye,
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
  DialogFooter,
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
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Define types for our data
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

// Add this new component at the top of the file
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

  // Fetch sections when dialog opens
  React.useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await axios.get(
          "http://localhost/spcc_database/sections.php"
        );
        if (response.data.success && Array.isArray(response.data.data)) {
          // Get current room data to check assigned sections
          const roomResponse = await axios.get(
            `http://localhost/spcc_database/rooms.php?id=${roomId}`
          );

          if (roomResponse.data.success) {
            const roomData = roomResponse.data.data;
            const assignedSectionIds =
              roomData.sections?.map((s: any) => s.section_id) || [];

            // Filter out sections that are already assigned to this room
            const availableSections = response.data.data.filter(
              (section: Section) =>
                !assignedSectionIds.includes(section.section_id)
            );

            setSections(availableSections);
          } else {
            setSections(response.data.data);
          }
        }
      } catch (error) {
        console.error("Error fetching sections:", error);
        setError("Failed to load sections");
      }
    };

    if (open) {
      fetchSections();
    }
  }, [open, roomId]);

  // This is a modified version of the RoomSectionDialog component that
  // checks if a section is already assigned to a room before attempting
  // to assign it again, preventing the 500 Internal Server Error.

  const handleAddSection = async () => {
    if (!selectedSection) return;

    setIsLoading(true);
    setError(null);
    try {
      // First, get the current section data
      const sectionResponse = await axios.get(
        `http://localhost/spcc_database/sections.php?id=${selectedSection}`
      );

      if (!sectionResponse.data.success) {
        throw new Error("Failed to fetch section data");
      }

      const sectionData = sectionResponse.data.data;

      // Get current room assignments for this section
      const currentRoomIds = sectionData.rooms
        ? Array.from(new Set(sectionData.rooms.map((room: any) => room.id)))
        : [];

      // Check if this section is already assigned to this room
      if (currentRoomIds.includes(roomId)) {
        onSectionAdded(); // Still refresh the parent component
        onOpenChange(false);
        toast({
          title: "Section Already Assigned",
          description: "This section is already assigned to this room.",
        });
        return; // Exit early - no need to make the API call
      }

      // Add the new room ID
      currentRoomIds.push(roomId);

      // Make sure all required fields are included in the update request
      const response = await axios.put(
        `http://localhost/spcc_database/sections.php?id=${selectedSection}`,
        {
          section_name: sectionData.section_name,
          grade_level: sectionData.grade_level,
          number_of_students: sectionData.number_of_students || 0,
          strand: sectionData.strand || "",
          room_ids: currentRoomIds,
        }
      );

      if (response.data.status === "success") {
        onSectionAdded();
        onOpenChange(false);
        toast({
          title: "Section Added",
          description:
            "The section has been successfully assigned to the room.",
        });
      } else {
        throw new Error(response.data.message || "Failed to add section");
      }
    } catch (error) {
      console.error("Error adding section:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to add section. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-gray-100 p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold mb-2">
            Add Section to Room {roomNumber}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Select Section</Label>
            <Select value={selectedSection} onValueChange={setSelectedSection}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a section..." />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem
                    key={section.section_id}
                    value={section.section_id.toString()}
                  >
                    {section.section_name} - Grade {section.grade_level}{" "}
                    {section.strand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 mt-6">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-lg bg-gray-400 text-white hover:bg-gray-500"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-lg bg-black text-white hover:bg-gray-800"
              onClick={handleAddSection}
              disabled={isLoading || !selectedSection}
            >
              {isLoading ? "Adding..." : "Add Section"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

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
  const [selectedRoomForSection, setSelectedRoomForSection] =
    useState<Room | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Fetch rooms
  const fetchRooms = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        "http://localhost/spcc_database/rooms.php"
      );

      if (response.data.success && Array.isArray(response.data.data)) {
        setRooms(response.data.data);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error("Error fetching rooms:", err);
      setError("Failed to load rooms. Please try again later.");
      setRooms([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  // Initial data loading
  useEffect(() => {
    fetchRooms();
  }, []);

  // Handle form submission
  const handleRoomCreated = () => {
    setIsFormOpen(false);
    fetchRooms();
    toast({
      title: "Room Created",
      description: "The room has been successfully created.",
    });
  };

  // Open delete confirmation dialog
  const confirmDelete = (roomId: number) => {
    setRoomToDelete(roomId);
    setDeleteDialogOpen(true);
  };

  // Delete room
  const deleteRoom = async () => {
    if (!roomToDelete) return;

    try {
      const response = await axios.delete(
        `http://localhost/spcc_database/rooms.php?id=${roomToDelete}`
      );

      // Check if the response indicates success, even if it's a 404 (since the room is deleted)
      if (
        response.data.success ||
        response.data.message?.includes("deleted successfully")
      ) {
        // Update the rooms state by filtering out the deleted room
        setRooms((prevRooms) => prevRooms.filter((r) => r.id !== roomToDelete));

        // Close the dialog and reset the roomToDelete state
        setDeleteDialogOpen(false);
        setRoomToDelete(null);

        toast({
          title: "Room Deleted",
          description: "The room has been successfully removed.",
        });
      } else {
        throw new Error(response.data.message || "Failed to delete room");
      }
    } catch (err) {
      // If it's a 404 error and the room was successfully deleted, treat it as success
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setRooms((prevRooms) => prevRooms.filter((r) => r.id !== roomToDelete));
        setDeleteDialogOpen(false);
        setRoomToDelete(null);
        toast({
          title: "Room Deleted",
          description: "The room has been successfully removed.",
        });
        return;
      }

      console.error("Error deleting room:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error
            ? err.message
            : "Failed to delete room. Please try again later.",
        variant: "destructive",
      });
    }
  };

  // Get room type badge variant
  const getRoomTypeBadge = (type: string) => {
    switch (type) {
      case "Lecture":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Laboratory":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Group rooms by floor
  const groupRoomsByFloor = (rooms: Room[]): FloorGroup[] => {
    const floorGroups: { [key: number]: Room[] } = {};

    rooms.forEach((room) => {
      const floor = Math.floor(room.number / 100);
      if (!floorGroups[floor]) {
        floorGroups[floor] = [];
      }
      floorGroups[floor].push(room);
    });

    return Object.entries(floorGroups)
      .map(([floor, rooms]) => ({
        floor: parseInt(floor),
        rooms: rooms.sort((a, b) => a.number - b.number),
      }))
      .sort((a, b) => a.floor - b.floor);
  };

  const toggleFloor = (floor: number) => {
    setExpandedFloors((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(floor)) {
        newSet.delete(floor);
      } else {
        newSet.add(floor);
      }
      return newSet;
    });
  };

  // Format ordinal numbers (1st, 2nd, 3rd, etc.)
  const formatOrdinal = (num: number): string => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) {
      return num + "st";
    }
    if (j === 2 && k !== 12) {
      return num + "nd";
    }
    if (j === 3 && k !== 13) {
      return num + "rd";
    }
    return num + "th";
  };

  // Get unique floors from rooms
  const getUniqueFloors = (rooms: Room[]): number[] => {
    const floors = new Set(rooms.map((room) => Math.floor(room.number / 100)));
    return Array.from(floors).sort((a, b) => a - b);
  };

  // Filter rooms based on selected floor
  const getFilteredRooms = (rooms: Room[]): Room[] => {
    if (selectedFloor === "all") return rooms;
    const floor = parseInt(selectedFloor);
    return rooms.filter((room) => Math.floor(room.number / 100) === floor);
  };

  // Add this handler
  const handleEditRoom = (room: Room) => {
    setSelectedRoom(room);
    setIsFormOpen(true);
  };

  // Add this handler:
  const handleAddSection = (room: Room) => {
    setSelectedRoomForSection(room);
    setSectionDialogOpen(true);
  };

  // Add this function to fetch room details with sections
  const fetchRoomDetails = async (roomId: number) => {
    try {
      const response = await axios.get(
        `http://localhost/spcc_database/rooms.php?id=${roomId}`
      );

      if (response.data.success) {
        setSelectedRoom(response.data.data);
      } else {
        throw new Error("Failed to fetch room details");
      }
    } catch (error) {
      console.error("Error fetching room details:", error);
      toast({
        title: "Error",
        description: "Failed to fetch room details. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Add this function to handle view dialog
  const openViewDialog = (room: Room) => {
    setSelectedRoom(room);
    setIsViewDialogOpen(true);
    fetchRoomDetails(room.id);
  };

  return (
    <div className="container mx-auto py-4 px-4 sm:px-6 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Room Management
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            View and manage rooms for scheduling
          </p>
        </div>

        {/* Action buttons and filters */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <Select value={selectedFloor} onValueChange={setSelectedFloor}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by floor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Floors</SelectItem>
              {getUniqueFloors(rooms).map((floor) => (
                <SelectItem key={floor} value={floor.toString()}>
                  {formatOrdinal(floor)} Floor
                </SelectItem>
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
      ) : getFilteredRooms(rooms).length === 0 ? (
        <Card className="text-center p-4 sm:p-8">
          <CardHeader>
            <CardTitle>No Rooms Found</CardTitle>
            <CardDescription>
              {selectedFloor !== "all"
                ? "No rooms found on the selected floor."
                : "There are no rooms available. Create a new room to get started."}
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
          {groupRoomsByFloor(getFilteredRooms(rooms)).map((floorGroup) => (
            <Card
              key={floorGroup.floor}
              className="overflow-hidden border-2 hover:border-primary/50 transition-colors"
            >
              <CardHeader className="pb-2 bg-muted/50">
                <Button
                  variant="ghost"
                  className="w-full flex justify-between items-center p-0 hover:bg-transparent"
                  onClick={() => toggleFloor(floorGroup.floor)}
                >
                  <div className="flex items-center gap-3">
                    {expandedFloors.has(floorGroup.floor) ? (
                      <ChevronDown className="h-5 w-5 text-primary" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-primary" />
                    )}
                    <div>
                      <CardTitle className="text-xl font-bold">
                        {formatOrdinal(floorGroup.floor)} Floor
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {floorGroup.rooms.length}{" "}
                        {floorGroup.rooms.length === 1 ? "Room" : "Rooms"}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {floorGroup.rooms.length}{" "}
                    {floorGroup.rooms.length === 1 ? "Room" : "Rooms"}
                  </Badge>
                </Button>
              </CardHeader>
              {expandedFloors.has(floorGroup.floor) && (
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {floorGroup.rooms.map((room) => (
                      <Card
                        key={room.id}
                        className="overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg font-semibold">
                                Room {room.number}
                              </CardTitle>
                              <div className="mt-1">
                                <Badge className={getRoomTypeBadge(room.type)}>
                                  {room.type}
                                </Badge>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => openViewDialog(room)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => confirmDelete(room.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleEditRoom(room)}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                Capacity: {room.capacity} students
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                Room Type: {room.type}
                              </span>
                            </div>
                            {room.sections && room.sections.length > 0 ? (
                              <div className="mt-2">
                                <div className="text-sm font-medium mb-1">
                                  Assigned Sections:
                                </div>
                                <div className="space-y-1">
                                  {room.sections.map((section) => (
                                    <div
                                      key={section.section_id}
                                      className="text-sm bg-muted p-2 rounded-md"
                                    >
                                      {section.section_name} - Grade{" "}
                                      {section.grade_level} {section.strand}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full mt-2"
                                onClick={() => handleAddSection(room)}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add Section
                              </Button>
                            )}
                          </div>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this room? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteRoom}
              className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Room Form Modal */}
      <RoomForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setSelectedRoom(null);
        }}
        onSubmit={handleRoomCreated}
        room={selectedRoom}
      />

      {/* Room Section Dialog */}
      <RoomSectionDialog
        open={sectionDialogOpen}
        onOpenChange={setSectionDialogOpen}
        roomId={selectedRoomForSection?.id || 0}
        roomNumber={selectedRoomForSection?.number || 0}
        onSectionAdded={fetchRooms}
      />

      {/* Add View Room Dialog */}
      {isViewDialogOpen && selectedRoom && (
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="sm:max-w-[600px] bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                Room Details
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Room Number
                </h3>
                <p className="text-base">{selectedRoom.number}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Room Type
                </h3>
                <p className="text-base">{selectedRoom.type}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Capacity
                </h3>
                <p className="text-base">{selectedRoom.capacity} students</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default RoomManagement;
