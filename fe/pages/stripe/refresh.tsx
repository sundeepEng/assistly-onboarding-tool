import { useEffect } from "react";
import { useRouter } from "next/router";

export default function StripeRefreshPage() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;

    const emailParam = router.query.email;
    const email = typeof emailParam === "string" ? emailParam : "";

    const target = email
      ? `/stripe/onboard?email=${encodeURIComponent(email)}`
      : "/stripe/onboard";

    router.replace(target);
  }, [router.isReady, router.query.email, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-[520px] rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
        <h1 className="m-0 text-xl font-bold text-gray-900">
          Refreshing your Stripe link…
        </h1>
        <p className="mt-2 text-sm text-gray-600">Please wait.</p>
      </div>
    </div>
  );
}
