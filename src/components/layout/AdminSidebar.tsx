import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Shield,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  BarChart3,
  FileDown,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  path: string;
  active?: boolean;
  isOpen: boolean;
}

const NavItem = ({ icon, label, path, active = false, isOpen }: NavItemProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link to={path} className="w-full">
            <Button
              variant={active ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 mb-1 text-left",
                active ? "bg-secondary font-medium" : "text-muted-foreground",
                !isOpen && "justify-center px-2"
              )}
            >
              {icon}
              {isOpen && <span>{label}</span>}
              {active && isOpen && <ChevronRight className="ml-auto h-4 w-4" />}
            </Button>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

interface AdminSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

// Helper function: build current + 3 previous school years
const getSchoolYears = () => {
  const now = new Date();
  const currentStartYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  const years: string[] = [];
  for (let i = 0; i <= 3; i++) {
    const start = currentStartYear - i;
    years.push(`${start}-${start + 1}`);
  }
  return years;
};

const AdminSidebar = ({ isOpen, onToggle }: AdminSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const currentPath = location.pathname;

  const [exportOpen, setExportOpen] = useState(false);
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [selectedSY, setSelectedSY] = useState<string>("");

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "https://spcc-scheduler.site";

  const handleLogout = () => {
    logout();
    navigate("/pages/login");
  };

  // Populate school years locally when opening export dialog
  useEffect(() => {
    if (exportOpen) {
      const list = getSchoolYears();
      setSchoolYears(list);
      if (!selectedSY && list.length) setSelectedSY(list[0]);
    }
  }, [exportOpen]);

  const handleExport = async () => {
    if (!selectedSY) {
      toast({ variant: "destructive", title: "Please select a school year" });
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/export_all.php?school_year=${encodeURIComponent(selectedSY)}`
      );
      if (!res.ok) throw new Error("Failed to download file");

      const blob = await res.blob();
      const fileName = `SPCC_Compiled_${selectedSY}.xlsx`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast({
        title: "Export started",
        description: `Downloading ${fileName}`,
      });

      setExportOpen(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Unable to generate file. Please try again.",
      });
    }
  };

  return (
    <div
      className={cn(
        "h-full bg-background border-r flex flex-col transition-all duration-300",
        isOpen ? "w-[280px]" : "w-[80px]"
      )}
    >
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-8 w-8 rounded-md bg-red-600 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          {isOpen && <h1 className="font-bold text-xl text-red-600">Admin Panel</h1>}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="ml-auto p-0 h-8 w-8"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <nav className="space-y-1">
          <NavItem
            icon={<BarChart3 className="h-5 w-5" />}
            label="Dashboard"
            path="/admin"
            active={currentPath === "/admin"}
            isOpen={isOpen}
          />

          <NavItem
            icon={<Settings className="h-5 w-5" />}
            label="System Settings"
            path="/admin/settings"
            active={currentPath === "/admin/settings"}
            isOpen={isOpen}
          />

          {/* Export Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3 mb-1 text-left text-muted-foreground",
                    !isOpen && "justify-center px-2"
                  )}
                  onClick={() => setExportOpen(true)}
                >
                  <FileDown className="h-5 w-5" />
                  {isOpen && <span>Export Data</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Export Data</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </nav>
      </div>

      <div className="mt-auto p-4 border-t">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=admin" />
            <AvatarFallback className="bg-red-600 text-white">AD</AvatarFallback>
          </Avatar>
          {isOpen && (
            <div>
              <p className="text-sm font-medium">
                {user?.name || user?.username || "Admin User"}
              </p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 text-muted-foreground mt-4",
            !isOpen && "justify-center px-2"
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          {isOpen && <span>Logout</span>}
        </Button>
      </div>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Export Compiled Data</DialogTitle>
            <DialogDescription>
              Select a school year to download all recorded data as an Excel file.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <label className="text-sm font-medium">School Year</label>
            <Select value={selectedSY} onValueChange={setSelectedSY}>
              <SelectTrigger>
                <SelectValue placeholder="Select school year" />
              </SelectTrigger>
              <SelectContent>
                {schoolYears.map((sy) => (
                  <SelectItem key={sy} value={sy}>
                    {sy}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={!selectedSY}>
              Download Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSidebar;
