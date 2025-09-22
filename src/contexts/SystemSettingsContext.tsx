import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export interface SystemSettings {
  schoolYear: string;
  semester: string;
}

interface SystemSettingsContextType {
  settings: SystemSettings;
  updateSettings: (newSettings: SystemSettings) => void;
  isLoading: boolean;
}

const SystemSettingsContext = createContext<
  SystemSettingsContextType | undefined
>(undefined);

// Default settings
const DEFAULT_SETTINGS: SystemSettings = {
  schoolYear: "2024-2025",
  semester: "First Semester",
};

interface SystemSettingsProviderProps {
  children: ReactNode;
}

export const SystemSettingsProvider: React.FC<SystemSettingsProviderProps> = ({
  children,
}) => {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from localStorage on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);

      // Try to load from localStorage first
      const savedSettings = localStorage.getItem("systemSettings");
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
      } else {
        // If no saved settings, use defaults and save them
        setSettings(DEFAULT_SETTINGS);
        localStorage.setItem(
          "systemSettings",
          JSON.stringify(DEFAULT_SETTINGS)
        );
      }
    } catch (error) {
      console.error("Error loading system settings:", error);
      // Fallback to defaults if there's an error
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = (newSettings: SystemSettings) => {
    try {
      // Update state
      setSettings(newSettings);

      // Save to localStorage
      localStorage.setItem("systemSettings", JSON.stringify(newSettings));

      // In a real application, you might also want to save to a backend API
      // await apiService.updateSystemSettings(newSettings);

      console.log("System settings updated:", newSettings);
    } catch (error) {
      console.error("Error updating system settings:", error);
    }
  };

  const value = {
    settings,
    updateSettings,
    isLoading,
  };

  return (
    <SystemSettingsContext.Provider value={value}>
      {children}
    </SystemSettingsContext.Provider>
  );
};

// Custom hook to use the system settings context
export const useSystemSettings = (): SystemSettingsContextType => {
  const context = useContext(SystemSettingsContext);

  if (context === undefined) {
    throw new Error(
      "useSystemSettings must be used within a SystemSettingsProvider"
    );
  }

  return context;
};

// Helper hook to get current academic period
export const useCurrentAcademicPeriod = () => {
  const { settings } = useSystemSettings();

  return {
    schoolYear: settings.schoolYear,
    semester: settings.semester,
    academicPeriod: `${settings.schoolYear} - ${settings.semester}`,
  };
};
