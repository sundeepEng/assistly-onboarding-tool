import { Lock } from "lucide-react";
import React from "react";
import { Card } from "./card";
import Button from "./button";
import router from "next/router";

function RestrictedPage() {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    const t = window.setTimeout(() => setShow(true), 200);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-50 font-poppins">
      <Card className="max-w-md w-full shadow-xl rounded-2xl p-8 text-center">
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 text-red-600 rounded-full">
          <Lock className="w-8 h-8" />
        </div>

        <h3 className="text-2xl font-medium text-gray-800 mb-2">
          Access Denied
        </h3>

        <p className="text-gray-600 mb-6">
          You are not authorized to view this page. Please check your
          permissions or return to the homepage.
        </p>

        <Button
          buttonClick={() => {
            router.push("/");
          }}
          classname="w-full"
          name="Go to Homepage"
        />
      </Card>
    </div>
  );
}

export default RestrictedPage;
