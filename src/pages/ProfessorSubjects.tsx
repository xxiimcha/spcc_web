// src/pages/ProfessorSubjects.tsx
import React, { useState } from "react";
import { BookOpen, Search, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const demoSubjects = [
  { id: 1, code: "IT101", name: "Introduction to Computing", units: 3, semester: "1st", year: "1st" },
  { id: 2, code: "IT201", name: "Data Structures and Algorithms", units: 3, semester: "2nd", year: "2nd" },
  { id: 3, code: "IT301", name: "Database Management Systems", units: 3, semester: "1st", year: "3rd" },
  { id: 4, code: "IT401", name: "Capstone Project 1", units: 3, semester: "1st", year: "4th" },
];

const ProfessorSubjects: React.FC = () => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  const toggleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const filtered = demoSubjects.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.code.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            My Subjects
          </h1>
          <p className="text-sm text-muted-foreground">
            Select the subjects you want to handle this semester.
          </p>
        </div>
        <Button disabled={selected.length === 0}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Confirm Selection
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by subject name or code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Subject List */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
        {filtered.map((subj) => {
          const isSelected = selected.includes(subj.id);
          return (
            <Card
              key={subj.id}
              className={`cursor-pointer border transition ${
                isSelected ? "border-blue-600 ring-1 ring-blue-300" : ""
              }`}
              onClick={() => toggleSelect(subj.id)}
            >
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{subj.code}</span>
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium mb-1">{subj.name}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{subj.units} units</Badge>
                  <Badge variant="outline">{subj.semester} sem</Badge>
                  <Badge variant="outline">{subj.year} year</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-8">
            No subjects found.
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfessorSubjects;
