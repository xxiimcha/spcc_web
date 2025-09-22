import React, { useState } from "react";
import {
  Clock,
  User,
  School,
  Users,
  AlertTriangle,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import ScheduleRecommendation from "./ScheduleRecommendation";

interface ConflictItem {
  id: string;
  startTime: string;
  endTime: string;
  day: string;
  days?: string[];
  subjectCode: string;
  subjectName: string;
  section?: string;
  professorName?: string;
  conflictType: string;
  conflictMessage: string;
  currentLoad?: number;
  maxLoad?: number;
}

interface Recommendation {
  type: string;
  days: string[];
  startTime: string;
  endTime: string;
  room?: string;
  reason: string;
}

interface ProfessorWorkload {
  currentLoad: number;
  maxLoad: number;
  isOverloaded: boolean;
  conflictType?: string;
  conflictMessage?: string;
}

interface AlternativeProfessor {
  id: string;
  name: string;
  currentLoad: number;
}

interface AlternativeTime {
  day: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

interface ScheduleConflictWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: {
    professorConflicts: ConflictItem[];
    roomConflicts: ConflictItem[];
    sectionConflicts: ConflictItem[];
    subjectConflicts: ConflictItem[];
    professorWorkload: ProfessorWorkload;
    alternativeProfessors: AlternativeProfessor[];
    alternativeTimes: AlternativeTime[];
  };
  originalRequest: {
    professorId: string;
    room?: string;
    section: string;
    days: string[];
    startTime: string;
    endTime: string;
    scheduleType: string;
    subjectId: string;
    schoolYear: string;
    semester: string;
    level: string;
    strand: string;
  };
  onFixConflict: () => void;
  onScheduleSelected: (recommendation: any) => void;
  setConflictData: React.Dispatch<React.SetStateAction<any>>;
}

const formatTime = (time: string) => {
  try {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const period = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${formattedHour}:${minutes} ${period}`;
  } catch (e) {
    return time;
  }
};

const formatDays = (days: string[] | string) => {
  if (Array.isArray(days)) {
    return days
      .map((day) => day.charAt(0).toUpperCase() + day.slice(1))
      .join(", ");
  }
  return days.charAt(0).toUpperCase() + days.slice(1);
};

const ConflictCard = ({
  conflict,
  type,
}: {
  conflict: ConflictItem;
  type: string;
}) => {
  return (
    <div className="bg-white rounded-lg shadow border p-4 mb-2">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-medium text-gray-900">{conflict.subjectCode}</h4>
          <p className="text-sm text-gray-600">{conflict.subjectName}</p>
          {conflict.conflictMessage && (
            <p className="text-xs text-red-500 mt-1">
              {conflict.conflictMessage}
            </p>
          )}
        </div>
        <Badge
          variant={
            type === "professor"
              ? "destructive"
              : type === "room"
              ? "secondary"
              : type === "subject"
              ? "default"
              : "outline"
          }
        >
          {conflict.conflictType === "PROFESSOR_SCHEDULE_CONFLICT"
            ? "Professor Schedule Conflict"
            : conflict.conflictType === "ROOM_OCCUPIED"
            ? "Room Occupied"
            : conflict.conflictType === "SECTION_SCHEDULE_CONFLICT"
            ? "Section Schedule Conflict"
            : conflict.conflictType === "DUPLICATE_SUBJECT"
            ? "Duplicate Subject"
            : type === "professor"
            ? "Professor Conflict"
            : type === "room"
            ? "Room Conflict"
            : type === "subject"
            ? "Subject Conflict"
            : "Section Conflict"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm">
        <div className="flex items-center">
          <Clock className="h-4 w-4 mr-2 text-gray-500" />
          <span>
            {formatTime(conflict.startTime)} - {formatTime(conflict.endTime)}
          </span>
        </div>

        <div className="flex items-center">
          <School className="h-4 w-4 mr-2 text-gray-500" />
          <span>
            {conflict.days
              ? formatDays(conflict.days)
              : formatDays(conflict.day)}
          </span>
        </div>

        {conflict.section && (
          <div className="flex items-center">
            <Users className="h-4 w-4 mr-2 text-gray-500" />
            <span>Section: {conflict.section}</span>
          </div>
        )}

        {conflict.professorName && (
          <div className="flex items-center">
            <User className="h-4 w-4 mr-2 text-gray-500" />
            <span>{conflict.professorName}</span>
          </div>
        )}

        {conflict.currentLoad && conflict.maxLoad && (
          <div className="flex items-center">
            <BookOpen className="h-4 w-4 mr-2 text-gray-500" />
            <span>
              Workload: {conflict.currentLoad}/{conflict.maxLoad} subjects
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const WorkloadWarning = ({ workload }: { workload: ProfessorWorkload }) => {
  if (!workload.isOverloaded) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
        <div>
          <h4 className="font-medium text-amber-800">
            Professor Workload Warning
          </h4>
          <p className="text-sm text-amber-700">
            {workload.conflictMessage ||
              `This professor currently has ${workload.currentLoad} out of ${workload.maxLoad} maximum subjects. Adding another subject would exceed their recommended workload.`}
          </p>
        </div>
      </div>
    </div>
  );
};

const AlternativeProfessorsSection = ({
  alternatives,
  onSelect,
}: {
  alternatives: AlternativeProfessor[];
  onSelect: (profId: string) => void;
}) => {
  if (!alternatives || alternatives.length === 0) return null;

  return (
    <div className="mt-4 border-t pt-4">
      <h4 className="text-sm font-medium mb-3">
        Available Professors with Lower Workload
      </h4>
      <div className="space-y-2">
        {alternatives.map((prof) => (
          <div
            key={prof.id}
            className="flex items-center justify-between bg-gray-50 p-3 rounded-md"
          >
            <div>
              <p className="font-medium">{prof.name}</p>
              <p className="text-xs text-gray-500">
                Current workload: {prof.currentLoad}/8 subjects
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSelect(prof.id)}
            >
              Select
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

const ScheduleConflictWarning: React.FC<ScheduleConflictWarningProps> = ({
  open,
  onOpenChange,
  conflicts,
  originalRequest,
  onFixConflict,
  onScheduleSelected,
  setConflictData,
}) => {
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [selectedProfessor, setSelectedProfessor] = useState<string | null>(
    null
  );

  const totalConflicts =
    conflicts.professorConflicts.length +
    conflicts.roomConflicts.length +
    conflicts.sectionConflicts.length +
    conflicts.subjectConflicts.length;

  const handleFixConflicts = () => {
    setShowRecommendations(true);
  };

  const handleProfessorSelected = (professorId: string) => {
    setSelectedProfessor(professorId);
    console.log("Selected alternative professor:", professorId);
    // Here you might want to update the original request with the new professor
    // and potentially trigger a recheck for conflicts
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex flex-row items-center gap-2 text-destructive border-b pb-4">
            <AlertTriangle className="h-6 w-6" />
            <DialogTitle>Schedule Conflicts Detected</DialogTitle>
            <DialogDescription>
              Review and resolve the conflicts before creating your schedule.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            <div className="mb-4">
              <p className="text-gray-700">
                We've detected {totalConflicts} conflict
                {totalConflicts !== 1 ? "s" : ""} with your proposed schedule.
                Please review the details below before proceeding.
              </p>
            </div>

            {conflicts.professorWorkload &&
              conflicts.professorWorkload.isOverloaded && (
                <WorkloadWarning workload={conflicts.professorWorkload} />
              )}

            <Accordion type="single" collapsible className="w-full">
              {conflicts.professorConflicts.length > 0 && (
                <AccordionItem value="professor-conflicts">
                  <AccordionTrigger className="hover:bg-red-50 px-4 py-2 rounded-md">
                    <div className="flex items-center gap-2 text-destructive">
                      <User className="h-5 w-5" />
                      <span>
                        Professor Conflicts (
                        {conflicts.professorConflicts.length})
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4">
                    <p className="text-sm text-gray-600 mb-3">
                      The professor is already scheduled to teach during this
                      time slot or has workload issues.
                    </p>
                    {conflicts.professorConflicts.map((conflict, index) => (
                      <ConflictCard
                        key={conflict.id || `prof-conflict-${index}`}
                        conflict={conflict}
                        type="professor"
                      />
                    ))}

                    {conflicts.alternativeProfessors &&
                      conflicts.alternativeProfessors.length > 0 && (
                        <AlternativeProfessorsSection
                          alternatives={conflicts.alternativeProfessors}
                          onSelect={handleProfessorSelected}
                        />
                      )}
                  </AccordionContent>
                </AccordionItem>
              )}

              {conflicts.roomConflicts.length > 0 && (
                <AccordionItem value="room-conflicts">
                  <AccordionTrigger className="hover:bg-amber-50 px-4 py-2 rounded-md">
                    <div className="flex items-center gap-2 text-amber-600">
                      <School className="h-5 w-5" />
                      <span>
                        Room Conflicts ({conflicts.roomConflicts.length})
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4">
                    <p className="text-sm text-gray-600 mb-3">
                      The selected room is already occupied during this time
                      slot.
                    </p>
                    {conflicts.roomConflicts.map((conflict, index) => (
                      <ConflictCard
                        key={conflict.id || `room-conflict-${index}`}
                        conflict={conflict}
                        type="room"
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}

              {conflicts.sectionConflicts.length > 0 && (
                <AccordionItem value="section-conflicts">
                  <AccordionTrigger className="hover:bg-blue-50 px-4 py-2 rounded-md">
                    <div className="flex items-center gap-2 text-blue-600">
                      <Users className="h-5 w-5" />
                      <span>
                        Section Conflicts ({conflicts.sectionConflicts.length})
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4">
                    <p className="text-sm text-gray-600 mb-3">
                      The selected section already has a class scheduled during
                      this time slot.
                    </p>
                    {conflicts.sectionConflicts.map((conflict, index) => (
                      <ConflictCard
                        key={conflict.id || `section-conflict-${index}`}
                        conflict={conflict}
                        type="section"
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}

              {conflicts.subjectConflicts &&
                conflicts.subjectConflicts.length > 0 && (
                  <AccordionItem value="subject-conflicts">
                    <AccordionTrigger className="hover:bg-green-50 px-4 py-2 rounded-md">
                      <div className="flex items-center gap-2 text-green-600">
                        <BookOpen className="h-5 w-5" />
                        <span>
                          Subject Conflicts ({conflicts.subjectConflicts.length}
                          )
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4">
                      <p className="text-sm text-gray-600 mb-3">
                        This subject is already scheduled for this section.
                      </p>
                      {conflicts.subjectConflicts.map((conflict, index) => (
                        <ConflictCard
                          key={conflict.id || `subject-conflict-${index}`}
                          conflict={conflict}
                          type="subject"
                        />
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                )}
            </Accordion>
          </div>

          <DialogFooter className="border-t pt-4">
            <div className="flex w-full justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="default" onClick={handleFixConflicts}>
                Fix Conflicts
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Recommendations Dialog */}
      <ScheduleRecommendation
        open={showRecommendations}
        onOpenChange={setShowRecommendations}
        alternativeTimes={conflicts.alternativeTimes}
        onScheduleSelected={(selected) => {
          onScheduleSelected({
            days: selected.days,
            startTime: selected.startTime,
            endTime: selected.endTime,
          });
        }}
        conflicts={{
          professorConflicts: [],
          roomConflicts: [],
          sectionConflicts: [],
          subjectConflicts: [],
          professorWorkload: {
            currentLoad: 0,
            maxLoad: 0,
            isOverloaded: false,
          },
          alternativeProfessors: [],
          alternativeTimes: [],
        }}
        originalRequest={{
          professorId: "",
          room: "",
          section: "",
          days: [],
          startTime: "",
          endTime: "",
          scheduleType: "",
          subjectId: "",
          schoolYear: "",
          semester: "",
          level: "",
          strand: "",
        }}
      />
    </>
  );
};

export default ScheduleConflictWarning;
