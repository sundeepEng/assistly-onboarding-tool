import { getUserIdFromToken } from "./auth";

const userId = getUserIdFromToken();
export function extFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const dot = path.lastIndexOf(".");
    return dot >= 0 ? path.slice(dot).toLowerCase() : "";
  } catch {
    const q = url.split("?")[0].split("#")[0];
    const dot = q.lastIndexOf(".");
    return dot >= 0 ? q.slice(dot).toLowerCase() : "";
  }
}

export const transformS3ModulesToStructured = (
  moduleId,
  module: Record<string, { video?: string; ppt?: string }>
) => {
  const now = new Date().toISOString();
  const docs = [];
  const fileName = ((module?.video || module?.ppt) as string)?.split("/").pop();
  const moduleName = fileName?.replace(/_[^_]*$/, "");
  if (module?.video) {
    docs.push({
      documentId: `${moduleName}_video`,
      documentType: extFromUrl("") || ".mp4",
      documentName: `${moduleName}_video`,
      documentUrl: module.video,
      documentCreatedAt: now,
      documentCreatedByUserId: userId,
    });
  }

  if (module?.ppt) {
    docs.push({
      documentId: `${moduleName}_ppt`,
      documentType: extFromUrl("") || ".pptx",
      documentName: `${moduleName}_ppt`,
      documentUrl: module.ppt,
      documentCreatedAt: now,
      documentCreatedByUserId: userId,
    });
  }
  return {
    moduleId: moduleId,
    moduleName,
    moduleDescription: "",
    documents: docs,
    createdByUserId: userId,
    createdAt: now,
    modifiedAt: now,
    moduleType:"default"
  };
};
