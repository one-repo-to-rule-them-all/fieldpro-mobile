/// <reference types="nativewind/types" />

// lucide-react-native ships broken typings in some releases.
// This ambient declaration provides correct types until the package is updated.
declare module "lucide-react-native" {
  import type { SvgProps } from "react-native-svg";

  export interface LucideProps extends SvgProps {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
  }

  export type LucideIcon = (props: LucideProps) => JSX.Element;

  // Icons used in this project
  export const MapPin: LucideIcon;
  export const LogIn: LucideIcon;
  export const LogOut: LucideIcon;
  export const Check: LucideIcon;
  export const RotateCcw: LucideIcon;
  export const SkipForward: LucideIcon;
  export const X: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const MoreHorizontal: LucideIcon;
  export const Clock: LucideIcon;
  export const Briefcase: LucideIcon;
  export const User: LucideIcon;
  export const Settings: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const Navigation: LucideIcon;
}
