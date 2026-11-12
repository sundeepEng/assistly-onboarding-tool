import { NextPage } from "next";

interface Props {
  active?: boolean;
}

const CarouselLeftArrowIcon: NextPage<Props> = ({ active }) => {
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
        d="M29.9998 19.0799L23.4798 25.5999C22.7098 26.3699 22.7098 27.6299 23.4798 28.3999L29.9998 34.9199"
        stroke="#514CEB"
        stroke-width="1.8"
        stroke-miterlimit="10"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
export default CarouselLeftArrowIcon;
