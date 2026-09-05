import * as React from "react";

// Simple bot icon with stars background
export const BotMessageSquare = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width={props.width || 32} height={props.height || 32} viewBox="0 0 32 32" fill="none" {...props}>
    <rect x="0" y="0" width="32" height="32" rx="16" fill="#18181b" />
    <circle cx="8" cy="8" r="1.5" fill="#fff" opacity="0.7">
      <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
    </circle>
    <circle cx="24" cy="10" r="1" fill="#fff" opacity="0.5">
      <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
    </circle>
    <circle cx="20" cy="24" r="1.2" fill="#fff" opacity="0.6">
      <animate attributeName="opacity" values="0.6;1;0.6" dur="2.2s" repeatCount="indefinite" />
    </circle>
    <rect x="7" y="11" width="18" height="12" rx="4" fill="#222" stroke="#fff" strokeWidth="1.5" />
    <rect x="11" y="15" width="10" height="4" rx="2" fill="#fff" />
    <circle cx="13" cy="17" r="0.7" fill="#18181b" />
    <circle cx="19" cy="17" r="0.7" fill="#18181b" />
  </svg>
);

export default BotMessageSquare;
