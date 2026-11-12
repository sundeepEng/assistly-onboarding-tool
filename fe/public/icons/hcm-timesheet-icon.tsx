import { NextPage } from "next";
 
interface Props {
  active?: boolean;
}
 
const HcmTimesheetIcon: NextPage<Props> = ({ active }) => {
  return (
    <div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 512 512"
      >
        <path
          fill={active ? "#3089AB" : "black"}
          d="M371.9,143.9L475,171l26-103.1l-19.8-5.2l-17,64.9C421.1,57.7,343.9,11.2,255.8,11.2C120.6,11.2,11,120.9,11,256.2s109.6,245,244.8,245c90.2,0,169-48.8,211.5-121.5l-19.3-9.3c-39,65.5-110.4,109.4-192.1,109.4c-123.4,0-223.5-100.1-223.5-223.6S132.4,32.5,255.8,32.5c82.2,0,154.1,44.4,192.9,110.6l-71.6-19L371.9,143.9z"
        />
        <polygon
          fill={active ? "#3089AB" : "black"}
          points="223,89.7 223,275.2 342.8,333.5 352.1,314.8 243.9,262.7 243.9,89.7"
        />
      </svg>
    </div>
  );
};
 
export default HcmTimesheetIcon;