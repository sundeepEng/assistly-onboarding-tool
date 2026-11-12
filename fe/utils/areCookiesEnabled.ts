// This functions sets dummy cookie and check if browser is allowing cookies or not and return boolean!
export default function areCookiesEnabled() {
    try {
      document.cookie = "cookietest=1";
      const cookiesEnabled = document.cookie.indexOf("cookietest=") !== -1;
      document.cookie = "cookietest=1; expires=Thu, 01 Jan 1970 00:00:01 GMT";
      return cookiesEnabled;
    } catch (e) {
      return false;
    }
  }
  