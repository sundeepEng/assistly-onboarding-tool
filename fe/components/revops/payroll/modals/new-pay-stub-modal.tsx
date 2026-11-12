"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useFieldArray,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { z } from "zod";
import CommonModal from "../../../../commonComponents/common-modal";
import Form from "../../../../commonComponents/form";
import FormSelectComponent from "../../../../commonComponents/form-select-component";
import Button from "../../../../commonComponents/button";
import { Plus } from "lucide-react";
import type { RevopsPayStubPeriodType } from "../../../../utils/revops/mock-data";
import { formatCurrency } from "../payroll-utils";
import { getHomeIdFromToken, getUserIdFromToken } from "../../../../utils/auth";
import useCreate from "../../../../services/create";
import useGetAll from "../../../../services/getAll";
import useGetAllShifts from "../../../../services/hcm-getall-shifts";
import { GetUsersPath, SHIFT_STATUS_AVAILABLE, payStubPath, userRoles } from "../../../../utils/constants";
import useUpdate from "../../../../services/update";
import { identity } from "lodash";
import { useDispatch } from "react-redux";
import { handleOpenPopover, handleShowCloseOptions, handleShowPopoverMessage } from "../../../../redux/slices/exception-popover-slice";
import FormInputFieldComponent from "../../../../commonComponents/form-input-field-component";
import PopoverComponent from "../../../../commonComponents/popover-component";
import InfoIcon from "../../../../public/icons/info-circle-icon";
import {
  REVOPS_PAY_STUB_PERIOD_TYPE_OPTIONS,
  REVOPS_PAY_STUB_PERIOD_TYPE_UI,
  REVOPS_PAY_STUB_PERIOD_TYPE_BACKEND,
  REVOPS_PAY_STUB_PLACEHOLDERS,
  REVOPS_PAY_STUB_VALIDATION_MESSAGES,
  buildRevopsBiWeeklyDateRangeOptions,
  buildRevopsMonthOptions,
} from "../../../../utils/revops/constants";
// import useUpsert from "../../../../services/upsert";

export type NewPayStubFormData = {
  periodType: RevopsPayStubPeriodType;
  month: string;
  dateRange: string;
  caregiverId: string;
  hoursWorked: number;
  hourlyRate: number;
  expenses: { description: string; amount: number; payout_item_id?: string }[];
};

type PayStubModalMode = "create" | "edit";

// UI form schema - validates user input before transforming to backend payload
export const NewPayStubSchema = z
  .object({
    periodType: z
      .string()
      .min(1, REVOPS_PAY_STUB_VALIDATION_MESSAGES.PERIOD_TYPE_REQUIRED),
    month: z.string().min(1, REVOPS_PAY_STUB_VALIDATION_MESSAGES.MONTH_REQUIRED),
    dateRange: z.string().optional(),
    caregiverId: z
      .string()
      .min(1, REVOPS_PAY_STUB_VALIDATION_MESSAGES.CAREGIVER_REQUIRED),
    hoursWorked: z.coerce.number().min(0, "Hours must be 0 or greater"),
    hourlyRate: z.coerce.number().min(0, "Hourly rate must be 0 or greater"),
    expenses: z
      .array(
        z.object({
          description: z.string().min(1, "Description is required"),
          amount: z.coerce.number().min(0.01, "Amount is required"),
          payout_item_id: z.string().optional(),
        }),
      )
      .default([]),
  })
  .superRefine((data, ctx) => {
    if (data.periodType === REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY && !data.dateRange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: REVOPS_PAY_STUB_VALIDATION_MESSAGES.DATE_RANGE_REQUIRED,
        path: ["dateRange"],
      });
    }
  });

type ShiftRateGroup = {
  rate: number;
  hours: number;
  wage: number;
};

function parsePayRate(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]+/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function getShiftWorkedHours(shift: any): number {
  const start = shift?.clock_in_timestamp ? new Date(shift.clock_in_timestamp) : null;
  const end = shift?.clock_out_timestamp ? new Date(shift.clock_out_timestamp) : null;
  if (!start || !end) return 0;
  const s = start.getTime();
  const e = end.getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
  const diff = e - s;
  if (diff <= 0) return 0;
  return diff / (1000 * 60 * 60);
}

/**
 * Reusable form input component with validation error display
 */

/**
 * Editor for additional expenses - allows adding/removing expense line items
 */
