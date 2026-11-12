import type { NextPage } from "next";
import { useEffect, useState } from "react";
import areCookiesEnabled from "../utils/areCookiesEnabled";
import Login from "../components/login/login";

const Root: NextPage = () => {
  const [cookiesEnabled, setCookiesEnabled] = useState(true);

  useEffect(() => {
    setCookiesEnabled(areCookiesEnabled());
  }, []);

  return (
    <div>
      {!cookiesEnabled ? (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white p-4 text-center z-50">
          Cookies are disabled in your browser. Please enable them to use
          this app.
        </div>
      ) : (
        <Login />
      )}
    </div>
  );
};

export default Root;
