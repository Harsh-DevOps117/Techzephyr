import {
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CalendarRange,
  Check,
  CircleAlert,
  ClipboardCheck,
  Database,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeft,
  Upload,
  Wrench,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

function icon(Icon: LucideIcon) {
  return function AppIcon(props: LucideProps) {
    return <Icon aria-hidden strokeWidth={1.75} {...props} />;
  };
}

export const GridIcon = icon(LayoutGrid);
export const CalendarIcon = icon(Calendar);
export const EventIcon = icon(CalendarRange);
export const DatabaseIcon = icon(Database);
export const WrenchIcon = icon(Wrench);
export const VenueIcon = icon(Building2);
export const MessageIcon = icon(MessageSquare);
export const CheckIcon = icon(Check);
export const UploadIcon = icon(Upload);
export const BriefcaseIcon = icon(Briefcase);
export const MenuIcon = icon(Menu);
export const CloseIcon = icon(X);
export const ArrowIcon = icon(ArrowRight);
export const AlertIcon = icon(CircleAlert);
export const PanelIcon = icon(PanelLeft);
export const LogoutIcon = icon(LogOut);
export const ApprovalIcon = icon(ClipboardCheck);
