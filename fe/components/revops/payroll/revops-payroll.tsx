"use client";

import Button from "../../../commonComponents/button";
import InputFieldComponent from "../../../commonComponents/input-field-component";
import Tabs from "../../../commonComponents/tabs";
import PlusIcon from "../../../public/icons/plus-icon";
import {
  revopsPayrollMock,
  type RevopsPayStub,
  type RevopsPayStubPaymentMethod,
  type RevopsPayStubPeriodType,
  type RevopsPayrollStaffMember,
} from "../../../utils/revops/mock-data";
import { useEffect, useMemo, useRef, useState } from "react";
import useGetAll from "../../../services/getAll";
import { GetUsersPath, SHIFT_STATUS_AVAILABLE, userRoles } from "../../../utils/constants";
import { getHomeIdFromToken } from "../../../utils/auth";
import useGetAllShifts from "../../../services/hcm-getall-shifts";
import { calculateTotalWages, calculateTotalWorkedHours } from "../../hcm/utils/timeUtils";
import RevopsPayrollPayStubsTab from "./tabs/pay-stubs-tab";
import RevopsPayrollCaregiversTab from "./tabs/caregivers-tab";
import RevopsPayrollSummaryTab from "./tabs/summary-tab";
import RevopsPayrollNewPayStubModal from "./modals/new-pay-stub-modal";
import RevopsPayrollProcessPaymentModal from "./modals/process-payment-modal";
import RevopsPayrollStaffDetailsModal from "./modals/staff-details-modal";

export default function RevopsPayroll() {
  const { periods, staff, payStubs, summary } = revopsPayrollMock;

  const [activeTab, setActiveTab] = useState<string>("Pay Stubs");
  const [isNewPayStubOpen, setIsNewPayStubOpen] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [billingMonthMax, setBillingMonthMax] = useState<string>("");
  const [stubToProcess, setStubToProcess] = useState<RevopsPayStub | null>(null);
  const [selectedStaff, setSelectedStaff] =
    useState<RevopsPayrollStaffMember | null>(null);
  const [payStubsState, setPayStubsState] = useState<RevopsPayStub[]>(payStubs);

  const homeId = getHomeIdFromToken();
  const { data: activeEmployees, isLoading: isLoadingActiveEmployees } = useGetAll({
    key: userRoles.PCG,
    params: {
      userType: userRoles.PCG,
      homeId: homeId,
    },
    path: GetUsersPath,
  });

  const tabData = useMemo(
    () => [
      {
        label: "Pay Stubs",
        content: (
          <RevopsPayrollPayStubsTab
            payStubs={payStubsState}
            filterMonth={filterMonth}
            onPay={(row) => {
              setStubToProcess(row);
            }}
          />
        ),
      },
      {
        label: "Caregivers",
        content: (
          <RevopsPayrollCaregiversTab
            staff={(activeEmployees?.users ?? []).filter((u: any) => !u?.isDeleted)}
            isLoading={isLoadingActiveEmployees}
            onViewDetails={(row) => setSelectedStaff(row)}
          />
        ),
      },
      // TODO: Uncomment when summary tab is ready
      // {
      //   label: "Summary",
      //   content: (
      //     <RevopsPayrollSummaryTab periods={periods} staff={staff} summary={summary} />
      //   ),
      // },
    ],
    [payStubsState, filterMonth, activeEmployees?.users, staff, periods, summary],
  );

  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    setFilterMonth(currentMonth);
    setBillingMonthMax(currentMonth);
  }, []);


  return (
    <div className="px-[10px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-3">
          <div className="text-[32px] font-bold font-jakarta">
            Payment Management
          </div>
          <div className="text-[18px] ">
            Process caregiver payments and manage timesheets
          </div>
        </div>

        <div className="flex items-center gap-2">
          <InputFieldComponent
            name="filterMonth"
            type="month"
            label=""
            value={filterMonth}
            max={billingMonthMax}
            onChange={(e) => setFilterMonth(e.target.value)}
            titleClass="hidden"
            className="w-[150px] h-[40px]"
          />
          <Button
            name="New Pay Stub"
            type="button"
            buttonClick={() => setIsNewPayStubOpen(true)}
            icon={<PlusIcon color="white" />}
            classname="bg-secondarymirage mb-2"
            iconStart={true}
          />
        </div>
      </div>

      <div className="mt-6">
        <Tabs
          tabs={tabData}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          containerClassName="rounded-[10px]"
        />
      </div>

      <RevopsPayrollNewPayStubModal
        isOpen={isNewPayStubOpen}
        onClose={() => setIsNewPayStubOpen(false)}
        onCreated={() => {
          // Refresh pay stubs list after creation
          // In a real app, this would refetch from the API
        }}
      />

      <RevopsPayrollProcessPaymentModal
        stubToProcess={stubToProcess}
        onClose={() => setStubToProcess(null)}
        onPaymentProcessed={() => {
          setStubToProcess(null);
        }}
      />

      <RevopsPayrollStaffDetailsModal
        selectedStaff={selectedStaff}
        setSelectedStaff={setSelectedStaff}
      />
    </div>
  );
}
