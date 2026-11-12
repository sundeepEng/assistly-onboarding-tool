export const SetCookieHeader = (name: string, value: string, maxAge: number): Record<string, string> => {
  return {
    "Set-Cookie": `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Strict; Secure`,
  };
};
