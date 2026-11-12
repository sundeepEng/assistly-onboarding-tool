import { NextPage } from "next";
import React, { useContext, useEffect, useMemo, useState } from "react";
import Comments from "../../../commonComponents/comments/comments";
import ToggleButton from "../../../commonComponents/toggle-button";
import InputFieldComponent from "../../../commonComponents/input-field-component";
import useUpdate from "../../../services/update";
import {
  CLINICAL_USER_PATH_OMIT_FIELDS,
  ClinicalUserPath,
  DEFAULT_ADL_FIELDS,
  HOUSEKEEPING_LABELS,
  VITAL_SIGN_LABELS,
} from "../../../utils/constants";
import { formatIsoToLocalTime, getSelectedDateTimeIso, getYYYYMMDDString, omit } from "../../../utils/dateUtils";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import { RoleContext } from "../../role-provider";
import {
  getUserIdFromToken,
  getUserRoleFromToken,
} from "../../../utils/auth";
import { ProtectedComponent } from "../../protectedComponent";

interface TaskItemProps {
  service: string;
  description: string;
  index: number;
  onToggle: (state: string) => void;
  activeToggle?: string;
  selectedDate: string;
  editAccess: boolean;
  carePlanData: {
    serviceName: string;
    providedOrNot: string;
    providedAt: string;
  }[];
}

// Extracts the YYYY-MM-DD portion from a UTC ISO string (e.g. "2026-08-05T02:09:00.000Z" -> "2026-08-05")
const getUtcDateFromIso = (isoString?: string): string => isoString?.slice(0, 10) ?? "";

// Normalize legacy single-entry vital sign records (readings across multiple dates in one entry)
// into per-day entries, using providedAt as the day marker.
const normalizeVitalSigns = (services: any[]): any[] => {
  const result: any[] = [];
  services.forEach((s) => {
    if (
      s?.serviceCategory === "Vital Signs" &&
      Array.isArray(s.readings) &&
      s.readings.length > 0 &&
      !s.providedAt
    ) {
      const grouped: Record<string, VitalReading[]> = {};
      s.readings.forEach((r: VitalReading) => {
        // r.time is a real UTC instant of a local wall time — group by its
        // LOCAL date, which is the day the reading was actually taken.
        const t = r.time ? new Date(r.time) : null;
        const date = t && !isNaN(t.getTime()) ? getYYYYMMDDString(t) : ""
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(r);
      });
      Object.entries(grouped).forEach(([date, readings]) => {
        if (!date) return;
        result.push({
          serviceName: s.serviceName,
          serviceCategory: "Vital Signs",
          providedAt: getSelectedDateTimeIso(date),
          readings,
        });
      });
    } else {
      result.push(s);
    }
  });
  return result;
};

const formatServiceName = (str?: string): string => {
  if (!str) return "";
  const separatorIndex = str.indexOf(" - ");
  if (separatorIndex !== -1) {
    const name = str.slice(0, separatorIndex).trim().toLowerCase();
    const description = str.slice(separatorIndex + 3).trim();
    return `${name} - ${description}`;
  }
  return str.toLowerCase().trim();
};

// Convert camel/lower-case keys into readable Title Case labels
const formatKeyLabel = (key: string): string => {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return spaced
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
};

