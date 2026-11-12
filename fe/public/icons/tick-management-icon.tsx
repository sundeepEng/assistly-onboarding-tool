import { NextPage } from "next";

interface Props {
  color?: string;
}

const TickManagementIcon: NextPage<Props> = ({ color }) => {
  return (
    <div>
      <svg
        width="12"
        height="10"
        viewBox="0 0 12 10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M11.786 0.241289C11.5001 -0.080412 11.0372 -0.0804384 10.7512 0.241262L3.84118 8.01296L1.24884 5.09735C0.962879 4.77565 0.499964 4.77562 0.213979 5.09732C-0.0713264 5.41823 -0.0713264 5.94035 0.213979 6.26121L3.32377 9.75882C3.60968 10.0804 4.07267 10.0804 4.35861 9.75882L11.786 1.40515C12.0713 1.08426 12.0713 0.56212 11.786 0.241289Z"
          fill={color ? color : "#514CEB"}
        />
      </svg>
    </div>
  );
};

export default TickManagementIcon;
