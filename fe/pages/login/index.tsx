import React, { useEffect, useState } from "react";
import areCookiesEnabled from "../../utils/areCookiesEnabled";
import Login from "../../components/login/login";

export default function Index() {
  const [cookiesEnabled, setCookiesEnabled] = useState(true);

  useEffect(() => {
    const test = areCookiesEnabled();
    setCookiesEnabled(test);
  }, []);
  return (
    <div>
      {!cookiesEnabled ? (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white p-4 text-center z-50">
          ⚠️ Cookies are disabled in your browser. Please enable them to use
          this app.
        </div>
      ) : (
        <div>
          <Login />
        </div>
      )}
    </div>
  );
}
