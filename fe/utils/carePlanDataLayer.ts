import {
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import {
  DEFAULT_ADL_FIELDS,
  HOUSEKEEPING_LABELS,
  VITAL_SIGN_LABELS,
} from "./constants";

const normalizeServiceName = (str?: string): string =>
  (str ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// The part before " - " identifies the service; the part after is the
// care level/description which may change over time, so we match on this.
const serviceNamePart = (name?: string): string =>
  normalizeServiceName((name ?? "").split(" - ")[0]);

// "bloodPressure" / "bathing" -> "Blood Pressure" / "Bathing"
const formatKeyLabel = (key: string): string => {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return spaced
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
};

// Known service keys -> professional labels
const adlLabels = new Map(
  DEFAULT_ADL_FIELDS.filter((f) => f.section === "adl").map((f) => [
    normalizeServiceName(f.key),
    (f.label.split(" - ")[0] ?? f.label).replace(/:$/, "").trim(),
  ]),
);
const housekeepingLabels = new Map(
  Object.entries(HOUSEKEEPING_LABELS).map(([k, v]) => [
    normalizeServiceName(k),
    v,
  ]),
);
const vitalLabels = new Map(
  Object.entries(VITAL_SIGN_LABELS).map(([k, v]) => [
    normalizeServiceName(k),
    v,
  ]),
);

// Turns stored names like "bathing - Full Assistance" or "dailycleansweep"
// into readable labels like "Bathing - Full Assistance" / "Daily Clean Sweep".
const displayServiceName = (category: string, name: string): string => {
  const separatorIndex = name.indexOf(" - ");
  const namePart = separatorIndex !== -1 ? name.slice(0, separatorIndex) : name;
  const rest = separatorIndex !== -1 ? name.slice(separatorIndex) : "";

  const norm = normalizeServiceName(namePart);
  const known =
    (category === "ADL" ? adlLabels.get(norm) : undefined) ??
    (category === "House Keeping" ? housekeepingLabels.get(norm) : undefined) ??
    (category === "Vital Signs" ? vitalLabels.get(norm) : undefined);

  return `${known ?? formatKeyLabel(namePart)}${rest}`;
};

const CarePlanDataLayer = (
  seniorData: any,
  month: string,
  userMap: Record<string, any> = {},
) => {
  const monthStart = startOfMonth(parseISO(`${month}-01`));
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Placeholders data
  const name = seniorData?.name || "";
  const home = seniorData?.home || "";
  const medicaid = seniorData?.medicaid || seniorData?.medicaidNumber || "";
  const physicianName = seniorData?.medical?.general?.practiceName || "";
  // const providerAgency = seniorData?.providerAgency || "";
  // const homeProvider = seniorData?.homeProvider || "";
  const services = seniorData?.clinical?.carePlan?.services || [];

  const serviceRows: { category: string; serviceName: string; matchKey: string }[] = [];
  const seenRowKeys = new Set<string>();

  const getInitials = (userData: any) => {
    const user = userData?.user || userData;

    if (!user) return "";

    const firstInitial = user.firstName?.charAt(0) || "";
    const lastInitial = user.lastName?.charAt(0) || "";

    return `${firstInitial}${lastInitial}`.toUpperCase();
  };


  const addServiceRow = (
    category: string,
    serviceName: string,
    matchKey: string,
  ) => {
    const dedupeKey = `${category}|${matchKey}`;
    if (!matchKey || seenRowKeys.has(dedupeKey)) return;
    seenRowKeys.add(dedupeKey);
    serviceRows.push({ category, serviceName, matchKey });
  };

  // ADL + IADL — rows from the current care plan configuration
  const combinedAdl = {
    ...seniorData?.carePlan?.adl,
    ...seniorData?.carePlan?.iadl,
  };
  const { comments, ...rest } = combinedAdl || {};

  if (rest) {
    Object.entries(rest).forEach(([key, values]: [string, any]) => {
      const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);

      Object.entries(values).forEach(([subKey, value]) => {
        if (subKey === "careLevel") {
          if (value !== "Independent") {
            addServiceRow(
              "ADL",
              displayServiceName("ADL", `${formattedKey} - ${value}`),
              normalizeServiceName(key),
            );
          }
        } else if (value !== "No" && value !== "Independent") {
          const formattedValue = subKey.replace(/([A-Z])/g, " $1").trim();
          addServiceRow(
            "ADL",
            displayServiceName("ADL", `${formattedKey} - ${formattedValue}`),
            normalizeServiceName(key),
          );
        }
      });
    });
  }

  // Housekeeping
  Object.entries(seniorData?.carePlan?.housekeeping || {}).forEach(
    ([key, val]: [string, any]) => {
      if (val && val !== "Not Required") {
        addServiceRow(
          "House Keeping",
          displayServiceName("House Keeping", key),
          normalizeServiceName(key),
        );
      }
    },
  );

  // Also add rows for services recorded in the selected month that are no
  // longer in the current care plan — otherwise their history silently
  // disappears from the report. Vital signs stay excluded: they render in
  // the detail table below.
  services.forEach((s: any) => {
    if (s.serviceCategory !== "ADL" && s.serviceCategory !== "House Keeping")
      return;
    if (!s.providedAt || s.providedAt.slice(0, 7) !== month) return;
    const matchKey = serviceNamePart(s.serviceName);
    addServiceRow(
      s.serviceCategory,
      displayServiceName(s.serviceCategory, s.serviceName ?? ""),
      matchKey,
    );
  });

  const rows = serviceRows.map(({ category, serviceName, matchKey }) => {
    const days = daysInMonth.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const day = Number(format(date, "d"));
      const cell: any = {
        day,
        status: "",
        providedOrNot: "",
        value: "",
      };

      const entry = services.find((s: any) => {
        if (s.serviceCategory !== category) return false;
        // Match on the service name only — the care level/description may
        // have changed since the record was written.
        if (serviceNamePart(s.serviceName) !== matchKey) return false;
        if (!s.providedAt) return false;
        // providedAt stores the selected day as the UTC date part —
        // comparing that directly avoids timezone day-shifts.
        return s.providedAt.slice(0, 10) === dateStr;
      });

      if (entry) {
        cell.providedOrNot = entry.providedOrNot;

        const caregiverInitials = entry.providedBy
          ? getInitials(userMap[entry.providedBy])
          : "";

        if (caregiverInitials) {
          cell.status = caregiverInitials;
        } else {
          cell.status = entry.providedOrNot === "Provided" ? "P" : "NP";
        }
      }
      return cell;
    });

    return { category, serviceName, days };
  });

  // Build a flat list of all vital sign readings for a detail section
  const vitalSignReadings: any[] = [];
  services.forEach((s: any) => {
    if (s.serviceCategory !== "Vital Signs" || !Array.isArray(s.readings))
      return;

    s.readings.forEach((r: any) => {
      if (!r.time) return;
      const readingDate = format(parseISO(r.time), "yyyy-MM-dd");
      const readingMonth = format(parseISO(r.time), "yyyy-MM");
      if (readingMonth !== month) return;

      vitalSignReadings.push({
        serviceName: displayServiceName("Vital Signs", s.serviceName),
        date: readingDate,
        day: Number(format(parseISO(r.time), "d")),
        time: format(parseISO(r.time), "HH:mm"),
        value: r.value,
      });
    });
  });
  return {
    name,
    home,
    medicaid,
    physicianName,
    // providerAgency,
    // homeProvider,
    month,
    monthLabel: format(monthStart, "MMMM yyyy"),
    rows,
    vitalSignReadings,
  };
};

export default CarePlanDataLayer;
