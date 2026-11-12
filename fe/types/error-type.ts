export type ApiError = {
  response?: {
    data?: {
      message: string;
    };
    status?: number;
    headers?: any;
  };
}