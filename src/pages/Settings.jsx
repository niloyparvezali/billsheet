import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import SettingsPanel from "../components/settings/SettingsPanel";
import { exportBackup } from "../utils/backup/exportBackup";

export default function Settings() {
  const { user } = useAuth();

  const handleSave = () => {
    toast.success("Changes saved");
  };

  const handleExportBackup = async () => {
    if (!user) return;

    try {
      await exportBackup(user);
      toast.success("Backup exported successfully.");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Could not export backup.");
    }
  };

  return (
    <SettingsPanel
      user={user}
      onSave={handleSave}
      onExportBackup={handleExportBackup}
    />
  );
}
