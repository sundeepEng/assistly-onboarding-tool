import { NextPage } from "next";

interface Props {
  color?: string;
}

const TourIcon: NextPage<Props> = ({ color }) => {
  const bgColor = color?.startsWith("#") ? `${color}33` : "rgba(128, 128, 128, 0.2)";
  return (
    <div
      className={`flex justify-center items-center rounded-3xl ${
        color ? `bg-[${color}]` : "bg-[gray]"
      } bg-opacity-20 w-[40px] h-[40px]`}
      style={{
        backgroundColor: bgColor,
      }}
    >
      <svg
        width="18"
        height="17"
        viewBox="0 0 18 17"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M17.4331 8.03049C16.9761 7.58484 9.73242 0.521263 9.39738 0.19455C9.1315 -0.0648499 8.7003 -0.0648499 8.43442 0.19455C8.06799 0.551872 0.848155 7.5921 0.398728 8.03049C0.132716 8.28976 0.132716 8.71024 0.398728 8.96964C0.664607 9.22891 1.09581 9.22891 1.36169 8.96964L1.53846 8.79727V16.3359C1.53846 16.7027 1.84344 17 2.21945 17H15.6124C15.9884 17 16.2933 16.7027 16.2933 16.3359V8.79727L16.47 8.96964C16.736 9.22891 17.1672 9.22891 17.4331 8.96964C17.6991 8.71024 17.6991 8.28976 17.4331 8.03049ZM10.9135 15.6719H6.91841V11.7761H10.9135V15.6719ZM14.9314 15.6719H12.2755V11.112C12.2755 10.7452 11.9706 10.448 11.5945 10.448H6.23742C5.86128 10.448 5.55643 10.7452 5.55643 11.112V15.6719H2.90057V7.46915L8.9159 1.60322L14.9314 7.46915V15.6719Z"
          fill={color ? color : "gray"}
        />
      </svg>
    </div>
  );
};

export default TourIcon;
