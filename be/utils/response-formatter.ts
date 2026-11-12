let responseHeaders: any = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};
export const FormatResponse = (
  statusCode: number,
  body: any,
  cookies?: {
    idToken: string;
    accessToken: string;
    refreshToken?: string;
    userId?: string;
    homeId?: string;
  }
) => {
  if (cookies) {
    body = {
      ...body,
      cookies: cookies,
    };
  }
  return {
    statusCode: statusCode,
    body: JSON.stringify(body),
    headers: responseHeaders,
  };
};

export const FormatWebSocketResponse = (statusCode: number, body: any) => {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
};
