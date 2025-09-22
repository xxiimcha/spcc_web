import React, { useState, useEffect } from "react";
import { Clock, ArrowRight, Check, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Unified interfaces to work with both components
interface ConflictItem {
  id: string;
  startTime: string;
  endTime: string;
  days?: string[];
  day?: string;
  subjectCode: string;
  subjectName: string;
  section?: string;
  professorName?: string;
  conflictType: string;
  conflictMessage: string;
  currentLoad?: number;
  maxLoad?: number;
}

interface Conflicts {
  professorConflicts: ConflictItem[];
  roomConflicts: ConflictItem[];
  sectionConflicts: ConflictItem[];
  subjectConflicts?: ConflictItem[];
  professorWorkload: ProfessorWorkload;
  alternativeProfessors?: AlternativeProfessor[];
  alternativeTimes?: AlternativeTime[];
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

interface OriginalRequest {
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
}

interface Recommendation {
  type: string;
  days: string[];
  startTime: string;
  endTime: string;
  room?: string;
  reason: string;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onSelect: (recommendation: Recommendation) => void;
  isSelected: boolean;
}

interface ScheduleRecommendationsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: Conflicts;
  originalRequest: OriginalRequest;
  onScheduleSelected: (
    recommendation: Recommendation | AlternativeTimeSelection
  ) => void;
  alternativeTimes?: AlternativeTime[];
}

interface AlternativeTimeSelection {
  days: string[];
  startTime: string;
  endTime: string;
}

// Utility functions for date/time formatting
const formatTime = (time: string): string => {
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

const formatDays = (days: string[] | string | undefined): string => {
  if (!days) return "";

  const dayMap: Record<string, string> = {
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
  };

  if (Array.isArray(days)) {
    return days.map((day) => dayMap[day.toLowerCase()] || day).join(", ");
  }

  return dayMap[days.toLowerCase()] || days;
};

// Type definition for recommendations
const RECOMMENDATION_TYPE = "time_shift";

const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  onSelect,
  isSelected,
}) => {
  return (
    <Card
      className={`mb-3 cursor-pointer transition-all duration-200 ${
        isSelected
          ? "border-2 border-primary shadow-md"
          : "hover:border-blue-200 hover:shadow-sm"
      }`}
      onClick={() => onSelect(recommendation)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-blue-500" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-gray-900">
                  {formatTime(recommendation.startTime)} -{" "}
                  {formatTime(recommendation.endTime)}
                </h4>
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200"
                >
                  Alternative Time
                </Badge>
              </div>
              <p className="text-sm text-gray-600">
                {formatDays(recommendation.days)}
              </p>
            </div>
          </div>
          {isSelected && (
            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
              <Check className="h-4 w-4 text-white" />
            </div>
          )}
        </div>

        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-sm text-gray-600">{recommendation.reason}</p>
        </div>
      </CardContent>
    </Card>
  );
};

const AlternativeTimeCard: React.FC<{
  time: AlternativeTime;
  onSelect: (time: AlternativeTime) => void;
  isSelected: boolean;
}> = ({ time, onSelect, isSelected }) => {
  return (
    <Card
      className={`mb-3 cursor-pointer transition-all duration-200 ${
        isSelected
          ? "border-2 border-primary shadow-md"
          : "hover:border-blue-200 hover:shadow-sm"
      }`}
      onClick={() => onSelect(time)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-blue-500" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-gray-900">
                  {formatTime(time.startTime)} - {formatTime(time.endTime)}
                </h4>
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200"
                >
                  {time.isAvailable ? "Available" : "Alternative Time"}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{formatDays(time.day)}</p>
            </div>
          </div>
          {isSelected && (
            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
              <Check className="h-4 w-4 text-white" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const ScheduleRecommendation: React.FC<ScheduleRecommendationsProps> = ({
  open,
  onOpenChange,
  conflicts,
  originalRequest,
  onScheduleSelected,
  alternativeTimes,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<Recommendation | null>(null);
  const [selectedAlternativeTime, setSelectedAlternativeTime] =
    useState<AlternativeTime | null>(null);

  // Generate recommendations based on conflicts
  useEffect(() => {
    if (!conflicts || !originalRequest) return;

    setLoading(true);

    // Use the alternativeTimes from the backend if available
    if (conflicts.alternativeTimes && conflicts.alternativeTimes.length > 0) {
      setRecommendations([]);
      setLoading(false);
    } else {
      // Generate recommendations locally if no server-side alternatives
      const generatedRecommendations = generateRecommendations(
        conflicts,
        originalRequest
      );
      setRecommendations(generatedRecommendations);
      setLoading(false);
    }
  }, [conflicts, originalRequest]);

  interface TimeOption {
    startHour: number;
    endHour: number;
    type: string;
  }

  interface OccupiedTime {
    start: string;
    end: string;
    days: string[];
  }

  interface TimeBlock {
    start: string;
    end: string;
    label: string;
  }

  const generateRecommendations = (
    conflicts: Conflicts,
    request: OriginalRequest
  ): Recommendation[] => {
    const recommendations: Recommendation[] = [];

    // Time shift recommendations - find time slots before and after the requested time
    const timeShiftOptions: TimeOption[] = [
      { startHour: -2, endHour: -2, type: "earlier" },
      { startHour: -1, endHour: -1, type: "earlier" },
      { startHour: 1, endHour: 1, type: "later" },
      { startHour: 2, endHour: 2, type: "later" },
      { startHour: 3, endHour: 3, type: "later" },
    ];

    // Get all occupied times from conflicts
    const occupiedTimes: OccupiedTime[] = [];

    // Extract occupied times from all conflicts
    if (conflicts.professorConflicts) {
      conflicts.professorConflicts.forEach((conflict) => {
        occupiedTimes.push({
          start: conflict.startTime,
          end: conflict.endTime,
          days: conflict.days || (conflict.day ? [conflict.day] : []),
        });
      });
    }

    if (conflicts.roomConflicts) {
      conflicts.roomConflicts.forEach((conflict) => {
        occupiedTimes.push({
          start: conflict.startTime,
          end: conflict.endTime,
          days: conflict.days || (conflict.day ? [conflict.day] : []),
        });
      });
    }

    if (conflicts.sectionConflicts) {
      conflicts.sectionConflicts.forEach((conflict) => {
        occupiedTimes.push({
          start: conflict.startTime,
          end: conflict.endTime,
          days: conflict.days || (conflict.day ? [conflict.day] : []),
        });
      });
    }

    // Generate time shift recommendations
    timeShiftOptions.forEach((option) => {
      const [startHour, startMinute] = request.startTime.split(":").map(Number);
      const [endHour, endMinute] = request.endTime.split(":").map(Number);

      const newStartHour = startHour + option.startHour;
      const newEndHour = endHour + option.endHour;

      // Check if the new times are within reasonable school hours (7 AM - 7 PM)
      if (newStartHour >= 7 && newEndHour <= 19) {
        const newStartTime = `${String(newStartHour).padStart(2, "0")}:${String(
          startMinute
        ).padStart(2, "0")}`;
        const newEndTime = `${String(newEndHour).padStart(2, "0")}:${String(
          endMinute
        ).padStart(2, "0")}`;

        // Check if this time doesn't conflict with occupied times
        const hasConflict = occupiedTimes.some((time) => {
          // Check if there's any day overlap
          const daysOverlap = time.days.some((day) =>
            request.days.includes(day)
          );

          if (!daysOverlap) return false;

          // Check time overlap
          const timeOverlap =
            newStartTime < time.end && newEndTime > time.start;

          return timeOverlap;
        });

        if (!hasConflict) {
          recommendations.push({
            type: RECOMMENDATION_TYPE,
            days: [...request.days],
            startTime: newStartTime,
            endTime: newEndTime,
            room: request.room,
            reason: `Schedule ${option.type} in the day (${formatTime(
              newStartTime
            )} - ${formatTime(newEndTime)}) to avoid time conflicts.`,
          });
        }
      }
    });

    // Add alternative time blocks: morning, afternoon, evening
    const timeBlocks: TimeBlock[] = [
      { start: "07:30", end: "09:00", label: "Early Morning" },
      { start: "09:15", end: "10:45", label: "Mid Morning" },
      { start: "11:00", end: "12:30", label: "Late Morning" },
      { start: "13:00", end: "14:30", label: "Early Afternoon" },
      { start: "14:45", end: "16:15", label: "Mid Afternoon" },
      { start: "16:30", end: "18:00", label: "Late Afternoon" },
    ];

    timeBlocks.forEach((block) => {
      // Check if this block doesn't conflict with original request time
      const [requestStartHour, requestStartMin] = request.startTime
        .split(":")
        .map(Number);
      const [requestEndHour, requestEndMin] = request.endTime
        .split(":")
        .map(Number);
      const [blockStartHour, blockStartMin] = block.start
        .split(":")
        .map(Number);
      const [blockEndHour, blockEndMin] = block.end.split(":").map(Number);

      const requestStartTotal = requestStartHour * 60 + requestStartMin;
      const requestEndTotal = requestEndHour * 60 + requestEndMin;
      const blockStartTotal = blockStartHour * 60 + blockStartMin;
      const blockEndTotal = blockEndHour * 60 + blockEndMin;

      // Only add if this block is different from requested time
      if (
        blockStartTotal !== requestStartTotal ||
        blockEndTotal !== requestEndTotal
      ) {
        // Also check if it doesn't conflict with any occupied times
        const hasConflict = occupiedTimes.some((time) => {
          // Check if there's any day overlap
          const daysOverlap = time.days.some((day) =>
            request.days.includes(day)
          );

          if (!daysOverlap) return false;

          // Check time overlap
          const [timeStartHour, timeStartMin] = time.start
            .split(":")
            .map(Number);
          const [timeEndHour, timeEndMin] = time.end.split(":").map(Number);

          const timeStartTotal = timeStartHour * 60 + timeStartMin;
          const timeEndTotal = timeEndHour * 60 + timeEndMin;

          return (
            blockStartTotal < timeEndTotal && blockEndTotal > timeStartTotal
          );
        });

        if (!hasConflict) {
          recommendations.push({
            type: RECOMMENDATION_TYPE,
            days: [...request.days],
            startTime: block.start,
            endTime: block.end,
            room: request.room,
            reason: `${block.label} time block (${formatTime(
              block.start
            )} - ${formatTime(block.end)}) is available.`,
          });
        }
      }
    });

    // If no recommendations were found, suggest some standard time blocks anyway
    if (recommendations.length === 0) {
      recommendations.push({
        type: RECOMMENDATION_TYPE,
        days: [...request.days],
        startTime: "07:30",
        endTime: "09:00",
        room: request.room,
        reason: "Early morning time slot may be available.",
      });

      recommendations.push({
        type: RECOMMENDATION_TYPE,
        days: [...request.days],
        startTime: "16:30",
        endTime: "18:00",
        room: request.room,
        reason: "Late afternoon time slot may be available.",
      });
    }

    return recommendations;
  };

  const handleSelectRecommendation = (recommendation: Recommendation): void => {
    setSelectedRecommendation(recommendation);
    setSelectedAlternativeTime(null);
  };

  const handleSelectAlternativeTime = (time: AlternativeTime): void => {
    setSelectedAlternativeTime(time);
    setSelectedRecommendation(null);
  };

  const handleConfirm = (): void => {
    if (selectedRecommendation && onScheduleSelected) {
      onScheduleSelected(selectedRecommendation);
      onOpenChange(false);
    } else if (selectedAlternativeTime && onScheduleSelected) {
      onScheduleSelected({
        days: [selectedAlternativeTime.day],
        startTime: selectedAlternativeTime.startTime,
        endTime: selectedAlternativeTime.endTime,
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-lg font-medium flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Alternative Time Slots
          </DialogTitle>
          <DialogDescription>
            Select an alternative time slot to resolve scheduling conflicts.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 flex-1 overflow-y-auto">
          <p className="text-sm text-gray-600 mb-4">
            We've generated some alternative time slots to help resolve the
            scheduling conflicts. Select one of the options below:
          </p>

          {loading ? (
            // Loading state
            <>
              <Skeleton className="w-full h-24 mb-3" />
              <Skeleton className="w-full h-24 mb-3" />
              <Skeleton className="w-full h-24" />
            </>
          ) : conflicts.alternativeTimes &&
            conflicts.alternativeTimes.length > 0 ? (
            // If alternativeTimes is provided, show those
            conflicts.alternativeTimes.map((time, index) => (
              <AlternativeTimeCard
                key={index}
                time={time}
                onSelect={handleSelectAlternativeTime}
                isSelected={selectedAlternativeTime === time}
              />
            ))
          ) : recommendations.length > 0 ? (
            // Otherwise, show generated recommendations
            recommendations.map((recommendation, index) => (
              <RecommendationCard
                key={index}
                recommendation={recommendation}
                onSelect={handleSelectRecommendation}
                isSelected={selectedRecommendation === recommendation}
              />
            ))
          ) : (
            // No recommendations found
            <div className="text-center py-8">
              <div className="flex flex-col items-center gap-2">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <p className="text-gray-500">
                  No alternative time slots available. Please try different days
                  or modify your request.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 pb-6 pt-2 border-t flex justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selectedRecommendation && !selectedAlternativeTime}
            onClick={handleConfirm}
            className="flex items-center gap-2"
          >
            Apply Time Change
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleRecommendation;