function AdditionalExpensesEditor() {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: "expenses" });
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <div>
      <div className="grid grid-cols-[1.4fr,0.6fr,40px] gap-2 items-end">
        <div>
          <div className="text-xs text-[#6B7280] mb-1">Description</div>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="w-full h-9 rounded-radius-200 border-border-default-default border-[1px] border-solid px-[12px] font-poppins"
            placeholder="Description (e.g., Tips)"
          />
        </div>
        <div>
          <div className="text-xs text-[#6B7280] mb-1">Amount</div>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            step="0.01"
            className="w-full h-9 rounded-radius-200 border-border-default-default border-[1px] border-solid px-[12px] font-poppins"
            placeholder="Amount"
          />
        </div>
        <button
          type="button"
          className="h-9 w-9 rounded-radius-200 border border-[#E5E7EB] bg-white flex items-center justify-center"
          onClick={() => {
            const amt = Number(amount);
            if (!desc.trim() || !Number.isFinite(amt) || amt <= 0) return;
            append({ description: desc.trim(), amount: amt });
            setDesc("");
            setAmount("");
          }}
        >
          <Plus size={16} className="text-[#111827]" />
        </button>
      </div>

      {fields.length > 0 && (
        <div className="mt-3 rounded-[10px] border border-[#E5E7EB] overflow-hidden">
          {fields.map((f, idx) => (
            <div
              key={f.id}
              className={`px-4 py-2 bg-white flex items-center justify-between gap-3 ${
                idx !== fields.length - 1 ? "border-b border-[#E5E7EB]" : ""
              }`}
            >
              <div className="flex-1">
                <div className="text-sm text-[#111827]">
                  {(f as unknown as { description?: string })?.description || ""}
                </div>
              </div>
              <div className="text-sm font-semibold text-[#111827]">
                {formatCurrency(
                  Number((f as unknown as { amount?: number })?.amount) || 0,
                )}
              </div>
              <div className="">
                <Button name="Remove" buttonClick={() => remove(idx)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Displays computed pay stub amounts and expense breakdown
 */
function NewPayStubComputedSection({
  monthlyRosterRate,
  shiftRateGroups,
  derivedTotalHours,
  derivedTotalWages,
  hasMixedHourlyRates,
  infoOpen,
  setInfoOpen,
}: {
  monthlyRosterRate: number | null;
  shiftRateGroups: ShiftRateGroup[];
  derivedTotalHours: number;
  derivedTotalWages: number;
  hasMixedHourlyRates: boolean;
  infoOpen: boolean;
  setInfoOpen: (open: boolean) => void;
}) {
  const { control, setValue } = useFormContext();
  const [localInfoOpen, setLocalInfoOpen] = useState(false);
  const periodType = useWatch({ control, name: "periodType" }) as
    | RevopsPayStubPeriodType
    | undefined;
  const hoursWorked = useWatch({ control, name: "hoursWorked" }) as
    | number
    | undefined;
  const hourlyRate = useWatch({ control, name: "hourlyRate" }) as
    | number
    | undefined;
  const expenses = useWatch({ control, name: "expenses" }) as
    | { description?: string; amount?: number }[]
    | undefined;

  useEffect(() => {
    if (hourlyRate == null) setValue("hourlyRate", 0);
    if (hoursWorked == null) setValue("hoursWorked", 0);
  }, [setValue, hourlyRate, hoursWorked]);

  const isMonthlyRoster = monthlyRosterRate != null && Number.isFinite(monthlyRosterRate);
  const effectiveRate = isMonthlyRoster ? Number(monthlyRosterRate) : Number(hourlyRate) || 0;
  const baseAmount = isMonthlyRoster
    ? effectiveRate
    : hasMixedHourlyRates
      ? Number(derivedTotalWages) || 0
      : (Number(hoursWorked) || 0) * (Number(effectiveRate) || 0);
  const expenseTotal = (expenses || []).reduce(
    (acc, e) => acc + (Number(e?.amount) || 0),
    0,
  );
  const totalAmount = baseAmount + expenseTotal;

  const rateLabel = isMonthlyRoster
    ? periodType === REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY
      ? "Bi-Weekly Rate ($)"
      : "Monthly Rate ($)"
    : "Hourly Rate ($)";

  const basePayLabel = isMonthlyRoster
    ? periodType === REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY
      ? "Base Pay (Bi-Weekly Rate)"
      : "Base Pay (Monthly Rate)"
    : hasMixedHourlyRates
      ? "Base Pay (Mixed hourly rates)"
      : `Base Pay (${Number(hoursWorked) || 0}h x $${Number(effectiveRate) || 0}/h)`;

  return (
    <div className="mt-3">
      {!hasMixedHourlyRates && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <FormInputFieldComponent
              name="hoursWorked"
              label="Hours Worked"
              type="number"
              readOnly
            />
            <div className="mt-5">
              <PopoverComponent
                body={
                  <div className="w-[300px] font-poppins">
                    Hours worked is calculated based on the shifts logged by the caregiver.
                  </div>
                }
                isOpen={localInfoOpen}
                setIsOpen={setLocalInfoOpen}
                triggerOnHover={true}
                zIndex={1001}
              >
                <div className="flex cursor-pointer w-[20px] h-[20px] rounded-lg justify-center">
                  <InfoIcon />
                </div>
              </PopoverComponent>
            </div>
          </div>
          <FormInputFieldComponent
            name="hourlyRate"
            label={rateLabel}
            type="number"
            readOnly
          />
        </div>
      )}

      {hasMixedHourlyRates && shiftRateGroups.length > 0 && (
        <div className="mt-3 rounded-[10px] border border-[#E5E7EB] bg-white overflow-hidden">
          <div className="px-4 py-2 bg-[#F9FAFB] text-xs font-semibold text-[#111827] grid grid-cols-3">
            <div>Hourly Rate</div>
            <div className="text-right">Hours</div>
            <div className="text-right">Wages</div>
          </div>
          {shiftRateGroups.map((g) => (
            <div
              key={String(g.rate)}
              className="px-4 py-2 text-sm text-[#111827] grid grid-cols-3 border-t border-[#E5E7EB]"
            >
              <div>{formatCurrency(g.rate)}/hr</div>
              <div className="text-right">{Number(g.hours || 0).toFixed(2)}</div>
              <div className="text-right">{formatCurrency(g.wage)}</div>
            </div>
          ))}
          <div className="px-4 py-2 text-sm font-semibold text-[#111827] grid grid-cols-3 border-t border-[#E5E7EB] bg-[#F9FAFB]">
            <div>Total</div>
            <div className="text-right">{Number(derivedTotalHours || 0).toFixed(2)}</div>
            <div className="text-right">{formatCurrency(Number(derivedTotalWages) || 0)}</div>
          </div>
        </div>
      )}

      <div className="mt-3 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 flex items-center justify-between">
        <div className="text-sm text-[#6B7280]">Base Amount</div>
        <div className="text-sm font-semibold text-[#111827]">
          {formatCurrency(baseAmount)}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-sm font-semibold text-[#111827]">
          Additional Expenses / Miscellaneous
        </div>
        <div className="mt-2">
          <AdditionalExpensesEditor />
        </div>
      </div>

      <div className="mt-4 rounded-[10px] border border-[#E5E7EB] bg-[#F3F4F6] overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-[#111827]">
            {basePayLabel}
          </div>
          <div className="text-sm font-semibold text-[#111827]">
            {formatCurrency(baseAmount)}
          </div>
        </div>
        <div className="px-4 py-3 flex items-center justify-between border-t border-[#E5E7EB] bg-[#EEF2FF]">
          <div className="text-sm font-semibold text-[#111827]">Total Amount</div>
          <div className="text-lg font-bold text-[#1D4ED8]">
            {formatCurrency(totalAmount)}
          </div>
        </div>
      </div>

    </div>
  );
}

/**
 * Conditional date range selector - only shown for Bi-Weekly period type
 */
function BiWeeklyDateRangeField({
  options,
  onChange,
  disabled,
}: {
  options: { option: string; value: string }[];
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const { control, setValue } = useFormContext();
  const periodType = useWatch({ control, name: "periodType" }) as
    | RevopsPayStubPeriodType
    | undefined;

  useEffect(() => {
    if (periodType !== REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY) {
      setValue("dateRange", "");
    }
  }, [periodType, setValue]);

  if (periodType !== REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY) return null;

  return (
    <FormSelectComponent
      label="Date Range"
      name="dateRange"
      options={options}
      placeHolder={REVOPS_PAY_STUB_PLACEHOLDERS.DATE_RANGE}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      containerClass="!gap-1"
      titleClass="!text-xs"
    />
  );
}

/**
 * Main modal component for creating new pay stubs
 * Self-contained with internal data fetching and API submission
 */
export default function RevopsPayrollNewPayStubModal({
  isOpen,
  onClose,
  onCreated,
  mode = "create",
  initialPayStub,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  /**
   * Mode controls whether we POST (create) or PUT (edit/update).
   * Default is create to avoid behavior changes in existing call sites.
   */
  mode?: PayStubModalMode;
  /**
   * When editing, pass the existing payout row (backend shape) so we can prefill the form.
   */
  initialPayStub?: any | null;
}) {
  // Form ref for programmatic control
  const payStubFormMethodsRef = useRef<any>(null);

  // React Query client (used to refresh pay stub list after create/update)
  const queryClient = useQueryClient();

  // Auth context
  const homeId = getHomeIdFromToken() ?? "";
  const pchoId = getUserIdFromToken() ?? "";

  // Local state for form filters
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedPeriodType, setSelectedPeriodType] = useState<RevopsPayStubPeriodType | "">("");
  const [selectedDateRange, setSelectedDateRange] = useState<string>("");
  const [infoOpen, setInfoOpen] = useState(false);

  const isEditMode = mode === "edit";

  const monthOptions = useMemo(() => buildRevopsMonthOptions(), []);

  const payPeriodTypeOptions = useMemo(
    () => REVOPS_PAY_STUB_PERIOD_TYPE_OPTIONS as unknown as { option: string; value: string }[],
    [],
  );

  const biWeeklyDateRangeOptions = useMemo(
    () => buildRevopsBiWeeklyDateRangeOptions(selectedMonth),
    [selectedMonth],
  );

  // Fetch caregivers
  const { data: activeEmployees, isLoading: isLoadingCaregivers } = useGetAll({
    key: userRoles.PCG,
    params: {
      userType: userRoles.PCG,
      homeId: homeId,
    },
    path: GetUsersPath,
  });

  const monthlyRosterRate = useMemo(() => {
    if (!selectedCaregiverId) return null;

    const selectedCaregiver = (activeEmployees?.users ?? []).find(
      (u: any) => u?.userId === selectedCaregiverId,
    );
    if (!selectedCaregiver?.roaster?.length) return null;

    const roasterItem = selectedCaregiver.roaster[0];
    const payFrequency = String(roasterItem?.pay_frequency || "").trim().toLowerCase();
    if (payFrequency !== "monthly") return null;

    const payRate = (() => {
      const raw = roasterItem?.pay_rate;
      if (raw == null) return NaN;
      if (typeof raw === "number") return raw;
      const cleaned = String(raw).replace(/[^0-9.-]+/g, "");
      return Number(cleaned);
    })();

    if (!Number.isFinite(payRate)) return null;
    if (selectedPeriodType === REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY) return payRate / 2;
    return payRate;
  }, [activeEmployees?.users, selectedCaregiverId, selectedPeriodType]);

  useEffect(() => {
    if (!payStubFormMethodsRef.current) return;
    if (mode === "edit") return;
    if (monthlyRosterRate == null) return;
    if (!Number.isFinite(monthlyRosterRate)) return;

    payStubFormMethodsRef.current.setValue?.(
      "hourlyRate",
      Number(monthlyRosterRate.toFixed(2)),
    );
  }, [mode, monthlyRosterRate]);

  // Caregiver options for dropdown
  const caregiverOptions = useMemo(
    () =>
      (activeEmployees?.users ?? [])
        .filter((u: any) => !u?.isDeleted)
        .map((u: any) => ({
          option: u?.name,
          value: u?.userId,
        })),
    [activeEmployees?.users],
  );

  // Build shift query params based on selected filters
  const shiftsParams = useMemo(() => {
    // Edit modal should not re-query shifts and overwrite prefilled values.
    // We keep the edit experience predictable and aligned with the existing payout values.
    if (mode === "edit") return undefined;
    if (!homeId) return undefined;
    if (!selectedCaregiverId) return undefined;
    if (!selectedMonth) return undefined;

    if (selectedPeriodType === REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY && !selectedDateRange) {
      return undefined;
    }

    const [yyyy, mm] = selectedMonth.split("-").map(Number);
    if (!yyyy || !mm) return undefined;

    const lastDay = new Date(yyyy, mm, 0).getDate();

    let startDay = 1;
    let endDay = lastDay;
    if (selectedPeriodType === REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY && selectedDateRange) {
      const [startStr, endStr] = selectedDateRange.split("-");
      const parsedStart = Number(startStr);
      const parsedEnd = Number(endStr);
      if (!Number.isNaN(parsedStart)) startDay = parsedStart;
      if (!Number.isNaN(parsedEnd)) endDay = parsedEnd;
    }

    const start = new Date(yyyy, mm - 1, startDay);
    start.setHours(0, 0, 0, 0);
    const end = new Date(yyyy, mm - 1, endDay);
    end.setHours(23, 59, 59, 999);

    const params: { [key: string]: any } = {
      shift_status: SHIFT_STATUS_AVAILABLE,
      home_id: homeId,
      user_id: selectedCaregiverId,
    };

    params.shift_start_time = [start.toISOString(), end.toISOString()];

    return params as Record<string, string | string[]>;
  }, [homeId, mode, selectedCaregiverId, selectedDateRange, selectedMonth, selectedPeriodType]);

  // Fetch shifts for auto-calculating hours/wages
  const {
    data: allShifts,
    isLoading: isLoadingShifts,
    isError: isErrorShifts,
  } = useGetAllShifts({
    key: "shifts",
    params: shiftsParams,
    enabled: Boolean(shiftsParams),
  });

  const shiftRateGroups = useMemo((): ShiftRateGroup[] => {
    if (!shiftsParams) return [];
    const shifts = Array.isArray(allShifts?.shifts) ? allShifts.shifts : [];
    const map = new Map<number, { hours: number; wage: number }>();
    for (const s of shifts) {
      const rate = parsePayRate(s?.pay_rate);
      const hours = getShiftWorkedHours(s);
      if (!Number.isFinite(rate) || rate <= 0) continue;
      if (!Number.isFinite(hours) || hours <= 0) continue;
      const wage = Math.round(hours * rate * 100) / 100;
      const prev = map.get(rate) ?? { hours: 0, wage: 0 };
      map.set(rate, {
        hours: prev.hours + hours,
        wage: prev.wage + wage,
      });
    }
    return Array.from(map.entries())
      .map(([rate, v]) => ({
        rate,
        hours: Math.round(v.hours * 100) / 100,
        wage: Math.round(v.wage * 100) / 100,
      }))
      .sort((a, b) => a.rate - b.rate);
  }, [allShifts?.shifts]);

  const derivedTotalHours = useMemo(() => {
    return Math.round(
      shiftRateGroups.reduce((acc, g) => acc + (Number(g.hours) || 0), 0) * 100,
    ) / 100;
  }, [shiftRateGroups]);

  const derivedTotalWages = useMemo(() => {
    return Math.round(
      shiftRateGroups.reduce((acc, g) => acc + (Number(g.wage) || 0), 0) * 100,
    ) / 100;
  }, [shiftRateGroups]);

  const hasMixedHourlyRates = useMemo(() => {
    return shiftRateGroups.length > 1;
  }, [shiftRateGroups.length]);

  // Auto-populate hours and hourly rate when shifts are loaded
  useEffect(() => {
    if (!payStubFormMethodsRef.current) return;
    if (!shiftsParams) return;
    if (isLoadingShifts) return;
    if (isErrorShifts) return;

    payStubFormMethodsRef.current.setValue?.(
      "hoursWorked",
      Number(derivedTotalHours.toFixed(2)),
    );

    if (mode !== "edit" && monthlyRosterRate != null && Number.isFinite(monthlyRosterRate)) {
      payStubFormMethodsRef.current.setValue?.(
        "hourlyRate",
        Number(monthlyRosterRate.toFixed(2)),
      );
      return;
    }

    if (!hasMixedHourlyRates && derivedTotalHours > 0 && shiftRateGroups.length === 1) {
      const computedRate = shiftRateGroups[0]?.rate;
      payStubFormMethodsRef.current.setValue?.(
        "hourlyRate",
        Number((Number.isFinite(computedRate) ? computedRate : 0).toFixed(2)),
      );
      return;
    }

    if (hasMixedHourlyRates) {
      payStubFormMethodsRef.current.setValue?.("hourlyRate", 0);
    }
  }, [derivedTotalHours, hasMixedHourlyRates, isErrorShifts, isLoadingShifts, mode, monthlyRosterRate, shiftRateGroups, shiftsParams]);

  // API mutation for creating pay stub
  const { mutate: createPayStub, isPending: isCreating } = useCreate();
  const { mutate: updatePayStub, isPending: isUpdating } = useUpdate();

  // Form default values
  const defaultValues = useMemo(
    () => ({
      periodType: "" as RevopsPayStubPeriodType,
      month: "",
      dateRange: "",
      caregiverId: "",
      hoursWorked: 0,
      hourlyRate: 0,
      expenses: [] as { description: string; amount: number; payout_item_id?: string }[],
    }),
    [],
  );

  useEffect(() => {
    if (!isOpen) return;
    if (mode === "edit") return;

    setSelectedCaregiverId("");
    setSelectedMonth("");
    setSelectedPeriodType("");
    setSelectedDateRange("");

    queueMicrotask(() => {
      payStubFormMethodsRef.current?.reset?.(defaultValues);
    });
  }, [defaultValues, isOpen, mode]);

  /**
   * Build form defaults from the backend payout object.
   * This keeps the edit flow readable and localized.
   */
  const editDefaultValues = useMemo(() => {
    if (mode !== "edit" || !initialPayStub) return null;

    const periodType: RevopsPayStubPeriodType =
      initialPayStub.period_type === REVOPS_PAY_STUB_PERIOD_TYPE_BACKEND.BIWEEKLY
        ? REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY
        : REVOPS_PAY_STUB_PERIOD_TYPE_UI.MONTHLY;

    // Backend may send ISO datetime or YYYY-MM-DD; for the month select we need YYYY-MM.
    const month = String(initialPayStub.period_start_date || "").slice(0, 7);

    // For bi-weekly we store dateRange as "startDay-endDay" (e.g. "1-15").
    const startDay = Number(String(initialPayStub.period_start_date || "").slice(8, 10));
    const endDay = Number(String(initialPayStub.period_end_date || "").slice(8, 10));
    const dateRange =
      periodType === REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY &&
      Number.isFinite(startDay) &&
      Number.isFinite(endDay)
        ? `${startDay}-${endDay}`
        : "";

    const hoursWorked = Number(((initialPayStub.hours_worked_minutes || 0) / 60).toFixed(2));
    const hourlyRate = Number(((initialPayStub.hourly_rate_cents || 0) / 100).toFixed(2));

    // Map payout items to the modal's additional expenses.
    // We intentionally only include positive amounts here (true "expenses");
    // deductions can exist in the backend but are not supported by the current UI schema.
    const expenses = (initialPayStub.items || [])
      .filter((it: any) => (it?.amount_cents || 0) > 0)
      .filter((it: any) => String(it?.description || "").toLowerCase() !== "base salary")
      .map((it: any) => ({
        description: it?.description || "",
        amount: Number(((it?.amount_cents || 0) / 100).toFixed(2)),
        payout_item_id: it?.payout_item_id,
      }));

    return {
      periodType,
      month,
      dateRange,
      caregiverId: initialPayStub.pcg_user_id || "",
      hoursWorked,
      hourlyRate,
      expenses,
    } as NewPayStubFormData;
  }, [initialPayStub, mode]);

  /**
   * When the edit modal opens, prefill local filter state + RHF form state.
   * RHF defaultValues are only applied on first mount, so we call `reset`.
   */
  useEffect(() => {
    if (!isOpen) return;
    if (mode !== "edit") return;
    if (!editDefaultValues) return;

    setSelectedPeriodType(editDefaultValues.periodType);
    setSelectedMonth(editDefaultValues.month);
    setSelectedDateRange(editDefaultValues.dateRange);
    setSelectedCaregiverId(editDefaultValues.caregiverId);

    // Ensure the form methods exist before we attempt to reset.
    // Using a microtask avoids race conditions with initial render.
    queueMicrotask(() => {
      payStubFormMethodsRef.current?.reset?.(editDefaultValues);
    });
  }, [editDefaultValues, isOpen, mode]);

  // Determine if save button should be disabled
  const isSaveDisabled = Boolean(
    (selectedCaregiverId && selectedMonth && isLoadingShifts) ||
      isLoadingCaregivers ||
      isCreating ||
      isUpdating,
  );

  /**
   * Transform UI form data to backend payload format
   */
  const transformToBackendPayload = (formData: NewPayStubFormData) => {
    const selected = (activeEmployees?.users ?? []).find(
      (u: any) => u?.userId === formData.caregiverId,
    );
    if (!selected) return null;

    const useDerivedHourlyBreakdown = mode !== "edit" && shiftRateGroups.length > 0;
    const hours = useDerivedHourlyBreakdown ? Number(derivedTotalHours) || 0 : Number(formData.hoursWorked) || 0;
    const hourlyRate = Number(formData.hourlyRate) || 0;
    const monthLabel =
      monthOptions.find((m) => m.value === formData.month)?.option || formData.month;

    const biWeeklyLabel =
      biWeeklyDateRangeOptions.find((o) => o.value === formData.dateRange)?.option ||
      formData.dateRange;
    const periodLabel =
      formData.periodType === REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY && formData.dateRange
        ? `${monthLabel} (${biWeeklyLabel})`
        : monthLabel;

    // Calculate dates
    const normalizeDateOnly = (value: string) => {
      if (!value) return value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
      return value;
    };

    const [yyyy, mm] = String(formData.month).split("-").map(Number);
    const lastDay = new Date(yyyy, mm, 0).getDate();
    let startDay = 1;
    let endDay = lastDay;
    if (formData.periodType === REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY && formData.dateRange) {
      const [startStr, endStr] = formData.dateRange.split("-");
      const parsedStart = Number(startStr);
      const parsedEnd = Number(endStr);
      if (!Number.isNaN(parsedStart)) startDay = parsedStart;
      if (!Number.isNaN(parsedEnd)) endDay = parsedEnd;
    }

    const periodStartDate = normalizeDateOnly(
      `${yyyy}-${String(mm).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`,
    );
    const periodEndDate = normalizeDateOnly(
      `${yyyy}-${String(mm).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
    );

    // Convert to backend format (cents and minutes)
    const hoursWorkedMinutes = Math.round(hours * 60);

    const roasterItem = Array.isArray(selected?.roaster) ? selected.roaster[0] : undefined;
    const payFrequency = String(roasterItem?.pay_frequency || "").trim().toLowerCase();
    const rosterMonthlyRate = (() => {
      if (!roasterItem || payFrequency !== "monthly") return null;
      const raw = roasterItem?.pay_rate;
      const parsed = (() => {
        if (raw == null) return NaN;
        if (typeof raw === "number") return raw;
        const cleaned = String(raw).replace(/[^0-9.-]+/g, "");
        return Number(cleaned);
      })();
      if (!Number.isFinite(parsed)) return null;
      return formData.periodType === REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY ? parsed / 2 : parsed;
    })();

    const baseAmountCentsFromShifts = useDerivedHourlyBreakdown
      ? Math.round((Number(derivedTotalWages) || 0) * 100)
      : null;

    const effectiveRate = rosterMonthlyRate != null ? rosterMonthlyRate : hourlyRate;
    const hourlyRateCents = rosterMonthlyRate != null
      ? Math.round((Number(effectiveRate) || 0) * 100)
      : useDerivedHourlyBreakdown
        ? shiftRateGroups.length === 1
          ? Math.round((Number(shiftRateGroups[0]?.rate) || 0) * 100)
          : 0
        : Math.round((Number(effectiveRate) || 0) * 100);

    const baseAmountCents = rosterMonthlyRate != null
      ? Math.round((Number(effectiveRate) || 0) * 100)
      : baseAmountCentsFromShifts != null
        ? baseAmountCentsFromShifts
        : Math.round(hours * (Number(effectiveRate) || 0) * 100);

    /**
     * Transform expenses to items array.
     * - In create mode, payout_id is unknown (backend assigns it)
     * - In edit mode, we keep payout_id stable so the backend can associate items correctly
     * - Preserve existing payout_item_id for items that already have one
     * - Generate new payout_item_id only for truly new items
     */
    const resolvedPayoutId = mode === "edit" ? Number(initialPayStub?.id || 0) : 0;
    const items = (formData.expenses || []).map((e, idx) => {
      // If the expense already has a payout_item_id, preserve it
      if (e.payout_item_id) {
        return {
          payout_item_id: e.payout_item_id,
          payout_id: resolvedPayoutId,
          description: e.description,
          amount_cents: Math.round(e.amount * 100),
        };
      }
      
      // Generate new ID only for items without existing payout_item_id
      return {
        payout_item_id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `temp-${Date.now()}-${idx}`,
        payout_id: resolvedPayoutId,
        description: e.description,
        amount_cents: Math.round(e.amount * 100),
      };
    });

    const expensesTotal = items.reduce((acc, item) => acc + item.amount_cents, 0);
    const totalAmountCents = baseAmountCents + expensesTotal;

    return {
      // In edit mode we preserve payroll_payout_id during submit (see handleSubmit).
      payroll_payout_id: `PAY-${yyyy}-${String(mm).padStart(2, "0")}-${Date.now()}`,
      home_id: homeId,
      pcho_user_id: pchoId,
      pcg_user_id: formData.caregiverId,
      period_type:
        formData.periodType === REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY
          ? REVOPS_PAY_STUB_PERIOD_TYPE_BACKEND.BIWEEKLY
          : REVOPS_PAY_STUB_PERIOD_TYPE_BACKEND.MONTHLY,
      period_label: periodLabel,
      period_start_date: periodStartDate,
      period_end_date: periodEndDate,
      hours_worked_minutes: hoursWorkedMinutes,
      hourly_rate_cents: hourlyRateCents,
      base_amount_cents: baseAmountCents,
      total_amount_cents: totalAmountCents,
      status: "DRAFT",
      notes: "",
      updated_by_user_id: pchoId,
      items,
    };
  };

  /**
   * Handle form submission - transform data and call API
   */

  const dispatch = useDispatch();

  const handleSubmit = (formData: NewPayStubFormData) => {
    const payload = transformToBackendPayload(formData);
    if (!payload) {
      return;
    }

    // In edit mode, we keep stable identifiers and update the existing payout.
    if (mode === "edit" && initialPayStub?.id) {
      // Avoid sending a newly generated payroll_payout_id during edit.
      // We preserve the existing one so references remain stable.
      const data= {
            ...payload,
            id: identity(initialPayStub.id),
            // Preserve the existing payroll_payout_id if present.
            payroll_payout_id: initialPayStub.payroll_payout_id || payload.payroll_payout_id,
            // Preserve current status unless the backend expects DRAFT always.
            status: initialPayStub.status || payload.status,
          }
      const dataToBeUpdated={
        data,
        path:payStubPath
      }
      updatePayStub(
        dataToBeUpdated,
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["pay-stubs"] });
            onCreated?.();
            onClose();
            dispatch(handleOpenPopover());
            dispatch(handleShowPopoverMessage("Pay stub updated successfully!"));

          },
          onError: (error:any) => {
            const errMessage = !Array.isArray(error) ? error?.response?.data?.error : "Failed to update pay stub. Please try again.";
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(handleShowPopoverMessage(errMessage));
          },
        },
      );
      return;
    }

    createPayStub(
      { userData: payload, path: payStubPath },
      {
        onSuccess: () => {
          // Refresh table data after creating a new payout.
          queryClient.invalidateQueries({ queryKey: ["pay-stubs"] });
          onCreated?.();
          onClose();
          // Reset form
          setSelectedCaregiverId("");
          setSelectedMonth("");
          setSelectedPeriodType("");
          setSelectedDateRange("");
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("Pay stub created successfully!"));
        },
        onError: (error:any) => {
          const errMessage = !Array.isArray(error) ? error?.response?.data?.error : "Failed to create pay stub. Please try again.";
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(handleShowPopoverMessage(errMessage));
        },
      },
    );
  };

  return (
    <CommonModal
      title={mode === "edit" ? "Edit Pay Stub" : "New Pay Stub"}
      modalOpen={isOpen}
      setModalOpen={(open) => {
        if (!open) onClose();
      }}
      crossCTA
      width="700px"
    >
      <div className="font-poppins px-[20px] w-[680px]">
        <div className="text-sm text-[#6B7280]">
          {mode === "edit" ? "Update an existing pay stub." : "Create a pay stub for a caregiver."}
        </div>

        <Form
          onSubmit={handleSubmit}
          schema={NewPayStubSchema}
          useFormMethodsRef={payStubFormMethodsRef}
          defaultValues={defaultValues}
        >
          <div className="mt-3 grid grid-cols-1 gap-2">
            <FormSelectComponent
              label="Pay Period Type"
              name="periodType"
              options={payPeriodTypeOptions}
              placeHolder={REVOPS_PAY_STUB_PLACEHOLDERS.PERIOD_TYPE}
              disabled={isEditMode}
              onChange={(e) => {
                setSelectedPeriodType(e.target.value as RevopsPayStubPeriodType);
                setSelectedDateRange("");
                payStubFormMethodsRef.current?.setValue?.("dateRange", "");
              }}
              containerClass="!gap-1"
              titleClass="!text-xs"
            />
            <FormSelectComponent
              label="Month"
              name="month"
              options={monthOptions}
              placeHolder={REVOPS_PAY_STUB_PLACEHOLDERS.MONTH}
              disabled={isEditMode}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                if (selectedPeriodType === REVOPS_PAY_STUB_PERIOD_TYPE_UI.BI_WEEKLY) {
                  setSelectedDateRange("");
                  payStubFormMethodsRef.current?.setValue?.("dateRange", "");
                }
              }}
              containerClass="!gap-1"
              titleClass="!text-xs"
            />
            <BiWeeklyDateRangeField
              options={biWeeklyDateRangeOptions}
              onChange={(value) => setSelectedDateRange(value)}
              disabled={isEditMode}
            />
            <FormSelectComponent
              label="Caregiver"
              name="caregiverId"
              options={caregiverOptions}
              placeHolder={
                isLoadingCaregivers
                  ? REVOPS_PAY_STUB_PLACEHOLDERS.CAREGIVER_LOADING
                  : REVOPS_PAY_STUB_PLACEHOLDERS.CAREGIVER
              }
              disabled={isEditMode || isLoadingCaregivers}
              onChange={(e) => setSelectedCaregiverId(e.target.value)}
              containerClass="!gap-1"
              titleClass="!text-xs"
            />
          </div>

          {selectedCaregiverId && selectedMonth && (
            <div className="mt-2 text-[11px] text-[#6B7280]">
              {isLoadingShifts
                ? "Loading hours worked..."
                : isErrorShifts
                  ? "Failed to load hours worked"
                  : `Loaded ${derivedTotalHours.toFixed(2)} hours`}
            </div>
          )}

          {selectedCaregiverId ? (
            <NewPayStubComputedSection
              monthlyRosterRate={monthlyRosterRate}
              shiftRateGroups={shiftRateGroups}
              derivedTotalHours={derivedTotalHours}
              derivedTotalWages={derivedTotalWages}
              hasMixedHourlyRates={hasMixedHourlyRates}
              infoOpen={infoOpen}
              setInfoOpen={setInfoOpen}
            />
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              name="Cancel"
              type="button"
              buttonClick={onClose}
              classname="!bg-white border border-[#E5E7EB] hover:!bg-gray-50"
              titleClass="!text-[#111827] !text-[12px]"
            />
            <Button
              name={mode === "edit" ? "Update Pay Stub" : "Save Pay Stub"}
              type="submit"
              buttonClick={() => {}}
              classname="bg-secondarymirage"
              titleClass="!text-[12px]"
              disabled={isSaveDisabled}
              isLoading={isCreating || isUpdating}
            />
          </div>
        </Form>
      </div>
    </CommonModal>
  );
}
