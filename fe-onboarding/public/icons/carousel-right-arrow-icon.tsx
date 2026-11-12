import { NextPage } from "next";

interface Props {
  active?: boolean;
}

const CarouselRightArrowIcon: NextPage<Props> = ({ active }) => {
  return (
    <svg
      width="53"
      height="53"
      viewBox="0 0 53 53"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="26.5" cy="26.5" r="26.5" fill="white" />
      <circle
        cx="26.5"
        cy="26.5"
        r="25.5"
        stroke="#514CEB"
        stroke-opacity="0.3"
        stroke-width="2"
      />
      <path
        d="M24.0002 19.0799L30.5202 25.5999C31.2902 26.3699 31.2902 27.6299 30.5202 28.3999L24.0002 34.9199"
        stroke="#514CEB"
        stroke-width="1.8"
        stroke-miterlimit="10"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
export default CarouselRightArrowIcon;
