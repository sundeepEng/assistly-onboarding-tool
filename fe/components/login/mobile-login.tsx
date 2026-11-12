

import Image from "next/image";

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
        <div className="mx-auto w-full max-w-[420px] px-6 py-8">
          <div className="text-center text-[28px] font-extrabold text-[#111827]">
            Your Care Companion
          </div>

          <div className="text-center text-[14px] text-gray-600 mt-2">
            Experience seamless care. Download the mobile app now!
          </div>

          {/* Store Buttons */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <a
              href="https://apps.apple.com/in/app/assistly-mobile/id6754018581"
              className="no-underline"
              aria-label="Download on App Store"
            >
              <Image
                src="/images/app-store-1.webp"
                alt="App Store"
                width={160}
                height={44}
                className="object-contain"
                priority
              />
            </a>

            <a
              href="https://play.google.com/store/apps/details?id=assistly.care"
              className="no-underline"
              aria-label="Get it on Google Play"
            >
              <Image
                src="/images/google-play.webp"
                alt="Google Play"
                width={160}
                height={44}
                className="object-contain"
                priority
              />
            </a>
          </div>

          {/* Book a Demo button */}
          <div className="mt-6 flex justify-center">
            <a href="https://assistly.care/request-a-demo/" className="no-underline">
              <div
                className="w-[144px] text-center rounded-xl py-3 font-semibold
                           bg-[#0B0B18] text-white hover:opacity-95 transition"
              >
                Book a Demo
              </div>
            </a>
          </div>

          {/* Mobile schedule image */}
          <div className="mt-6">
            <Image
              src="/images/mobile-schedule-img.webp"
              alt="Assistly Mobile Schedule"
              width={720}
              height={520}
              className="w-full h-auto object-contain"
              priority
            />
          </div>
        </div>
        <h1 className="text-center text-[28px] font-extrabold text-[#111827] mt-6">
          All Your Care Operations. One Unified Platform.
        </h1>
        <div className="mx-auto w-full max-w-[420px] px-6 pb-10">
          <div className="mt-2">
            <Image
              src="/images/responsive-mockup.webp"
              alt="Assistly platform on devices"
              width={760}
              height={420}
              className="w-full h-auto drop-shadow-md object-contain"
              priority
            />
          </div>

          {/* Bullet points */}
          <div className="mt-8 space-y-6 text-[16px] text-gray-800 font-jakarta">
            <div className="flex gap-3">
              <div className="mt-0.5 text-gray-900">✔</div>
              <div>
                Manage schedules, care plans, and compliance from a single workspace
              </div>
            </div>

            <div className="flex gap-3">
              <div className="mt-0.5 text-gray-900">✔</div>
              <div>
                Keep staff aligned with real-time updates and mobile-ready tools
              </div>
            </div>

            <div className="flex gap-3">
              <div className="mt-0.5 text-gray-900">✔</div>
              <div>
                Stay inspection-ready with built-in documentation and audit trails
              </div>
            </div>

            <div className="flex gap-3">
              <div className="mt-0.5 text-gray-900">✔</div>
              <div>
                Strengthen trust through clear reporting and family communication
              </div>
            </div>
          </div>
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
