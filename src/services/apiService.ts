import axios, { AxiosResponse } from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost/spcc_database";

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error("❌ API Request Error:", error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error("❌ API Response Error:", error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export interface ApiResponse<T = any> {
  success?: boolean;
  status?: string;
  message?: string;
  data?: T;
  error?: string;
}

export interface Subject {
  subj_id: number;
  subj_name: string;
  subj_code: string;
  subj_units: number;
  subj_type: string;
  subj_hours_per_week: number;
}

export interface Professor {
  prof_id: number;
  prof_name: string;
  prof_email?: string;
  prof_contact?: string;
}

export interface Room {
  room_id: number;
  room_number: string;
  room_type: string;
  room_capacity: number;
}

export interface Section {
  section_id: number;
  section_name: string;
  section_year_level: string;
  section_course: string;
  assigned_room?: number;
}

export interface Schedule {
  schedule_id?: number;
  school_year: string;
  semester: string;
  subj_id: number;
  prof_id: number;
  section_id: number;
  room_id?: number;
  schedule_type: "Onsite" | "Online";
  start_time: string;
  end_time: string;
  days: string[];
}

class ApiService {
  async makeRequest<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    endpoint: string,
    data?: any
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse = await apiClient({ method, url: endpoint, data });
      return {
        success: response.data.status === "success" || response.data.success === true,
        status: response.data.status,
        message: response.data.message,
        data: (response.data?.data ?? response.data) as T,
      };
    } catch (error) {
      console.error(`API Error (${method} ${endpoint}):`, error);
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          status: "error",
          message: error.response?.data?.message || error.message,
          error: error.response?.data?.error || error.message,
        };
      }
      return {
        success: false,
        status: "error",
        message: "An unexpected error occurred",
        error: String(error),
      };
    }
  }

  async getSubjects(): Promise<ApiResponse<Subject[]>> {
    const response = await this.makeRequest<any>("GET", "/subjects.php");
    return { ...response, data: response.data?.subjects || response.data?.data || response.data || [] };
  }

  async createSubject(subject: Omit<Subject, "subj_id">): Promise<ApiResponse<Subject>> {
    return this.makeRequest<Subject>("POST", "/subjects.php", subject);
  }

  async updateSubject(id: number, subject: Partial<Subject>): Promise<ApiResponse<Subject>> {
    return this.makeRequest<Subject>("PUT", `/subjects.php?id=${id}`, subject);
  }

  async deleteSubject(id: number): Promise<ApiResponse> {
    return this.makeRequest("DELETE", `/subjects.php?id=${id}`);
  }

  async getProfessors(): Promise<ApiResponse<Professor[]>> {
    const response = await this.makeRequest<any>("GET", "/professors.php");
    return { ...response, data: response.data?.professors || response.data?.data || response.data || [] };
  }

  async createProfessor(professor: Omit<Professor, "prof_id">): Promise<ApiResponse<Professor>> {
    return this.makeRequest<Professor>("POST", "/professors.php", professor);
  }

  async updateProfessor(id: number, professor: Partial<Professor>): Promise<ApiResponse<Professor>> {
    return this.makeRequest<Professor>("PUT", `/professors.php?id=${id}`, professor);
  }

  async deleteProfessor(id: number): Promise<ApiResponse> {
    return this.makeRequest("DELETE", `/professors.php?id=${id}`);
  }

  async getRooms(): Promise<ApiResponse<Room[]>> {
    const response = await this.makeRequest<any>("GET", "/rooms.php");
    return { ...response, data: response.data?.rooms || response.data?.data || response.data || [] };
  }

  async createRoom(room: Omit<Room, "room_id">): Promise<ApiResponse<Room>> {
    return this.makeRequest<Room>("POST", "/rooms.php", room);
  }

  async updateRoom(id: number, room: Partial<Room>): Promise<ApiResponse<Room>> {
    return this.makeRequest<Room>("PUT", `/rooms.php?id=${id}`, room);
  }

  async deleteRoom(id: number): Promise<ApiResponse> {
    return this.makeRequest("DELETE", `/rooms.php?id=${id}`);
  }

  async getSections(): Promise<ApiResponse<Section[]>> {
    const response = await this.makeRequest<any>("GET", "/sections.php");
    return { ...response, data: response.data?.sections || response.data?.data || response.data || [] };
  }

  async getRoomAssignedSections(): Promise<ApiResponse<Section[]>> {
    const response = await this.makeRequest<any>("GET", "/get_room_assigned_sections.php");
    return { ...response, data: response.data?.sections || response.data?.data || response.data || [] };
  }

  async createSection(section: Omit<Section, "section_id">): Promise<ApiResponse<Section>> {
    return this.makeRequest<Section>("POST", "/sections.php", section);
  }

  async updateSection(id: number, section: Partial<Section>): Promise<ApiResponse<Section>> {
    return this.makeRequest<Section>("PUT", `/sections.php?id=${id}`, section);
  }

  async deleteSection(id: number): Promise<ApiResponse> {
    return this.makeRequest("DELETE", `/sections.php?id=${id}`);
  }

  async getSchedules(filters?: { school_year?: string; semester?: string; professor_id?: number }): Promise<ApiResponse<Schedule[]>> {
    const queryParams = new URLSearchParams();
    if (filters?.school_year) queryParams.append("school_year", filters.school_year);
    if (filters?.semester) queryParams.append("semester", filters.semester);
    if (filters?.professor_id) queryParams.append("professor_id", String(filters.professor_id));
    const url = `/schedule.php${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const response = await this.makeRequest<any>("GET", url);
    return { ...response, data: response.data?.schedules || response.data?.data || response.data || [] };
  }

  async bulkUploadSubjects(formData: FormData): Promise<ApiResponse> {
    try {
      const response = await apiClient.post("/subjects_bulk_upload.php", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });
      return {
        success: response.data?.status === "success" || response.data?.success === true,
        status: response.data?.status,
        message: response.data?.message,
        data: response.data?.data ?? response.data,
      };
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          status: "error",
          message: error.response?.data?.message || error.message,
          error: error.response?.data?.error || error.message,
        };
      }
      return { success: false, status: "error", message: "An unexpected error occurred", error: String(error) };
    }
  }

  async createSchedule(schedule: Omit<Schedule, "schedule_id">): Promise<ApiResponse<Schedule>> {
    const result = await this.makeRequest<Schedule>("POST", "/schedule.php", schedule);
    if (result.success) {
      try {
        await this.syncToFirebase();
      } catch (error) {
        console.warn("Failed to sync to Firebase after schedule creation:", error);
      }
    }
    return result;
  }

  async updateSchedule(id: number, schedule: Partial<Schedule>): Promise<ApiResponse<Schedule>> {
    const result = await this.makeRequest<Schedule>("PUT", `/schedule.php?id=${id}`, schedule);
    if (result.success) {
      try {
        await this.syncToFirebase();
      } catch (error) {
        console.warn("Failed to sync to Firebase after schedule update:", error);
      }
    }
    return result;
  }

  async deleteSchedule(id: number): Promise<ApiResponse> {
    const result = await this.makeRequest("DELETE", `/schedule.php?id=${id}`);
    if (result.success) {
      try {
        await this.syncToFirebase();
      } catch (error) {
        console.warn("Failed to sync to Firebase after schedule deletion:", error);
      }
    }
    return result;
  }

  async getAvailableTimeSlots(data: {
    school_year: string;
    semester: string;
    days: string[];
    prof_id?: number;
    room_id?: number;
    section_id?: number;
  }): Promise<ApiResponse> {
    return this.makeRequest("POST", "/get_available_time_slots.php", data);
  }

  async checkConflicts(data: {
    school_year: string;
    semester: string;
    days: string[];
    prof_id: number;
    room_id?: number;
    section_id: number;
    start_time: string;
    end_time: string;
  }): Promise<ApiResponse> {
    return this.makeRequest("POST", "/enhanced_conflict_detection.php", data);
  }

  async validateTimeSlots(data: Schedule): Promise<ApiResponse> {
    return this.makeRequest("POST", "/validate_time_slots.php", data);
  }

  async getSchoolHeads(): Promise<ApiResponse> {
    return this.makeRequest("GET", "/school_head.php");
  }

  async createSchoolHead(data: any): Promise<ApiResponse> {
    return this.makeRequest("POST", "/school_head.php", data);
  }

  async updateSchoolHead(id: number, data: any): Promise<ApiResponse> {
    return this.makeRequest("PUT", `/school_head.php?id=${id}`, data);
  }

  async deleteSchoolHead(id: number): Promise<ApiResponse> {
    return this.makeRequest("DELETE", `/school_head.php?id=${id}`);
  }

  async getDashboardActivities(): Promise<ApiResponse> {
    return this.makeRequest("GET", "/dashboard_activities.php");
  }

  async getDashboardMetrics(): Promise<ApiResponse> {
    return this.makeRequest("GET", "/dashboard_metrics.php");
  }

  async getDashboardWorkload(): Promise<ApiResponse> {
    return this.makeRequest("GET", "/dashboard_workload.php");
  }

  async testConnection(): Promise<ApiResponse> {
    return this.makeRequest("GET", "/test_connection_simple.php");
  }

  async getSubjectProfessors(subjectId: number): Promise<ApiResponse> {
    return this.makeRequest("GET", `/get_subject_professors.php?subject_id=${subjectId}`);
  }

  async getListOfSubjects(professorId?: number): Promise<ApiResponse> {
    const url = professorId ? `/get_list_of_subjects.php?professor_id=${professorId}` : "/get_list_of_subjects.php";
    return this.makeRequest("GET", url);
  }

  async getListOfSections(): Promise<ApiResponse> {
    return this.makeRequest("GET", "/get_list_of_sections.php");
  }

  async getTeachersWithoutSubjects(): Promise<ApiResponse> {
    return this.makeRequest("GET", "/get_teachers_without_subjects.php");
  }

  async getSubjectsWithoutRooms(): Promise<ApiResponse> {
    return this.makeRequest("GET", "/get_subjects_without_rooms.php");
  }

  async optimizeSchedule(optimizationData: any): Promise<ApiResponse> {
    return this.makeRequest("POST", "/advanced_schedule_optimizer.php", optimizationData);
  }

  async syncToFirebase(): Promise<ApiResponse> {
    return this.makeRequest("GET", "/sync_schedules_only.php");
  }

  async manualSyncToFirebase(): Promise<ApiResponse> {
    return this.makeRequest("GET", "/manual_sync.php");
  }

  async analyzeWorkload(schoolYear: string, semester: string): Promise<ApiResponse> {
    return this.makeRequest("POST", "/workload_balancer.php", {
      action: "analyze",
      school_year: schoolYear,
      semester: semester,
    });
  }

  async balanceWorkload(schoolYear: string, semester: string, options: any = {}): Promise<ApiResponse> {
    return this.makeRequest("POST", "/workload_balancer.php", {
      action: "balance",
      school_year: schoolYear,
      semester: semester,
      options,
    });
  }

  async getWorkloadRecommendations(schoolYear: string, semester: string): Promise<ApiResponse> {
    return this.makeRequest("POST", "/workload_balancer.php", {
      action: "recommendations",
      school_year: schoolYear,
      semester: semester,
    });
  }
}

export const apiService = new ApiService();
export default apiService;
