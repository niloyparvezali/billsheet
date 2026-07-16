import {
  AlertTriangle,
  BadgeCheck,
  BellRing,
  Blocks,
  BookOpen,
  Building2,
  CircleDollarSign,
  CloudUpload,
  Code2,
  CreditCard,
  Database,
  Info,
  LayoutDashboard,
  Lock,
  Palette,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";

export const settingsSections = [
  { id: "general", label: "General", description: "Workspace defaults and shared actions", icon: Settings2 },
  { id: "profile", label: "Profile", description: "Identity, organization, and role context", icon: UserRound },
  { id: "appearance", label: "Appearance", description: "Visual language and workspace rhythm", icon: Palette },
  { id: "security", label: "Security", description: "Protection, access, and risk posture", icon: ShieldCheck },
  { id: "billing", label: "Billing", description: "Plans, invoices, and policy defaults", icon: CircleDollarSign },
  { id: "payments", label: "Payments", description: "Settlement workflows and payment rules", icon: CreditCard },
  { id: "notifications", label: "Notifications", description: "Channels, alerts, and digests", icon: BellRing },
  { id: "application", label: "Application", description: "Feature flags and connected tools", icon: LayoutDashboard },
  { id: "backup", label: "Backup & Restore", description: "Recovery, imports, and retention", icon: CloudUpload },
  { id: "advanced", label: "Advanced", description: "Developer controls and experiments", icon: Code2 },
  { id: "about", label: "About", description: "Product information and support", icon: Info },
  { id: "danger", label: "Danger Zone", description: "High impact account actions", icon: AlertTriangle },
];

export const quickFilters = ["All", "Security", "Billing", "Workspace"];

export const toastCopy = {
  saved: "Settings saved and synced",
  reset: "Changes reverted to defaults",
};
