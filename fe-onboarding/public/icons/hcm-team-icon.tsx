import { NextPage } from "next";

interface Props {
  active?: boolean;
}

const HcmTeamICon: NextPage<Props> = ({ active }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#3089AB" : "black"}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Central User */}
      <circle cx="12" cy="6" r="3" />
      <path d="M8 20v-2a4 4 0 0 1 8 0v2" />

      {/* Left User */}
      <circle cx="4.5" cy="9" r="2" />
      <path d="M2 20v-1.5a3 3 0 0 1 3-3h1" />

      {/* Right User */}
      <circle cx="19.5" cy="9" r="2" />
      <path d="M22 20v-1.5a3 3 0 0 0-3-3h-1" />
    </svg>
  );
};

export default HcmTeamICon;
