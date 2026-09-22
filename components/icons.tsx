import type { SVGProps } from "react";

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}

export const RefreshIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 1-2.1-5"/></Icon>;
export const BuildingIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M4 21V5l8-3v19"/><path d="M12 8h8v13"/><path d="M8 7v1M8 11v1M8 15v1M16 12v1M16 16v1M2 21h20"/></Icon>;
export const TrendIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/></Icon>;
export const ClockIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>;
export const AlertIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M10.3 3.7 2.2 18a2 2 0 0 0 1.8 3h16a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></Icon>;
export const SearchIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></Icon>;
export const ChevronIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="m8 10 4 4 4-4"/></Icon>;
