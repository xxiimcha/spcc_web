import React, { useState, useEffect } from "react";
import { Plus, Settings, Calendar, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EnhancedScheduleForm from "@/components/scheduling/EnhancedScheduleForm";
import SystemSettings from "@/components/admin/SystemSettings";
import { useAuth } from "@/contexts/AuthContext";

const EnhancedScheduling = () => {
  const { isAdmin } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [systemSettings, setSystemSettings] = useState({
    schoolYear: "2024-2025",
    semester: "First Semester",
  });

  // Load system settings on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("systemSettings");
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setSystemSettings(settings);
    }
  }, []);

  const handleSettingsChange = (settings: {
    schoolYear: string;
    semester: string;
  }) => {
    setSystemSettings(settings);
  };

  const handleScheduleSubmit = (values: any) => {
    console.log("Schedule created:", values);
    setIsFormOpen(false);
    // Here you would typically refresh the schedule list or show a success message
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Enhanced Scheduling System
          </h1>
          <p className="text-gray-600 mt-2">
            Intelligent scheduling with conflict detection and room management
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Current Period:</span>
                <span className="text-blue-700">
                  {systemSettings.schoolYear} - {systemSettings.semester}
                </span>
              </div>
            </CardContent>
          </Card>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Schedule
          </Button>
        </div>
      </div>

      <Tabs defaultValue="scheduling" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scheduling" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Schedule Management
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System Settings
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="scheduling" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Schedules
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">24</div>
                <p className="text-xs text-gray-500">Active this semester</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Available Rooms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">12</div>
                <p className="text-xs text-gray-500">Ready for scheduling</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Sections with Rooms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">8</div>
                <p className="text-xs text-gray-500">Ready for scheduling</p>
              </CardContent>
            </Card>
          </div>

          {/* Features Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Enhanced Scheduling Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-semibold text-green-700">
                    ✅ Smart Conflict Detection
                  </h4>
                  <p className="text-sm text-gray-600">
                    Automatically detects professor, room, and section conflicts
                    with clear solutions.
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-green-700">
                    ✅ Room-Assigned Sections Only
                  </h4>
                  <p className="text-sm text-gray-600">
                    Only shows sections that have assigned rooms, preventing
                    scheduling errors.
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-green-700">
                    ✅ Real-time Available Slots
                  </h4>
                  <p className="text-sm text-gray-600">
                    Shows available time slots based on existing schedules and
                    conflicts.
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-green-700">
                    ✅ Admin-Controlled Periods
                  </h4>
                  <p className="text-sm text-gray-600">
                    School year and semester are managed by administrators only.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="settings">
            <SystemSettings onSettingsChange={handleSettingsChange} />
          </TabsContent>
        )}
      </Tabs>

      {/* Enhanced Schedule Form */}
      <EnhancedScheduleForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleScheduleSubmit}
        schoolYear={systemSettings.schoolYear}
        semester={systemSettings.semester}
      />
    </div>
  );
};

export default EnhancedScheduling;
