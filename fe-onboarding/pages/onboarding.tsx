import type { NextPage } from "next";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { OnboardingProvider } from "../components/onboarding/onboarding-provider";
import StepsPanel from "../components/onboarding/steps-panel";
import PortalFrame from "../components/onboarding/portal-frame";
import ChatPanel from "../components/onboarding/chat-panel";
import { checkAndCleanExpiredTokens, clearAuthCookies } from "../utils/auth";

const Onboarding: NextPage = () => {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (checkAndCleanExpiredTokens()) {
      setAuthorized(true);
    } else {
      router.replace("/");
    }
  }, [router]);

  const onLogout = () => {
    clearAuthCookies();
    router.replace("/");
  };

  if (!authorized) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden font-jakarta">
      {/* Header */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 bg-white border-b border-black/10">
        <Image
          src="/images/assistly-logo.webp"
          alt="Assistly"
          width={120}
          height={40}
          className="object-contain"
          priority
        />
        <button
          onClick={onLogout}
          className="text-sm font-medium text-gray-600 hover:text-primary transition"
        >
          Log out
        </button>
      </header>

      {/* Three-column body */}
      <OnboardingProvider>
      <div className="flex-1 flex min-h-0">
        <aside className="w-72 shrink-0 min-h-0">
          <StepsPanel />
        </aside>

        <main className="flex-1 min-w-0 min-h-0 bg-gray-50">
          <PortalFrame />
        </main>

        <aside className="w-80 shrink-0 min-h-0 hidden lg:block">
          <ChatPanel />
        </aside>
      </div>
      </OnboardingProvider>
    </div>
  );
};

export default Onboarding;

// Force SSR so the auth check always runs client-side on navigation.
export async function getServerSideProps() {
  return { props: {} };
}
