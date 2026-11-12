import axios from "axios";
import Cookies from "js-cookie";

export type DocusealBuilderTokenRequest = {
  integrationEmail?: string;
  name?: string;
  documentUrls?: string[];
  templateId?: number;
  externalId?: string;
  roles?: string[];
};

export const fetchDocusealBuilderToken = async (
  payload: DocusealBuilderTokenRequest,
) => {
  const token = Cookies.get("idToken");
  if (!token) throw new Error("Unauthorized");

  const resp = await axios.post(
    `${process.env.NEXT_PUBLIC_BASE_URL}/v1/docuseal/builder-token`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const builderToken = (resp as any)?.data?.token;
  if (!builderToken) throw new Error("Missing builder token");
  return String(builderToken);
};