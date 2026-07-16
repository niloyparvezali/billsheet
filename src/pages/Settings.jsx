import { useMemo } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import SettingsPanel from "../components/settings/SettingsPanel";

export default function Settings() {
  const { user } = useAuth();

  const handleSave = () => {
    toast.success("Changes saved");
  };

  return <SettingsPanel user={user} onSave={handleSave} />;
}
