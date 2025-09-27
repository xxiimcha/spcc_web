export interface Professor {
  id: string;
  name: string;
  subjectCount: number;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
}

export interface Room {
  id: string;
  number: string;
  type: "Lecture" | "Laboratory";
  capacity: number;
}

export interface Section {
  id: string;
  name: string;
  grade_level: "11" | "12";
  strand: string;
  number_of_students: number;
  rooms: Room[];
}

export interface TimeSlot {
  start_time: string;
  end_time: string;
  display: string;
}

export interface ConflictInfo {
  type: "professor" | "room" | "section";
  message: string;
  conflictingDays: string[];
}
