import React, { useEffect, useState, useCallback } from "react";
import SummaryMetrics from "@/components/dashboard/SummaryMetrics";
import Reports from "@/components/dashboard/Reports";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiService } from "@/services/apiService";
import AuthTest from "@/components/AuthTest";

interface Activity {
  id: number;
  description: string;
  timestamp: string;
  type: string;
}

interface WorkloadAlert {
  professor_name: string;
  subject_count: number;
  alert_level: "high" | "max";
}

const DATA_UPDATED_EVENT = "dashboardDataUpdated";

export const triggerDashboardUpdate = () => {
  const event = new CustomEvent(DATA_UPDATED_EVENT);
  window.dispatchEvent(event);
};

const Dashboard = () => {
  const { user, isAuthenticated, isSchoolHead } = useAuth();
  const navigate = useNavigate();

  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [workloadAlerts, setWorkloadAlerts] = useState<WorkloadAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const activitiesResponse = await apiService.getDashboardActivities();
      if (activitiesResponse.success) {
        setRecentActivities(activitiesResponse.data?.data || []);
      }

      const alertsResponse = await apiService.getDashboardWorkload();
      if (alertsResponse.success) {
        setWorkloadAlerts(alertsResponse.data?.data || []);
      }

      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load some dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/pages/login");
    } else {
      fetchDashboardData();

      const handleDataUpdated = () => {
        fetchDashboardData();
      };

      window.addEventListener(DATA_UPDATED_EVENT, handleDataUpdated);

      const intervalId = setInterval(() => {
        fetchDashboardData();
      }, 30000);

      return () => {
        window.removeEventListener(DATA_UPDATED_EVENT, handleDataUpdated);
        clearInterval(intervalId);
      };
    }
  }, [navigate, fetchDashboardData, isAuthenticated]);

  const formatActivityDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getActivityBorderColor = (type: string) => {
    switch (type) {
      case "professor":
        return "border-blue-500";
      case "subject":
        return "border-green-500";
      case "schedule":
        return "border-amber-500";
      case "room":
        return "border-orange-500";
      case "section":
        return "border-rose-500";
      default:
        return "border-gray-500";
    }
  };

  const handleManualRefresh = () => {
    fetchDashboardData();
  };

  const getRoleDisplayName = (role: string | null) => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "school_head":
        return "School Head";
      default:
        return "User";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          {user && (
            <p className="text-sm text-gray-600 mt-1">
              Welcome, {getRoleDisplayName(user.role)}! You have full access to
              the scheduling system.
            </p>
          )}
        </div>
        {isSchoolHead && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700 font-medium">
              🎓 School Head Access
            </p>
            <p className="text-xs text-blue-600">
              You can manage schedules, view reports, and oversee operations
            </p>
          </div>
        )}
      </div>

      <SummaryMetrics refreshData={fetchDashboardData} />

      <Reports />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Recent Activities</h2>

          {loading ? (
            <p className="text-gray-500">Loading activities...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : recentActivities.length === 0 ? (
            <p className="text-gray-500">No recent activities found</p>
          ) : (
            <div className="space-y-4">
              {recentActivities.slice(0, 3).map((activity) => (
                <div
                  key={activity.id}
                  className={`border-l-4 ${getActivityBorderColor(
                    activity.type
                  )} pl-4 py-2`}
                >
                  <p className="text-sm text-muted-foreground">
                    {formatActivityDate(activity.timestamp)}
                  </p>
                  <p className="font-medium">{activity.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Workload Alerts</h2>

          {loading ? (
            <p className="text-gray-500">Loading workload alerts...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : workloadAlerts.length === 0 ? (
            <p className="text-gray-500">No workload alerts found</p>
          ) : (
            <div className="space-y-4">
              {workloadAlerts.map((alert, index) => (
                <div
                  key={`alert-${index}-${alert.professor_name}`}
                  className={`${
                    alert.alert_level === "max"
                      ? "bg-red-50 border border-red-200"
                      : "bg-amber-50 border border-amber-200"
                  } rounded-md p-4`}
                >
                  <p
                    className={`font-medium ${
                      alert.alert_level === "max"
                        ? "text-red-700"
                        : "text-amber-700"
                    }`}
                  >
                    {alert.alert_level === "max"
                      ? "Maximum Workload Reached"
                      : "High Workload Warning"}
                  </p>
                  <p
                    className={`text-sm ${
                      alert.alert_level === "max"
                        ? "text-red-600"
                        : "text-amber-600"
                    }`}
                  >
                    {alert.professor_name} has {alert.subject_count} subjects
                    assigned
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Role-specific quick actions 
      {isSchoolHead && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-2">
                📊 View Reports
              </h3>
              <p className="text-sm text-blue-600 mb-3">
                Access detailed scheduling reports and analytics
              </p>
              <button className="text-sm text-blue-700 hover:text-blue-800 font-medium">
                View Reports →
              </button>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-semibold text-green-800 mb-2">
                📅 Manage Schedules
              </h3>
              <p className="text-sm text-green-600 mb-3">
                Create and modify class schedules
              </p>
              <button className="text-sm text-green-700 hover:text-green-800 font-medium">
                Manage Schedules →
              </button>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h3 className="font-semibold text-purple-800 mb-2">
                👥 Faculty Overview
              </h3>
              <p className="text-sm text-purple-600 mb-3">
                Monitor faculty workload and assignments
              </p>
              <button className="text-sm text-purple-700 hover:text-purple-800 font-medium">
                View Faculty →
              </button>
            </div>
          </div>
        </div>
      )}
       */}
    </div>
  );
};

export default Dashboard;