const normalizeServiceName = (str?: string): string =>
  (str ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Finds the care entry for a given service name and selected date by comparing the UTC date part only.
const getDateCareEntry = (
  services: any[],
  serviceName: string,
  selectedDate: string
) => {
  const targetName = normalizeServiceName(serviceName);
  return services?.find((item) => {
    const apiDateOnly = getUtcDateFromIso(item?.providedAt);
    return (
      normalizeServiceName(item?.serviceName) === targetName &&
      apiDateOnly === selectedDate
    );
  });
};


// Single care plan row — shows service name/level and a Provided/Not Provided toggle
const TaskItem: NextPage<TaskItemProps> = ({
  service,
  description,
  activeToggle,
  onToggle,
  editAccess,
}) => {
  return (
    <div className="flex justify-between items-center border-b py-2">
      <div>
        <strong>{service}</strong> - <span>{description}</span>
      </div>
      <div className="flex space-x-2">
        <ToggleButton
          className="rounded-lg"
          passName="Provided"
          refuseName="Not Provided"
          onChange={(state) => onToggle(state)}
          initialState={activeToggle}
          editAccess={editAccess}
          allowUnselect
        />
      </div>
    </div>
  );
};

// Converts a stored UTC ISO string to local time in 12h format (e.g. "2:30 PM")
// Uses formatIsoToLocalTime from dateUtils for consistent timezone handling
const toLocalDisplay = (utcIso: string): string => formatIsoToLocalTime(utcIso);

// Converts native time input value (HH:mm) to a UTC ISO string for storage.
// Parses date+time as LOCAL time (same as MedPass) so the stored instant is
// the real UTC time of the selected local date — new Date("YYYY-MM-DD") alone
// parses as UTC midnight and shifts negative-offset timezones to the prior day.
const toUtcIso = (date: string, hhmm: string): string =>
   new Date(`${date}T${hhmm}`).toISOString();

type VitalReading = { time: string; value: string };

// Multi-record picker for vital signs — each record is a time + value pair
// Multiple readings allowed per vital sign; stored as UTC ISO times
const VitalTimingPicker = ({
  vitalKey,
  label,
  readings,
  onReadingsChange,
  selectedDate,
  editAccess,
}: {
  vitalKey: string;
  label: string;
  readings: VitalReading[];
  onReadingsChange: (key: string, readings: VitalReading[]) => void;
  selectedDate: string;
  editAccess: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [timeVal, setTimeVal] = useState("");
  const [valueVal, setValueVal] = useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Add a new time+value reading to the list
  const addReading = () => {
    if (!timeVal || !valueVal) return;
    const utcIso = toUtcIso(selectedDate, timeVal);
    onReadingsChange(vitalKey, [...readings, { time: utcIso, value: valueVal }]);
    setTimeVal("");
    setValueVal("");
  };

  // Remove a reading by index
  const removeReading = (idx: number) => {
    onReadingsChange(vitalKey, readings.filter((_, i) => i !== idx));
  };

  // Trigger label: show each reading as "time - value" joined by comma, or placeholder
  const displayLabel = readings.length > 0
    ? readings.map((r) => `${toLocalDisplay(r.time)} - ${r.value}`).join(", ")
    : "Add readings";

  return (
    <div ref={ref} className="flex items-start justify-between border-b py-3 gap-4">
      <span className="text-[15px] font-medium text-gray-700 pt-2 min-w-[160px]">{label}</span>
      <div className="relative">
        {/* Trigger — same look as FormMultiSelectComponent */}
        <div
          className={`h-10 rounded-radius-200 bg-background-default-default border-border-default-default border-[1px] border-solid box-border flex flex-row items-center justify-between font-poppins text-base w-[280px] px-[15px] ${editAccess ? "cursor-pointer" : "cursor-default"}`}
          onClick={() => editAccess && setOpen((p) => !p)}
        >
          <span className="text-gray-700 truncate w-[85%]" title={displayLabel}>
            {displayLabel}
          </span>
          <span
            className={`material-icons notranslate MuiIcon-root MuiIcon-fontSizeMedium css-kp9ftd-MuiIcon-root transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            expand_more
          </span>
        </div>

        {open && (
          <div className="absolute right-0 z-50 bg-white border border-border-default-default rounded-md shadow-lg w-[320px] mt-1 p-3 flex flex-col gap-3">
            {editAccess && (
              <>
                {/* Row 1: time picker + value input, constrained to card width */}
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="time"
                    value={timeVal}
                    onChange={(e) => setTimeVal(e.target.value)}
                    className="h-8 w-[110px] shrink-0 rounded-md border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 font-poppins"
                  />
                  <input
                    type="text"
                    value={valueVal}
                    onChange={(e) => setValueVal(e.target.value)}
                    placeholder="e.g. 120/80"
                    className="h-8 flex-1 min-w-0 rounded-md border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 font-poppins"
                  />
                </div>
                {/* Row 2: full-width Add button — app dark theme */}
                <button
                  type="button"
                  onClick={addReading}
                  disabled={!timeVal || !valueVal}
                  className="w-full h-8 rounded-md bg-[#1a1a1a] text-white text-sm font-poppins font-semibold hover:bg-[#333] disabled:opacity-40"
                >
                  Add
                </button>
              </>
            )}
            {/* Saved readings: each row shows local time + value */}
            {readings.length > 0 && (
              <ul className="flex flex-col gap-0 max-h-[180px] overflow-auto">
                {readings.map((r, idx) => (
                  <li
                    key={idx}
                    className="flex justify-between items-center px-2 py-1.5 bg-gray-50 text-gray-800 rounded text-sm font-poppins"
                  >
                    <span className="font-medium">{toLocalDisplay(r.time)}</span>
                    <span className="mx-2 text-gray-400">—</span>
                    <span className="flex-1">{r.value}</span>
                    {editAccess && (
                      <button
                        type="button"
                        onClick={() => removeReading(idx)}
                        className="text-gray-400 hover:text-red-500 font-bold text-base leading-none ml-2"
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Careplan: NextPage<{ seniorData: any }> = ({ seniorData }) => {
  const filledCarePlan = seniorData?.clinical?.carePlan;
  const currentUserId = getUserIdFromToken();
  // Local state mirrors clinical.carePlan.services for immediate UI updates.
  // Vital signs are normalized to one entry per day on load.
  const [carePlanData, setCarePlanData] = useState<any[]>(
    normalizeVitalSigns(filledCarePlan?.services || []),
  );

  // Date selector: max today, like MedPass. Records are filtered/edited for this date.
  const todayDate = getYYYYMMDDString(new Date());
  const contextRole = useContext(RoleContext)?.role;
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [role, setRole] = useState<string | undefined>(contextRole);
  const [editAccess, setEditAccess] = useState(false);
  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole]);
  // Grant edit access based on role permissions
  useEffect(() => {
    if (hasAccess(role as Role, "CLINICAL_MEDPASS", "VIEW")) {
      setEditAccess(false);
    }
    if (
      hasAccess(role as Role, "CLINICAL_MEDPASS", "EDIT") ||
      hasAccess(role as Role, "CLINICAL_TABS", "EDIT")
    ) {
      setEditAccess(true);
    }
  }, [role]);

  // Use today permissions for the current date; use separate history permissions for past dates.
  const isToday = selectedDate === todayDate;
  const canEditToday =
    hasAccess(role as Role, "CLINICAL_CAREPLAN", "EDIT") ||
    hasAccess(role as Role, "CLINICAL_TABS", "EDIT");

  const adlEditAccess = isToday
    ? canEditToday
    : hasAccess(role as Role, "CLINICAL_CAREPLAN_ADL_HISTORY_EDIT", "EDIT");
  const housekeepingEditAccess = isToday
    ? canEditToday
    : hasAccess(
      role as Role,
      "CLINICAL_CAREPLAN_HOUSEKEEPING_HISTORY_EDIT",
      "EDIT",
    );
  const vitalsEditAccess = isToday
    ? hasAccess(role as Role, "CLINICAL_CAREPLAN_VITALS", "EDIT")
    : hasAccess(role as Role, "CLINICAL_CAREPLAN_VITALS_HISTORY_EDIT", "EDIT");
  const canEditHistoryComments = hasAccess(
    role as Role,
    "CLINICAL_COMMENTS_HISTORY_EDIT",
    "EDIT",
  );
  // PCG and Nurse can add care plan comments for today; all other roles see them as read-only.
  const commentEditAccess = isToday || canEditHistoryComments;

  // Professional label lookup maps (case-insensitive)
  const adlServiceLabels = useMemo(() => {
    const map = new Map<string, string>();
    DEFAULT_ADL_FIELDS.forEach(({ key, label, section }) => {
      if (section === "adl") {
        const serviceName = label.split(" - ")[0] ?? label;
        map.set(normalizeServiceName(key), serviceName);
      }
    });
    return map;
  }, []);

  const vitalLabelsMap = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(VITAL_SIGN_LABELS).forEach(([k, v]) =>
      map.set(normalizeServiceName(k), v)
    );
    return map;
  }, []);

  const hkLabelsMap = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(HOUSEKEEPING_LABELS).forEach(([k, v]) =>
      map.set(normalizeServiceName(k), v)
    );
    return map;
  }, []);

  const getAdlDisplayLabel = (rawKey: string) =>
    adlServiceLabels.get(normalizeServiceName(rawKey)) ?? formatKeyLabel(rawKey);
  const getVitalDisplayLabel = (rawKey: string) =>
    vitalLabelsMap.get(normalizeServiceName(rawKey)) ?? formatKeyLabel(rawKey);
  const getHousekeepingDisplayLabel = (rawKey: string) =>
    hkLabelsMap.get(normalizeServiceName(rawKey)) ?? formatKeyLabel(rawKey);

  // Only show vital signs that are enabled (true) in the care plan
  const activeVitalSigns = Object.entries(seniorData?.carePlan?.vitalSigns ?? {})
    .filter(([, val]) => val === true)
    .map(([key]) => key);

  // Only show housekeeping services that have an active level assigned
  const activeHousekeeping = Object.entries(seniorData?.carePlan?.housekeeping ?? {})
    .filter(([, val]) => val && val !== "Not Required")
    .map(([key, val]) => ({ key, level: val as string }));

  // Look up the saved service entry for a vital sign by serviceName and selected date
  const getVitalEntry = (key: string, date: string = selectedDate) =>
    carePlanData.find(
      (s) =>
        s.serviceCategory === "Vital Signs" &&
        normalizeServiceName(s.serviceName) === normalizeServiceName(key) &&
        getUtcDateFromIso(s?.providedAt) === date
    );

  // Returns the saved readings array for a vital sign on the selected date
  const getVitalReadings = (key: string): VitalReading[] =>
    getVitalEntry(key, selectedDate)?.readings ?? [];

  // Look up the saved service entry for a housekeeping item by serviceName and selected date
  const getHousekeepingEntry = (key: string) =>
    carePlanData.find(
      (s) =>
        s.serviceCategory === "House Keeping" &&
        normalizeServiceName(s.serviceName) === normalizeServiceName(key) &&
        getUtcDateFromIso(s?.providedAt) === selectedDate
    );

  // Build the ADL/IADL service list from care plan data, skipping Independent entries
  const adlServiceMap: Record<
    string,
    { service: string; description: string; providedOrNot: string }
  > = {};
  const combinedDataRaw = {
    ...seniorData?.carePlan?.adl,
    ...seniorData?.carePlan?.iadl,
  };
  const { comments, ...combinedData } = combinedDataRaw;
  combinedData &&
    Object?.entries(combinedData).forEach(([key, values]: [string, any]) => {
      const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);

      Object?.entries(values).forEach(([subKey, value]) => {
        if (subKey === "careLevel") {
          if (value != "Independent") {
            const serviceName = formatServiceName(`${formattedKey} - ${value}`);
            const carePlanEntry = getDateCareEntry(
              carePlanData,
              serviceName,
              selectedDate
            );
            const norm = normalizeServiceName(serviceName);
            adlServiceMap[norm] = {
              service: getAdlDisplayLabel(String(key)),
              description: String(value),
              providedOrNot: carePlanEntry?.providedOrNot || "",
            };
          }
        } else if (value != "No" && value != "Independent") {
          const formattedValue = subKey.replace(/([A-Z])/g, " $1").trim();
          const serviceName = formatServiceName(
            `${formattedKey} - ${formattedValue}`
          );
          const carePlanEntry = getDateCareEntry(
            carePlanData,
            serviceName,
            selectedDate
          );
          const norm = normalizeServiceName(serviceName);
          adlServiceMap[norm] = {
            service: getAdlDisplayLabel(String(key)),
            description: formattedValue,
            providedOrNot: carePlanEntry?.providedOrNot || "",
          };
        }
      });
    });

  // Add historical ADL entries that are not already in the current care plan
  carePlanData
    .filter(
      (s) =>
        s?.serviceCategory === "ADL" &&
        getUtcDateFromIso(s?.providedAt) === selectedDate
    )
    .forEach((s) => {
      const norm = normalizeServiceName(s.serviceName);
      if (adlServiceMap[norm]) return;

      const separatorIndex = s.serviceName.indexOf(" - ");
      const rawService =
        separatorIndex !== -1
          ? s.serviceName.slice(0, separatorIndex).trim().toLowerCase()
          : s.serviceName.toLowerCase();
      const description =
        separatorIndex !== -1
          ? s.serviceName.slice(separatorIndex + 3).trim()
          : "";

      adlServiceMap[norm] = {
        service: getAdlDisplayLabel(rawService),
        description,
        providedOrNot: s?.providedOrNot,
      };
    });
  const mergedCarePlan = Object.values(adlServiceMap);

  // Merge current and historical housekeeping, deduped by normalized name
  const seenHousekeeping = new Set<string>();
  const mergedHousekeeping: {
    key: string;
    level: string;
    label: string;
  }[] = [];
  activeHousekeeping.forEach(({ key, level }) => {
    const norm = normalizeServiceName(key);
    if (seenHousekeeping.has(norm)) return;
    seenHousekeeping.add(norm);
    mergedHousekeeping.push({
      key,
      level,
      label: getHousekeepingDisplayLabel(key),
    });
  });
  carePlanData
    .filter(
      (s) =>
        s?.serviceCategory === "House Keeping" &&
        getUtcDateFromIso(s?.providedAt) === selectedDate
    )
    .forEach((s) => {
      const norm = normalizeServiceName(s.serviceName);
      if (seenHousekeeping.has(norm)) return;
      seenHousekeeping.add(norm);
      mergedHousekeeping.push({
        key: s.serviceName,
        level: "Historical",
        label: getHousekeepingDisplayLabel(s.serviceName),
      });
    });

  // Merge current and historical vital signs, deduped by normalized name
  const seenVitalSigns = new Set<string>();
  const mergedVitalSigns: { key: string; label: string }[] = [];
  activeVitalSigns.forEach((key) => {
    const norm = normalizeServiceName(key);
    if (seenVitalSigns.has(norm)) return;
    seenVitalSigns.add(norm);
    mergedVitalSigns.push({ key, label: getVitalDisplayLabel(key) });
  });
  carePlanData
    .filter(
      (s) =>
        s?.serviceCategory === "Vital Signs" &&
        getUtcDateFromIso(s?.providedAt) === selectedDate
    )
    .forEach((s) => {
      const norm = normalizeServiceName(s.serviceName);
      if (seenVitalSigns.has(norm)) return;
      seenVitalSigns.add(norm);
      mergedVitalSigns.push({
        key: s.serviceName,
        label: getVitalDisplayLabel(s.serviceName),
      });
    });

  const { mutate } = useUpdate();

  // Sanitizes each service entry to match schema expectations before saving:
  // - Vital Signs: keep providedAt as the day marker and readings[]
  // - ADL / House Keeping: use providedAt string, remove readings
  const sanitizeServices = (services: any[]): any[] =>
    services.map((s) => {
      if (s.serviceCategory === "Vital Signs") {
        return s;
      }
      const { readings, ...rest } = s;
      return rest;
    });

  // Saves the updated services array to clinical.carePlan.services and persists to DB
  const persistServices = (updatedServices: any[]) => {
    if (!seniorData.clinical) seniorData.clinical = {};
    if (!seniorData.clinical.carePlan) seniorData.clinical.carePlan = { comments: [], services: [] };
    seniorData.clinical.carePlan.services = sanitizeServices(updatedServices);
    const cleanedData: any = omit(seniorData.clinical, CLINICAL_USER_PATH_OMIT_FIELDS);
    mutate({ data: cleanedData, path: ClinicalUserPath });
  };

  // Updates vital sign readings for the selected date.
  // Each day has its own Vital Signs entry keyed by providedAt (UTC date marker).
  const handleVitalReadingsChange = (
    key: string,
    newReadingsForSelectedDate: VitalReading[]
  ) => {
    const updated = carePlanData.filter(
      (s) =>
        !(
          s.serviceCategory === "Vital Signs" &&
          normalizeServiceName(s.serviceName) === normalizeServiceName(key) &&
          getUtcDateFromIso(s?.providedAt) === selectedDate
        )
    );
    if (newReadingsForSelectedDate.length > 0) {
      updated.push({
        serviceName: formatServiceName(key),
        serviceCategory: "Vital Signs",
        providedAt: getSelectedDateTimeIso(selectedDate),
        readings: newReadingsForSelectedDate,
      });
    }
    setCarePlanData(updated);
    persistServices(updated);
  };

  // Toggles housekeeping service provided status for the selected date; removes entry if unselected
  const handleHousekeepingToggle = (key: string, state: string) => {
    const updated = carePlanData.filter(
      (s) =>
        !(
          s.serviceCategory === "House Keeping" &&
          normalizeServiceName(s.serviceName) === normalizeServiceName(key) &&
          getUtcDateFromIso(s?.providedAt) === selectedDate
        )
    );
    if (state !== "") {
      updated.push({
        serviceName: formatServiceName(key),
        serviceCategory: "House Keeping",
        providedOrNot: state,
        providedAt: getSelectedDateTimeIso(selectedDate),
        providedBy: currentUserId,
      });
    }
    setCarePlanData(updated);
    persistServices(updated);
  };

  // Handles ADL service toggle — updates or creates entry for the selected date, removes if unselected
  const handleToggle = (
    service: string,
    description: string,
    state: string,
  ) => {
    const serviceName = formatServiceName(`${service} - ${description}`);

    const updatedServices = [...carePlanData];

    // Find existing entry for the selected date to update instead of duplicating
    const existingIndex = updatedServices.findIndex((item) => {
      const apiDateOnly = getUtcDateFromIso(item?.providedAt);

      return (
        normalizeServiceName(item.serviceName) ===
        normalizeServiceName(serviceName) && apiDateOnly === selectedDate
      );
    });

    if (state === "") {
      if (existingIndex !== -1) {
        updatedServices.splice(existingIndex, 1);
      }
    } else if (existingIndex !== -1) {
      updatedServices[existingIndex] = {
        ...updatedServices[existingIndex],
        providedOrNot: state,
        providedAt: getSelectedDateTimeIso(selectedDate),
        providedBy: currentUserId,
      };
    } else {
      updatedServices.push({
        serviceName,
        serviceCategory: "ADL",
        providedOrNot: state,
        providedAt: getSelectedDateTimeIso(selectedDate),
        providedBy: currentUserId,
      });
    }

    setCarePlanData(updatedServices);
    persistServices(updatedServices);
  };

  // Fallback manual save (used if auto-persist is bypassed)
  const handleSubmit = () => {
    if (!seniorData?.clinical?.carePlan) {
      seniorData.clinical.carePlan = { services: [] };
    }
    seniorData.clinical.carePlan.services =
      carePlanData?.length > 0
        ? carePlanData
        : seniorData.clinical.carePlan.services;

    const cleanedCareplanData: any = omit(
      seniorData?.clinical,
      CLINICAL_USER_PATH_OMIT_FIELDS,
    );
    const payload = { data: cleanedCareplanData, path: ClinicalUserPath };
    mutate(payload);
  };

  // Saves updated comments to clinical.carePlan.comments
  const handleSubmitComment = (updatedComments) => {
    if (!seniorData?.clinical?.carePlan) {
      seniorData.clinical.carePlan = { comments: [], services: [] };
    }
    seniorData.clinical.carePlan.comments =
      updatedComments?.length > 0
        ? updatedComments
        : seniorData.clinical.carePlan.comments;

    const cleanedCareplanData: any = omit(
      seniorData?.clinical,
      CLINICAL_USER_PATH_OMIT_FIELDS,
    );
    const payload = { data: cleanedCareplanData, path: ClinicalUserPath };
    mutate(payload);
  };

  // Only render the main card if there is at least one section to show
  const hasContent = mergedCarePlan?.length > 0 || mergedVitalSigns.length > 0 || mergedHousekeeping.length > 0;

  return (
    <div
      className={`bg-[#FAFAFA] h-full ${seniorData?.isDeleted ? "cursor-not-allowed opacity-70" : ""
        }`}
    >
      <div
        className={`${seniorData?.isDeleted ? "pointer-events-none" : ""
          } flex flex-col gap-6`}
      >
        {/* Single card with all sections separated by distinct headers */}
        {hasContent && (
          <div className="bg-white px-20 py-10 rounded-lg shadow">
            {/* Date selector — max today, same as MedPass */}
            <div className="flex justify-end mb-6">
              <div className="w-[200px]">
                <InputFieldComponent
                  label={<></>}
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  name="careplanDate"
                  max={todayDate}
                />
              </div>
            </div>

            {/* Section 1: ADL Services */}
            {mergedCarePlan?.length > 0 && (
              <div className="mb-6">
                <h2 className="text-[18px] font-semibold text-gray-800 mb-2 pb-2 border-b">Care Plan Services</h2>
                {mergedCarePlan.map(({ service, description, providedOrNot }, index) => (
                  <TaskItem
                    key={`${normalizeServiceName(service)}-${index}`}
                    service={service}
                    description={description}
                    index={index}
                    onToggle={(state) =>
                      handleToggle(service, description, state)
                    }
                    carePlanData={carePlanData}
                    activeToggle={providedOrNot}
                    selectedDate={selectedDate}
                    editAccess={adlEditAccess}
                  />
                ))}
              </div>
            )}

            {/* Section 2: Housekeeping Services */}
            {mergedHousekeeping.length > 0 && (
              <div className="mb-6">
                <h2 className="text-[18px] font-semibold text-gray-800 mb-2 pb-2 border-b">Housekeeping Services</h2>
                {mergedHousekeeping.map(({ key, level, label }) => (
                  <div key={normalizeServiceName(key)} className="flex justify-between items-center border-b py-2">
                    <div>
                      <strong>{label}</strong>
                      <span className="ml-2 text-sm text-gray-500">({level})</span>
                    </div>
                    <ToggleButton
                      className="rounded-lg"
                      passName="Provided"
                      refuseName="Not Provided"
                      onChange={(state) => handleHousekeepingToggle(key, state)}
                      initialState={getHousekeepingEntry(key)?.providedOrNot ?? ""}
                      editAccess={housekeepingEditAccess}
                      allowUnselect
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Section 3: Vital Signs — each sign has multiple time+value readings */}
            {mergedVitalSigns.length > 0 && (
              <div>
                <h2 className="text-[18px] font-semibold text-gray-800 mb-2 pb-2 border-b">Vital Signs</h2>
                {mergedVitalSigns.map(({ key, label }) => (
                  <VitalTimingPicker
                    key={`${normalizeServiceName(key)}-${selectedDate}`}
                    vitalKey={key}
                    label={label}
                    readings={getVitalReadings(key)}
                    onReadingsChange={handleVitalReadingsChange}
                    selectedDate={selectedDate}
                    editAccess={vitalsEditAccess}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Comments */}
        {hasAccess(role as Role, "CLINICAL_CAREPLAN_COMMENTS", ["VIEW","EDIT"]) && (
          <div className="bg-white px-20 py-10 rounded-lg shadow flex">
            <Comments
              handleSubmitComment={handleSubmitComment}
              data={seniorData?.clinical?.carePlan?.comments}
              selectedDate={selectedDate}
              editAccess={commentEditAccess}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Careplan;
