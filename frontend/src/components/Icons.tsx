import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z" />
      <path d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" />
    </Svg>
  );
}

export function IconHistory(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 12a9 9 0 1 0 2.6-6.4" />
      <path d="M3 4v4.5h4.5" />
      <path d="M12 8v4.2l2.8 1.8" />
    </Svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a7 7 0 0 0 11.1 11.1Z" />
    </Svg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" />
    </Svg>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v11" />
      <path d="M7.5 9.5 12 14l4.5-4.5" />
      <path d="M4 16.5V18a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1.5" />
    </Svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10.3 4.3 2.7 17.5A2 2 0 0 0 4.4 20.5h15.2a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4.5" />
      <path d="M12 17h.01" />
    </Svg>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l7 3v5.4c0 4.4-2.9 8.3-7 9.6-4.1-1.3-7-5.2-7-9.6V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 1.8" />
    </Svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </Svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12h15" />
      <path d="m14 7 5 5-5 5" />
    </Svg>
  );
}

export function IconArrowLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 12H5" />
      <path d="m10 7-5 5 5 5" />
    </Svg>
  );
}

export function IconArrowUpRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </Svg>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 11a8 8 0 0 0-14.5-4.6L3.5 8.5" />
      <path d="M3.5 4v4.5H8" />
      <path d="M4 13a8 8 0 0 0 14.5 4.6l2-2.1" />
      <path d="M20.5 20v-4.5H16" />
    </Svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconTarget(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconDumbbell(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 7.5v9M3.5 9.5v5M17.5 7.5v9M20.5 9.5v5M6.5 12h11" />
      <path d="M4.5 12h1M18.5 12h1" />
    </Svg>
  );
}

export function IconInbox(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 13.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7.5" />
      <path d="M4 13.5h4l1.5 2h5l1.5-2h4V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4.5Z" />
    </Svg>
  );
}

export function IconLayers(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
      <path d="m4 12.2 8 4.5 8-4.5" />
      <path d="m4 16.7 8 4.5 8-4.5" />
    </Svg>
  );
}

export function IconLightbulb(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2V17h5v-1c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z" />
    </Svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Svg>
  );
}

export function IconLogOut(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M15 8l4 4-4 4" />
      <path d="M19 12H9" />
    </Svg>
  );
}

export function IconKey(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8-8" />
      <path d="m16 7 2 2" />
      <path d="m18 5 2 2" />
    </Svg>
  );
}

export function IconMonitor(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Svg>
  );
}
