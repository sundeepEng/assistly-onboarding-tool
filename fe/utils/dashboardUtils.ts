import {
  ESIGN_ENVELOPE_STATUS_COMPLETED,
  ESIGN_ENVELOPE_STATUS_DECLINED,
  ESIGN_ENVELOPE_STATUS_ERROR,
  ESIGN_ENVELOPE_STATUS_PENDING,
  ESIGN_ENVELOPE_STATUS_SENT,
} from "./constants";
import { parseISO, isSameMonth, isSameYear, subMonths } from "date-fns";
import dayjs from "dayjs";
import fetchPreSignedUrl from "../services/get-presigned-url";

//For getting pending documents
type RequiredDocConfig = {
  name: string;
  label: string;
  required: boolean;
};

export const summarizeUsersRequiredDocs = (
  usersOrDocs:
    | Array<{
        firstName?: string;
        lastName?: string;
        name?: string;
        role?: string;
        userId?: string;
        documents?: Array<{
          isRequiredDocument?: boolean | string | number | null;
          documentName?: string | null;
        }>;
      }>
    | {
        documents?: Array<{
          isRequiredDocument?: boolean | string | number | null;
          documentName?: string | null;
        }>;
      }
    | Array<{
        isRequiredDocument?: boolean | string | number | null;
        documentName?: string | null;
      }>
    | null
    | undefined,
  requiredDocument: RequiredDocConfig[] | null | undefined
) => {
  // 🔹 Always normalize to an array
  const requiredDocsArray: RequiredDocConfig[] = Array.isArray(requiredDocument)
    ? requiredDocument
    : [];

  // 1️⃣ Count how many TYPES are required
  const requiredDocumentCount = requiredDocsArray.filter(
    (document) => document.required
  ).length;

  const requiredCount = Math.max(0, Number(requiredDocumentCount) || 0);

  // 2️⃣ Set of required "names" (admission_agreement, house_rules, etc.)
  const requiredNameSet = new Set(
    requiredDocsArray.filter((d) => d.required).map((d) => d.name.trim().toLowerCase())
  );

  const getBaseName = (name: unknown): string => {
    if (typeof name !== "string") return "";
    const trimmed = name.trim().toLowerCase();
    const [base] = trimmed.split("."); // strip extension
    return base;
  };

  const extractDocuments = (
    userOrDocs:
      | {
          documents?: Array<{
            isRequiredDocument?: boolean | string | number | null;
            documentName?: string | null;
          }>;
        }
      | Array<{
          isRequiredDocument?: boolean | string | number | null;
          documentName?: string | null;
        }>
      | null
      | undefined
  ) =>
    Array.isArray(userOrDocs)
      ? (userOrDocs as Array<{
          isRequiredDocument?: boolean | string | number | null;
          documentName?: string | null;
        }>)
      : Array.isArray((userOrDocs as any)?.documents)
        ? ((userOrDocs as any).documents as Array<{
            isRequiredDocument?: boolean | string | number | null;
            documentName?: string | null;
          }>)
        : [];

  const isRequiredFlag = (value: unknown) =>
    value === true ||
    value === 1 ||
    (typeof value === "string" && value.trim().toLowerCase() === "true");

  const summarizeUserOrDocs = (
    userOrDocs:
      | {
          firstName?: string;
          lastName?: string;
          name?: string;
          role?: string;
          userId?: string;
          documents?: Array<{
            isRequiredDocument?: boolean | string | number | null;
            documentName?: string | null;
          }>;
        }
      | Array<{
          isRequiredDocument?: boolean | string | number | null;
          documentName?: string | null;
        }>
  ) => {
    const documents = extractDocuments(userOrDocs as any);
    const satisfiedRequiredNames = new Set<string>();

    for (const doc of documents) {
      const baseName = getBaseName(doc?.documentName);
      if (!baseName) continue;

      if (requiredNameSet.has(baseName)) {
        satisfiedRequiredNames.add(baseName);
      }
    }

    const requiredMarked = satisfiedRequiredNames.size;

    const missingCount = Math.max(requiredCount - requiredMarked, 0);

    const user = Array.isArray(userOrDocs) ? {} : (userOrDocs as any);
    const fullName =
      (user?.name ??
        [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim()) ||
      "";

    return {
      userId: user?.userId ?? null,
      role: user?.role ?? null,
      fullName,
      requiredMarked,
      requiredCount,
      isComplete: requiredMarked === requiredCount,
      missingCount,
      label: `${requiredMarked}/${requiredCount}`,
    };
  };

  // Build summaries
  let summaries:
    | Array<ReturnType<typeof summarizeUserOrDocs>>
    | ReturnType<typeof summarizeUserOrDocs>[];

  const isDocsArray =
    Array.isArray(usersOrDocs) &&
    (usersOrDocs as any[]).length > 0 &&
    ((usersOrDocs as any[])[0] as any)?.isRequiredDocument !== undefined;

  if (isDocsArray) {
    summaries = [summarizeUserOrDocs(usersOrDocs as any)];
  } else if (Array.isArray(usersOrDocs)) {
    summaries = usersOrDocs.map((user) => summarizeUserOrDocs(user));
  } else {
    summaries = usersOrDocs ? [summarizeUserOrDocs(usersOrDocs as any)] : [];
  }

  // Keep only incomplete
  const incompleteSummaries = summaries.filter(
    (summary: any) => !summary.isComplete
  );

  // Sort: most missing first, then name A→Z, then userId
  const safeLower = (s: unknown) =>
    typeof s === "string" ? s.toLowerCase() : "";
  incompleteSummaries.sort((a: any, b: any) => {
    if (a.missingCount !== b.missingCount)
      return b.missingCount - a.missingCount;
    const nameA = safeLower(a.fullName);
    const nameB = safeLower(b.fullName);
    if (nameA !== nameB) return nameA.localeCompare(nameB);
    return String(a.userId ?? "").localeCompare(String(b.userId ?? ""));
  });

  return incompleteSummaries;
};

export const getPcgByUserId = (
  usersData: any,
  userId?: string | null
): any | null => {
  if (!userId || typeof userId !== "string") return null;

  const list =
    (Array.isArray(usersData?.PCGs?.users) && usersData.PCGs.users) ||
    (Array.isArray(usersData?.users) && usersData.users) ||
    [];

  const id = userId.trim().toLowerCase();
  return (
    list.find(
      (u: any) =>
        typeof u?.userId === "string" && u.userId.trim().toLowerCase() === id
    ) ?? null
  );
};

type Doc = {
  isRequiredDocument?: boolean;
  [key: string]: any;
};

export const summarizeDocsBrief = (
  documents: Doc[] | null | undefined,
  totalRequiredDocuments
) => {
  const HOME_REQUIRED_DOCUMENTS_COUNT = totalRequiredDocuments?.filter(
    (document) => document.required
  ).length;
  const documentList = Array.isArray(documents) ? documents : [];
  const requiredTotal = Math.max(0, Number(HOME_REQUIRED_DOCUMENTS_COUNT) || 0);

  // Only boolean true is considered as marked
  const markedRequiredDocuments = documentList.reduce((sum, doc) => {
    const matched = totalRequiredDocuments.find(
      (c) => c.name === doc.documentName
    );

    return sum + (matched?.required ? 1 : 0);
  }, 0);

  const missingRequiredDocuments = Math.max(
    requiredTotal - markedRequiredDocuments,
    0
  );

  return {
    markedRequiredDocuments,
    requiredTotal,
    isComplete: markedRequiredDocuments == requiredTotal,
    missingRequiredDocuments,
    label: `${markedRequiredDocuments}/${requiredTotal}`,
  };
};

// For PCHO required documents
type UserDocument = { documentName?: string; isRequiredDocument?: boolean };

export const summarizePCHORequiredDocs = (
  userDocuments: UserDocument[] | null | undefined,
  requiredDocumentSpecs: Array<{ name: string; required: boolean }>
) => {
  const documentList = Array.isArray(userDocuments) ? userDocuments : [];
  const requiredSpecsList = (requiredDocumentSpecs ?? []).filter(
    (spec) => spec.required
  );
  const totalRequiredDocuments = requiredSpecsList.length;

  // Normalize string for matching
  const normalizeName = (name?: string) =>
    (name ?? "")
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  // Check if a spec has a matching user document
  const isSpecSatisfied = (specName: string) => {
    const normalizedSpecName = normalizeName(specName);
    return documentList.some((doc) => {
      const nameMatches = normalizeName(doc.documentName).includes(
        normalizedSpecName
      );
      if (!nameMatches) return false;
      return doc.isRequiredDocument === undefined
        ? true
        : doc.isRequiredDocument === true;
    });
  };

  const markedRequiredDocuments = requiredSpecsList.reduce(
    (sum, spec) => sum + (isSpecSatisfied(spec.name) ? 1 : 0),
    0
  );

  const missingRequiredDocuments = Math.max(
    totalRequiredDocuments - markedRequiredDocuments,
    0
  );

  return {
    markedRequiredDocuments,
    totalRequiredDocuments,
    isComplete: markedRequiredDocuments == totalRequiredDocuments,
    missingRequiredDocuments,
    label: `${markedRequiredDocuments}/${totalRequiredDocuments}`,
  };
};

export interface DocusignStatusInfo {
  label: string; // short badge text
  notes: string; // extra notes about the status
}

/**
 * Returns a label, color, and notes for a given DocuSign envelope status.
 * - Ignores "completed" (returns undefined).
 * - Falls back to "Pending" + gray if unknown.
 */
export function getDocusignStatusBadge(
  status?: string
): DocusignStatusInfo | undefined {
  if (!status) return undefined;

  switch (status) {
    case ESIGN_ENVELOPE_STATUS_COMPLETED:
      // Ignore completed contracts
      return undefined;

    case ESIGN_ENVELOPE_STATUS_DECLINED:
      return {
        label: "Declined",
        notes: "The signer declined the request",
        // color: colorClassByKey[status] || "bg-gray-400",
      };

    case ESIGN_ENVELOPE_STATUS_PENDING:
      return {
        label: "Mail Sent",
        notes: "Signature pending",
      };

    case ESIGN_ENVELOPE_STATUS_ERROR:
      return {
        label: "Error",
        notes: "Error occurred while processing",
      };

    case ESIGN_ENVELOPE_STATUS_PENDING:
      return {
        label: "Pending",
        notes: "Request not yet initiated",
      };

    case ESIGN_ENVELOPE_STATUS_SENT:
      return {
        label: "Mail Sent",
        notes: "Signature pending",
      };

    default:
      return {
        label: "Pending",
        notes: "Unknown status",
      };
  }
}

/**
 * Calculates monthly trend of users based on creation and deletion.
 *
 * Net Trend = (Created This Month) - ( Deleted This Month)
 *
 * @Returns a label like "+3 this month", "-6 this month", or "No change this month".
 */
export function calculateMonthlyTrend(items: any[]): {
  trend: number;
  trendUp: boolean;
  label: string;
} {
  const now = new Date();

  const getRelevantDate = (item: any): string | undefined => {
    if (!item || !item.role) return undefined;
    if (["Lead", "PCGLead", "NurseLead", "Referral"].includes(item.role))
      return item.createdAt;
    if (["Senior", "PCG", "Nurse"].includes(item.role)) return item.contractCompletedOn;
    return undefined;
  };

  const isValid = (item: any) => {
    const dateStr = getRelevantDate(item);
    return !!dateStr;
  };

  const isSameMonthAndYear = (dateStr: string, compareDate: Date) =>
    isSameMonth(parseISO(dateStr), compareDate) &&
    isSameYear(parseISO(dateStr), compareDate);

  // Created users
  const createdThisMonth = items.filter(
    (item) =>
      isValid(item) &&
      isSameMonthAndYear(getRelevantDate(item)!, now) &&
      !item.is_deleted
  );

  // Deleted users
  const deletedThisMonth = items.filter(
    (item) =>
      isValid(item) &&
      item.is_deleted &&
      isSameMonthAndYear(getRelevantDate(item)!, now)
  );

  const current = createdThisMonth.length;
  const deletedCurrent = deletedThisMonth.length;

  let diff = current - deletedCurrent;

  return {
    trend: Math.abs(diff),
    trendUp: diff >= 0,
    label:
      diff === 0
        ? "No change this month"
        : `${diff >= 0 ? "+" : "-"}${Math.abs(diff)} this month`,
  };
}

/**
 * Calculates occupancy rate trend between current and previous month
 *
 * @param seniors Array of senior users (each must have `contractCompletedOn`)
 * @param homeCapacity Total number of beds
 */
export function GetHomeOccupancyRateTrend(
  seniors: any[],
  homeCapacity: number
): {
  currentRate: number;
  trend: number;
  trendUp: boolean;
  label: string;
} {
  const now = new Date();
  const lastMonth = subMonths(now, 1);

  const countForMonth = (date: Date): number => {
    return seniors.filter(
      (senior) =>
        senior.contractCompletedOn &&
        isSameMonth(parseISO(senior.contractCompletedOn), date) &&
        isSameYear(parseISO(senior.contractCompletedOn), date)
    ).length;
  };

  const getOccupancyRate = (numberOfSeniors: number): number => {
    if (!homeCapacity || homeCapacity <= 0) return 0;
    return Math.round((numberOfSeniors / homeCapacity) * 100);
  };

  const previousCount = countForMonth(lastMonth);

  const currentRate = getOccupancyRate(seniors?.length);
  const previousRate = getOccupancyRate(previousCount);

  const diff = currentRate - previousRate;

  return {
    currentRate: currentRate,
    trend: Math.abs(diff),
    trendUp: diff >= 0,
    label:
      diff === 0
        ? "No change this month"
        : `${diff >= 0 ? "+" : "-"}${Math.abs(diff)}% this month`,
  };
}

export const processExpiringDocuments = (dbDocs, documentConstants) => {
  const today = dayjs();

  const expiredDocs = [];
  const expiringDocs = [];

  dbDocs?.forEach((doc) => {
    const matchingConstant = documentConstants?.find(
      (c) =>
        c.name.toLowerCase().trim() === doc.documentName.toLowerCase().trim()
    );

    if (!matchingConstant) return; // Skip unmatched docs

    const expiryDate = dayjs(doc.documentExpiryDate);
    const alertDays = matchingConstant.alertPeriodInDays;

    // 1️⃣ Expired documents
    if (expiryDate.isBefore(today, "day")) {
      expiredDocs.push({
        ...doc,
        alertDays,
        status: "expired",
      });
      return;
    }

    // 2️⃣ Expiring documents
    const daysLeft = expiryDate.diff(today, "day");

    if (daysLeft <= alertDays) {
      expiringDocs.push({
        ...doc,
        daysLeft,
        alertDays,
        status: "expiring",
      });
    }
  });

  return { expiredDocs, expiringDocs };
};

// Build a label like "2 expired / 1 expiring"
const buildExpiryLabel = (expiredCount: number, expiringCount: number) => {
  if (expiredCount && expiringCount) {
    return `${expiredCount} expired / ${expiringCount} expiring`;
  }
  if (expiredCount) return `${expiredCount} expired`;
  if (expiringCount) return `${expiringCount} expiring`;
  return "";
};

/**
 * For a list of users, return only those who have expired / expiring docs.
 * Each item: { userId, fullName, expiredCount, expiringCount, label }
 */
export const summarizeUsersExpiringDocs = (
  users: any[] = [],
  documentConstants: any[]
) => {
  const result: {
    userId: string;
    fullName: string;
    expiredCount: number;
    expiringCount: number;
    label: string;
  }[] = [];

  users.forEach((user) => {
    if (!user || user.isDeleted) return; // skip deleted PCGs

    const userDocs = user.documents || [];

    const { expiredDocs, expiringDocs } = processExpiringDocuments(
      userDocs,
      documentConstants
    );

    const expiredCount = expiredDocs.length;
    const expiringCount = expiringDocs.length;

    if (!expiredCount && !expiringCount) return;

    const fullName =
      user.name ||
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      "Unnamed";

    result.push({
      userId: user.userId,
      fullName,
      expiredCount,
      expiringCount,
      label: buildExpiryLabel(expiredCount, expiringCount),
    });
  });

  return result;
};

// Helper to normalize document names for comparison
const getBaseName = (name: unknown): string => {
  if (typeof name !== "string") return "";
  return (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
};

/**
 * Calculates pending documents for a single user with DOCX placeholder validation
 * @param user - User object with documents array
 * @param requiredConfigs - Array of required document configurations
 * @returns Pending document summary for the user
 */
export const calculatePendingDocsForUser = async (
  user: any,
  requiredConfigs: Array<{ name: string; label: string; required: boolean }>
) => {
  const required = Array.isArray(requiredConfigs)
    ? requiredConfigs.filter((d) => d?.required)
    : [];
  const requiredCount = required.length;

  const requiredNameSet = new Set(
    required.map((d) => getBaseName(d.name))
  );

  const docs = Array.isArray(user?.documents) ? user.documents : [];
  const satisfiedTypes = new Set<string>();

  for (const doc of docs) {
    const baseName = getBaseName(doc?.documentName);
    if (!baseName) continue;
    if (!requiredNameSet.has(baseName) || satisfiedTypes.has(baseName)) continue;

    const isUploaded =
      doc?.status === "Uploaded" ||
      (doc?.status === undefined && Boolean(doc?.documentUrl));
    if (!isUploaded) continue;

    const rawType = String(doc?.documentType ?? "").trim().toLowerCase();
    const urlOrName = String(doc?.documentUrl ?? doc?.documentName ?? "")
      .trim()
      .toLowerCase();
    const isWordDoc =
      rawType === ".doc" ||
      rawType === ".docx" ||
      rawType.includes("msword") ||
      rawType.includes("wordprocessingml") ||
      urlOrName.endsWith(".doc") ||
      urlOrName.endsWith(".docx");

    if (
      doc?.documentCategory === "onboarding" &&
      isWordDoc &&
      doc?.documentUrl
    ) {
      const enabled = !!doc.documentUrl;
      if (!enabled) return;
      try {
        const url = await fetchPreSignedUrl(doc.documentUrl);
        if (!url) {
          satisfiedTypes.add(baseName);
        }
        //  else {
        //   const hasPlaceholders = await docxHasPlaceholders(url);
        //   if (!hasPlaceholders) satisfiedTypes.add(baseName);
        // }
      } catch (err) {
        console.error("Error checking placeholders for document:", doc?.documentId, err);
        satisfiedTypes.add(baseName);
      }
    } else {
      satisfiedTypes.add(baseName);
    }
  }

  const requiredMarked = satisfiedTypes.size;
  const missingCount = Math.max(requiredCount - requiredMarked, 0);

  const completed = requiredMarked;
  const total = requiredCount;

  const fullName =
    (user?.name ??
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim()) ||
    "";

  return {
    userId: user?.userId ?? null,
    role: user?.role ?? null,
    fullName,
    requiredMarked,
    requiredCount,
    missingCount,
    completed,
    total,
    label: `${requiredMarked}/${requiredCount}`,
    isComplete: missingCount === 0,
  };
};
