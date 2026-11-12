import type { NextPage } from "next";
import Image from "next/image";

export type FrameComponentType = {
  className?: string;
};

const FrameComponent: NextPage<FrameComponentType> = ({ className = "" }) => {
  return (
    <div
      className={`flex flex-row items-center justify-center p-2.5 text-left text-xl text-grays-white font-poppins ${className}`}
    >
      <div className="h-[30px] w-[85.4px] relative">
        <Image
          className="absolute h-[93.33%] w-[33.37%] top-[3.33%] right-[66.63%] bottom-[3.33%] left-[0%] max-w-full overflow-hidden max-h-full"
          loading="lazy"
          width={29}
          height={28}
          alt=""
          src="/a4okwj01-1.svg"
        />
        <a className="[text-decoration:none] absolute w-[54.8%] top-[0%] left-[45.2%] font-medium text-[inherit] inline-block">
          CRM
        </a>
      </div>
    </div>
  );
};

export default FrameComponent;
