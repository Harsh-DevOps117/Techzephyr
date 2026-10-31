import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
const Icon = ({ children, ...props }: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
export const GridIcon = (p: IconProps) => <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></Icon>;
export const CalendarIcon = (p: IconProps) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></Icon>;
export const DatabaseIcon = (p: IconProps) => <Icon {...p}><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></Icon>;
export const WrenchIcon = (p: IconProps) => <Icon {...p}><path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5l-8.7 8.7a2.1 2.1 0 0 0 3 3z"/></Icon>;
export const SparkIcon = (p: IconProps) => <Icon {...p}><path d="m12 3 1.4 4.2L18 9l-4.6 1.8L12 15l-1.4-4.2L6 9l4.6-1.8zM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"/></Icon>;
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="m5 12 4 4L19 6"/></Icon>;
export const UploadIcon = (p: IconProps) => <Icon {...p}><path d="M12 16V4m0 0L7 9m5-5 5 5M4 20h16"/></Icon>;
export const BriefcaseIcon = (p: IconProps) => <Icon {...p}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2"/></Icon>;
export const MenuIcon = (p: IconProps) => <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16"/></Icon>;
export const ArrowIcon = (p: IconProps) => <Icon {...p}><path d="M5 12h14m-5-5 5 5-5 5"/></Icon>;
export const AlertIcon = (p: IconProps) => <Icon {...p}><path d="M12 3 2.8 20h18.4zM12 9v4m0 4h.01"/></Icon>;
