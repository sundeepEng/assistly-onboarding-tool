import Image from "next/image";
import { LoginCard } from "./desktop-login";

const MobileLogin = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[url('/images/login-bg.webp')] bg-center bg-cover bg-no-repeat">
      {/* Top logo bar */}
      <div className="px-4 py-4 bg-white/90 shadow-xl">
        <div className="flex justify-center">
          <Image
            src="/images/assistly-logo.webp"
            alt="Assistly"
            width={180}
            height={58}
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-8">
        <div className="mx-auto w-full max-w-[420px] px-6 py-8 bg-white/90 border border-white/60 rounded-2xl shadow-xl">
          <LoginCard />
        </div>
      </div>

      {/* Footer pinned to bottom */}
      <div className="pb-6">
        <div className="mx-auto max-w-7xl px-[20px]">
          <div className="border-solid border-t-[2px] border-[#6D7BFF]/40" />
        </div>

        <div className="mx-auto max-w-7xl px-6 pt-3 text-center text-sm text-gray-700">
          © Copyright 2026{" "}
          <a
            className="font-bold text-black no-underline hover:underline"
            href="https://assistly.care/"
          >
            Assistly Care LLC
          </a>{" "}
          | Powered by{" "}
          <a
            className="font-bold text-black no-underline hover:underline"
            href="https://www.charterglobal.com/"
          >
            Charter Global
          </a>
        </div>
      </div>
    </div>
  );
};

export default MobileLogin;
