import React, { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import Form from "../../../commonComponents/form";
import Loader from "../../../commonComponents/loader";
import Button from "../../../commonComponents/button";
import { useAppDispatch } from "../../../redux/hooks";
import useUpdate from "../../../services/update";
import useGetById from "../../../services/getById";
import useGetAll from "../../../services/getAll";
import { getUserIdFromToken } from "../../../utils/auth";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { handleCloseAddIncidentModal } from "../../../redux/slices/modal-slice";
import {
  CLINICAL_USER_PATH_OMIT_FIELDS,
  ClinicalUserPath,
  GetUsersPath,
  UserPath,
  userRoles,
} from "../../../utils/constants";
import { omit, splitISOToDateTime } from "../../../utils/dateUtils";

import {
  IncidentReportFormSchema,
  IncidentReportFormType,
  IncidentTypeEnum,
} from "../../../model/clinical/add-incident.model";
import { get } from "react-hook-form";

type Props = {
  userData: any;
  setModalOpen?: (open: boolean) => void;
  defaultIncident?: any | null;
};

const IncidentReportFormWrapper: React.FC<Props> = ({
  userData,
  setModalOpen,
  defaultIncident,
}) => {
  const dispatch = useAppDispatch();
  const { mutate } = useUpdate();

  const loggedInUserId = getUserIdFromToken();
  const { data: LoggedInUserData, isLoading: loggedInUserDataLoading } =
    useGetById({
      key: "user",
      payload: {
        id: loggedInUserId,
        path: UserPath,
        enabled: !!loggedInUserId,
      },
    });

  const { data: AllPCHOs, isLoading: PCHODataLoading } = useGetAll({
    key: userRoles.LEAD,
    params: { userType: userRoles.PCHO, homeId: userData?.homeId },
    path: GetUsersPath,
  });
  const firstPCHO = AllPCHOs?.users?.[0];

  const [expanded, setExpanded] = useState<string | false>("Facility");
  const toggleAccordion = (panel: string) =>
    setExpanded((prev) => (prev === panel ? false : panel));

  // ---------- helpers used by submit ----------

  const combineDT = (date?: string, time?: string): string | undefined => {
    if (date && time) {
      // Combine date and time
      const dateTimeStr = `${date}T${time}:00`;

      // Create a new Date object in local time (not UTC)
      const localDateTime = new Date(dateTimeStr);

      // Convert the local time to UTC and return the ISO string
      return localDateTime.toISOString(); // This automatically converts to UTC
    }
    return undefined;
  };

  const toDigits = (s?: string) => (s ? s.replace(/\D+/g, "") : "");
  const cleanPhone10 = (s?: string) => {
    const d = toDigits(s);
    return d.length === 10 ? d : undefined;
  };
  const cleanZip5 = (s?: string) => {
    const d = toDigits(s);
    return d.length === 5 ? d : undefined;
  };

  /** Derive IncidentTypeEnum[] from the checked groups in an entry */
  const deriveIncidentTypes = (
    entry: any,
  ): (typeof IncidentTypeEnum._type)[] => {
    const result: (typeof IncidentTypeEnum._type)[] = [];
    const anyTrue = (obj?: Record<string, any>) =>
      !!obj && Object.values(obj).some(Boolean);

    if (anyTrue(entry?.abuseTypes)) result.push("ABUSE");
    if (
      anyTrue(entry?.deathTypes) ||
      (entry?.deathTypes?.called911Date && entry?.deathTypes?.called911Time)
    )
      result.push("DEATH");
    if (anyTrue(entry?.seriousInjuryTypes)) result.push("SERIOUS_INJURY");
    if (anyTrue(entry?.externalDisasterTypes)) result.push("EXTERNAL_DISASTER");
    if (
      anyTrue(entry?.missingResidentTypes) ||
      (entry?.missingResidentTypes?.policeNotifiedDate &&
        entry?.missingResidentTypes?.policeNotifiedTime)
    )
      result.push("MISSING_RESIDENT");
    if (anyTrue(entry?.other) || entry?.other?.other) result.push("OTHER");
    return Array.from(new Set(result));
  };

  const onSubmit = async (data: IncidentReportFormType) => {
    // 1) Transform entries
    const incidentType = (data?.incidentType || []).map((e) => {
      const derived = deriveIncidentTypes(e);

      const out: any = { ...e, incidentType: derived };

      if (e.deathTypes) {
        const { called911Date, called911Time, ...rest } = e.deathTypes;
        out.deathTypes = {
          ...rest,
          called911At: combineDT(called911Date, called911Time),
        };
      }

      if (e.missingResidentTypes) {
        const { policeNotifiedDate, policeNotifiedTime, ...rest } =
          e.missingResidentTypes;
        out.missingResidentTypes = {
          ...rest,
          policeNotifiedAt: combineDT(policeNotifiedDate, policeNotifiedTime),
        };
      }

      return out;
    });

    // 2) Notifications join dt
    const notifications = (data?.notifications || []).map((n) => ({
      role: n.role,
      name: n.name,
      notifiedAt: combineDT(n.notifiedDate, n.notifiedTime),
    }));

    // 3) Clean phones/zip
    const allegedPerpetratorDetails = data.allegedPerpetratorDetails
      ? {
          ...data.allegedPerpetratorDetails,
          phone: cleanPhone10(data.allegedPerpetratorDetails.phone),
          zip: cleanZip5(data.allegedPerpetratorDetails.zip),
        }
      : undefined;

    const witnesses = Array.isArray(data.witnesses)
      ? data.witnesses.map((w) => ({ ...w, phone: cleanPhone10(w.phone) }))
      : undefined;

    // 4) Build backend item
    const incidentId =
      data.incidentId || defaultIncident?.incidentId || uuidv4();
    const apiItem = {
      incidentId,
      facilityName: data.facilityName,
      facilityCounty: data.facilityCounty,
      facilityPhone: toDigits(data.facilityPhone),
      facilityFax: data.facilityFax,
      facilityEmail: data.facilityEmail,
      facilityAdministrator: data.facilityAdministrator,
      immediateCorrections: data.immediateCorrections,
      signature: data.reporterSignature,
      incidentDetails: data.detailsOfIncident,
      incidentType,

      residentName: data.residentName,

      incidentDate: combineDT(data.incidentDate, data.incidentTime)!, // required

      notifications,

      allegedPerpetratorDetails,
      witnesses,

      reporterName: data.reporterName,
      reporterTitle: data.reporterTitle,

      incidentReportedAt: combineDT(
        data.incidentReportedDate,
        data.incidentReportedTime,
      )!, // required

      createdAt: defaultIncident?.createdAt || new Date().toISOString(),
    };

    const existingReports = Array.isArray(userData?.clinical?.incidentReport)
      ? userData.clinical.incidentReport
      : [];

    const incidentReport = existingReports.some(
      (r: any) => r?.incidentId === incidentId,
    )
      ? existingReports.map((r: any) =>
          r?.incidentId === incidentId ? apiItem : r,
        )
      : [...existingReports, apiItem];

    const clinicalData = {
      ...userData?.clinical,
      incidentReport,
    };

    const cleanedData: any = omit(clinicalData, CLINICAL_USER_PATH_OMIT_FIELDS);
    const payload = { data: cleanedData, path: ClinicalUserPath };

    const successMessage = defaultIncident
      ? "Incident report updated successfully"
      : "Incident reported successfully";

    mutate(payload, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage(successMessage));
        dispatch(handleCloseAddIncidentModal());
        if (setModalOpen) setModalOpen(false);
      },
      onError: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage("Incident not added, please try again!"),
        );
      },
    });
  };

  const incidentDt = splitISOToDateTime(defaultIncident?.incidentDate);
  const reportedDt = splitISOToDateTime(defaultIncident?.incidentReportedAt);

  const defaultValues: Partial<IncidentReportFormType> = {
    incidentId: defaultIncident?.incidentId || undefined,
    facilityName: defaultIncident?.facilityName || userData?.home,
    facilityCounty: defaultIncident?.facilityCounty || "",
    reporterName: defaultIncident?.reporterName || LoggedInUserData?.name || "",
    reporterTitle: defaultIncident?.reporterTitle || "",
    facilityPhone: defaultIncident?.facilityPhone || firstPCHO?.mobile || "",
    facilityFax: defaultIncident?.facilityFax || "",
    facilityEmail: defaultIncident?.facilityEmail || firstPCHO?.email || "",
    facilityAdministrator:
      defaultIncident?.facilityAdministrator || firstPCHO?.name || "",
    incidentType: [
      {
        abuseTypes: defaultIncident?.incidentType?.[0]?.abuseTypes || {},
        deathTypes: (() => {
          const d = defaultIncident?.incidentType?.[0]?.deathTypes || {};
          const c = splitISOToDateTime(d?.called911At);
          return {
            unexpected: d?.unexpected,
            waiverRequestPending: d?.waiverRequestPending,
            hospiceProvided: d?.hospiceProvided,
            called911Date: c.date,
            called911Time: c.time,
            pchInitiatedCprBy: d?.pchInitiatedCprBy,
          };
        })(),
        seriousInjuryTypes:
          defaultIncident?.incidentType?.[0]?.seriousInjuryTypes || {},
        externalDisasterTypes:
          defaultIncident?.incidentType?.[0]?.externalDisasterTypes || {},
        missingResidentTypes: (() => {
          const m =
            defaultIncident?.incidentType?.[0]?.missingResidentTypes || {};
          const p = splitISOToDateTime(m?.policeNotifiedAt);
          return {
            policeNotifiedDate: p.date,
            policeNotifiedTime: p.time,
            residentHasMemoryImpairment: m?.residentHasMemoryImpairment,
          };
        })(),
        other: defaultIncident?.incidentType?.[0]?.other || {},
      },
    ],
    residentName: defaultIncident?.residentName || [userData?.name || ""],
    notifications: [
      {
        role: "FAMILY/GUARDIAN/RESPONSIBLE_PARTY",
        name:
          defaultIncident?.notifications?.find(
            (n: any) => n?.role === "FAMILY/GUARDIAN/RESPONSIBLE_PARTY",
          )?.name || "",
        notifiedDate: splitISOToDateTime(
          defaultIncident?.notifications?.find(
            (n: any) => n?.role === "FAMILY/GUARDIAN/RESPONSIBLE_PARTY",
          )?.notifiedAt,
        ).date,
        notifiedTime: splitISOToDateTime(
          defaultIncident?.notifications?.find(
            (n: any) => n?.role === "FAMILY/GUARDIAN/RESPONSIBLE_PARTY",
          )?.notifiedAt,
        ).time,
      },
      {
        role: "PHYSICIAN",
        name:
          defaultIncident?.notifications?.find(
            (n: any) => n?.role === "PHYSICIAN",
          )?.name || "",
        notifiedDate: splitISOToDateTime(
          defaultIncident?.notifications?.find(
            (n: any) => n?.role === "PHYSICIAN",
          )?.notifiedAt,
        ).date,
        notifiedTime: splitISOToDateTime(
          defaultIncident?.notifications?.find(
            (n: any) => n?.role === "PHYSICIAN",
          )?.notifiedAt,
        ).time,
      },
      {
        role: "POLICE",
        name:
          defaultIncident?.notifications?.find((n: any) => n?.role === "POLICE")
            ?.name || "",
        notifiedDate: splitISOToDateTime(
          defaultIncident?.notifications?.find((n: any) => n?.role === "POLICE")
            ?.notifiedAt,
        ).date,
        notifiedTime: splitISOToDateTime(
          defaultIncident?.notifications?.find((n: any) => n?.role === "POLICE")
            ?.notifiedAt,
        ).time,
      },
      {
        role: "OTHER",
        name:
          defaultIncident?.notifications?.find((n: any) => n?.role === "OTHER")
            ?.name || "",
        notifiedDate: splitISOToDateTime(
          defaultIncident?.notifications?.find((n: any) => n?.role === "OTHER")
            ?.notifiedAt,
        ).date,
        notifiedTime: splitISOToDateTime(
          defaultIncident?.notifications?.find((n: any) => n?.role === "OTHER")
            ?.notifiedAt,
        ).time,
      },
    ],
    witnesses: defaultIncident?.witnesses || [],
    allegedPerpetratorDetails:
      defaultIncident?.allegedPerpetratorDetails || undefined,

    incidentDate: incidentDt.date,
    incidentTime: incidentDt.time,
    incidentReportedDate: reportedDt.date,
    incidentReportedTime: reportedDt.time,
    detailsOfIncident:
      defaultIncident?.incidentDetails ||
      defaultIncident?.detailsOfIncident ||
      "",
    immediateCorrections: defaultIncident?.immediateCorrections || "",
    reporterSignature:
      defaultIncident?.signature || defaultIncident?.reporterSignature || "",
  };

  const loading = loggedInUserDataLoading || PCHODataLoading;

  return (
    <div className="w-full flex justify-center p-4">
      <div className="w-full min-w-[400px] max-w-[1114px]">
        {loading ? (
          <div>
            <Loader fullScreen={false} />
          </div>
        ) : (
          <Form
            schema={IncidentReportFormSchema}
            onSubmit={onSubmit}
            defaultValues={defaultValues}
          >
            <IncidentReportFields
              expanded={expanded}
              toggleAccordion={toggleAccordion}
            />
            <div className="flex justify-end pt-4">
              <Button name="Save" />
            </div>
          </Form>
        )}
      </div>
    </div>
  );
};

export default IncidentReportFormWrapper;

import { useFormContext } from "react-hook-form";
import AccordainComponent from "../../../commonComponents/accordian-component";
import FormInputFieldComponent from "../../../commonComponents/form-input-field-component";
import FormInputCheckboxComponent from "../../../commonComponents/form-input-checkbox-component";
import WarningIcon from "../../../public/icons/warning-icon";

type FieldsProps = {
  expanded: string | false;
  toggleAccordion: (panel: string) => void;
};

export const IncidentReportFields: React.FC<FieldsProps> = ({
  expanded,
  toggleAccordion,
}) => {
  // Example: const incidentDate = watch("incidentDate");

  const { formState } = useFormContext();

  const hasErrorAt = (paths: string[]) =>
    paths.some((p) => !!get(formState.errors, p));

  const facilityHasError = hasErrorAt([
    "facilityName",
    "facilityCounty",
    "facilityPhone",
    "facilityFax",
    "facilityEmail",
    "facilityAdministrator",
  ]);

  const typeHasError = hasErrorAt(["incidentType"]);

  const residentHasError = hasErrorAt([
    "residentName",
    "incidentDate",
    "incidentTime",
    "detailsOfIncident",
  ]);

  const notificationsHasError = hasErrorAt(["notifications"]);
  const perpetratorHasError = hasErrorAt(["allegedPerpetratorDetails"]);
  const witnessesHasError = hasErrorAt(["witnesses"]);

  const reporterHasError = hasErrorAt([
    "reporterName",
    "reporterTitle",
    "incidentReportedDate",
    "incidentReportedTime",
    "immediateCorrections",
    "reporterSignature",
  ]);

  return (
    <>
      {/* Facility & Admin */}
      <div className="mb-5">
        <AccordainComponent
          header={
            <div
              className={`flex items-center justify-between gap-2 ${
                facilityHasError && "text-red-500"
              }`}
            >
              Facility & Admin
              {facilityHasError && (
                <WarningIcon fill="red" height={35} width={35} />
              )}
            </div>
          }
          isOpen={expanded === "Facility"}
          onClick={() => toggleAccordion("Facility")}
        >
          <div className="space-y-3 p-3">
            <FormInputFieldComponent name="facilityName" label="Facility*" />
            <FormInputFieldComponent name="facilityCounty" label="County" />
            <FormInputFieldComponent name="facilityPhone" label="Phone*" />
            <FormInputFieldComponent name="facilityFax" label="Fax" />
            <FormInputFieldComponent
              name="facilityEmail"
              label="Email"
              type="email"
            />
            <FormInputFieldComponent
              name="facilityAdministrator"
              label="Administrator or Site Manager*"
            />
          </div>
        </AccordainComponent>
      </div>

      {/* Type of Incident */}
      <div className="mb-5">
        <AccordainComponent
          header={
            <div
              className={`flex items-center justify-between gap-2 ${
                typeHasError && "text-red-500"
              }`}
            >
              Type of Incident
              {typeHasError && (
                <WarningIcon fill="red" height={35} width={35} />
              )}
            </div>
          }
          isOpen={expanded === "Type"}
          onClick={() => toggleAccordion("Type")}
        >
          <div className="p-3 space-y-3">
            <div className="font-semibold">Abuse</div>
            <div className="grid grid-cols-2 gap-2">
              <FormInputCheckboxComponent
                name="incidentType.0.abuseTypes.physical"
                label="Physical"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.abuseTypes.verbal"
                label="Verbal"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.abuseTypes.sexual"
                label="Sexual"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.abuseTypes.mental"
                label="Mental"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.abuseTypes.residentToResident"
                label="Resident to resident"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.abuseTypes.staffToResident"
                label="Staff to resident"
              />
            </div>

            <div className="font-semibold">Death</div>
            <div className="grid grid-cols-2 gap-2">
              <FormInputCheckboxComponent
                name="incidentType.0.deathTypes.unexpected"
                label="Unexpected"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.deathTypes.waiverRequestPending"
                label="Waiver request pending"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.deathTypes.hospiceProvided"
                label="Hospice provided"
              />
              <div className="grid grid-cols-2 gap-2">
                <FormInputFieldComponent
                  name="incidentType.0.deathTypes.called911Date"
                  label="911 Called Date"
                  type="date"
                />
                <FormInputFieldComponent
                  name="incidentType.0.deathTypes.called911Time"
                  label="911 Called Time"
                  type="time"
                />
              </div>
              <FormInputFieldComponent
                name="incidentType.0.deathTypes.pchInitiatedCprBy"
                label="CPR Initiated By"
              />
            </div>

            <div className="font-semibold">Serious Injury</div>
            <div className="grid grid-cols-2 gap-2">
              <FormInputCheckboxComponent
                name="incidentType.0.seriousInjuryTypes.resultedInDeath"
                label="Resulted in death"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.seriousInjuryTypes.hospitalAdmission"
                label="Hospital admission"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.seriousInjuryTypes.erVisit"
                label="ER visit"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.seriousInjuryTypes.mdVisit"
                label="MD visit"
              />
            </div>

            <div className="font-semibold">External Disaster</div>
            <div className="grid grid-cols-2 gap-2">
              <FormInputCheckboxComponent
                name="incidentType.0.externalDisasterTypes.fire"
                label="Fire"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.externalDisasterTypes.flood"
                label="Flood"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.externalDisasterTypes.damageToPhysicalPlant"
                label="Damage to physical plant"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.externalDisasterTypes.residentsRelocated"
                label="Residents relocated"
              />
            </div>

            <div className="font-semibold">Missing Resident</div>
            <div className="grid grid-cols-2 gap-2">
              <FormInputFieldComponent
                name="incidentType.0.missingResidentTypes.policeNotifiedDate"
                label="Police Notified Date"
                type="date"
              />
              <FormInputFieldComponent
                name="incidentType.0.missingResidentTypes.policeNotifiedTime"
                label="Police Notified Time"
                type="time"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.missingResidentTypes.residentHasMemoryImpairment"
                label="Resident has memory impairment"
              />
            </div>

            <div className="font-semibold">Other</div>
            <div className="grid grid-cols-2 gap-2">
              <FormInputCheckboxComponent
                name="incidentType.0.other.neglect"
                label="Neglect"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.other.exploitation"
                label="Exploitation"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.other.ownerStaffCriminalRecord"
                label="Owner/staff criminal record"
              />
              <FormInputCheckboxComponent
                name="incidentType.0.other.insuranceWill"
                label="Insurance/will"
              />
            </div>
            <FormInputFieldComponent
              name="incidentType.0.other.other"
              label="Other (specify)"
              placeholder="Specify other..."
            />
          </div>
        </AccordainComponent>
      </div>

      {/* Resident(s) & Incident Details */}
      <div className="mb-5">
        <AccordainComponent
          header={
            <div
              className={`flex items-center justify-between gap-2 ${
                residentHasError && "text-red-500"
              }`}
            >
              Resident(s) & Incident Details
              {residentHasError && (
                <WarningIcon fill="red" height={35} width={35} />
              )}
            </div>
          }
          isOpen={expanded === "Resident"}
          onClick={() => toggleAccordion("Resident")}
        >
          <div className="p-3 space-y-3">
            <FormInputFieldComponent
              name="residentName.0"
              label="Resident Name*"
            />
            <div className="grid grid-cols-2 gap-2">
              <FormInputFieldComponent
                name="incidentDate"
                label="Date of Incident*"
                type="date"
              />
              <FormInputFieldComponent
                name="incidentTime"
                label="Time of Incident*"
                type="time"
              />
            </div>
            <FormInputFieldComponent
              name="detailsOfIncident"
              label="Details of Incident*"
              placeholder="Describe details here..."
            />
          </div>
        </AccordainComponent>
      </div>

      {/* Notifications */}
      <div className="mb-5">
        <AccordainComponent
          header={
            <div
              className={`flex items-center justify-between gap-2 ${
                notificationsHasError && "text-red-500"
              }`}
            >
              Notifications
              {notificationsHasError && (
                <WarningIcon fill="red" height={35} width={35} />
              )}
            </div>
          }
          isOpen={expanded === "Notifications"}
          onClick={() => toggleAccordion("Notifications")}
        >
          <div className="p-3 space-y-5">
            {[
              "FAMILY/GUARDIAN/RESPONSIBLE_PARTY",
              "PHYSICIAN",
              "POLICE",
              "OTHER",
            ].map((role, i) => (
              <div className="space-y-2" key={role}>
                <div className="font-semibold">{role.replaceAll("_", " ")}</div>
                <FormInputFieldComponent
                  name={`notifications.${i}.name`}
                  label="Name"
                />
                <div className="grid grid-cols-2 gap-2">
                  <FormInputFieldComponent
                    name={`notifications.${i}.notifiedDate`}
                    label="Date"
                    type="date"
                  />
                  <FormInputFieldComponent
                    name={`notifications.${i}.notifiedTime`}
                    label="Time"
                    type="time"
                  />
                </div>
              </div>
            ))}
          </div>
        </AccordainComponent>
      </div>

      {/* Perpetrator */}
      <div className="mb-5">
        <AccordainComponent
          header={
            <div
              className={`flex items-center justify-between gap-2 ${
                perpetratorHasError && "text-red-500"
              }`}
            >
              Perpetrator
              {perpetratorHasError && (
                <WarningIcon fill="red" height={35} width={35} />
              )}
            </div>
          }
          isOpen={expanded === "Perpetrator"}
          onClick={() => toggleAccordion("Perpetrator")}
        >
          <div className="p-3 space-y-3">
            <FormInputFieldComponent
              name="allegedPerpetratorDetails.name"
              label="Alleged Perpetrator Name"
            />
            <FormInputFieldComponent
              name="allegedPerpetratorDetails.relationshipToResident"
              label="Relationship to Resident"
            />
            <FormInputFieldComponent
              name="allegedPerpetratorDetails.address"
              label="Current Address"
            />
            <FormInputFieldComponent
              name="allegedPerpetratorDetails.phone"
              label="Phone"
            />
            <div className="grid grid-cols-3 gap-2">
              <FormInputFieldComponent
                name="allegedPerpetratorDetails.city"
                label="City"
              />
              <FormInputFieldComponent
                name="allegedPerpetratorDetails.state"
                label="State"
              />
              <FormInputFieldComponent
                name="allegedPerpetratorDetails.zip"
                label="Zip"
              />
            </div>
          </div>
        </AccordainComponent>
      </div>

      {/* Witnesses */}
      <div className="mb-5">
        <AccordainComponent
          header={
            <div
              className={`flex items-center justify-between gap-2 ${
                witnessesHasError && "text-red-500"
              }`}
            >
              Witnesses
              {witnessesHasError && (
                <WarningIcon fill="red" height={35} width={35} />
              )}
            </div>
          }
          isOpen={expanded === "Witnesses"}
          onClick={() => toggleAccordion("Witnesses")}
        >
          <div className="p-3 space-y-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="space-y-3 border-b border-gray-200 pb-3 last:border-0"
              >
                <div className="font-semibold mb-2">Witness {i + 1}</div>
                <FormInputFieldComponent
                  name={`witnesses.${i}.name`}
                  label="Witness Name"
                />
                <FormInputFieldComponent
                  name={`witnesses.${i}.address`}
                  label="Address"
                />
                <div className="grid grid-cols-2 gap-2">
                  <FormInputFieldComponent
                    name={`witnesses.${i}.phone`}
                    label="Phone"
                  />
                  <FormInputFieldComponent
                    name={`witnesses.${i}.relationshipToResident`}
                    label="Relationship to Resident"
                  />
                </div>
              </div>
            ))}
          </div>
        </AccordainComponent>
      </div>

      {/* Reporter */}
      <div className="mb-5">
        <AccordainComponent
          header={
            <div
              className={`flex items-center justify-between gap-2 ${
                reporterHasError && "text-red-500"
              }`}
            >
              Reporter
              {reporterHasError && (
                <WarningIcon fill="red" height={35} width={35} />
              )}
            </div>
          }
          isOpen={expanded === "Reporter"}
          onClick={() => toggleAccordion("Reporter")}
        >
          <div className="p-3 space-y-3">
            <FormInputFieldComponent name="reporterName" label="Reporter*" />
            <FormInputFieldComponent name="reporterTitle" label="Title" />
            <div className="grid grid-cols-2 gap-2">
              <FormInputFieldComponent
                name="incidentReportedDate"
                label="Date of Report*"
                type="date"
              />
              <FormInputFieldComponent
                name="incidentReportedTime"
                label="Time of Report*"
                type="time"
              />
            </div>
            <FormInputFieldComponent
              name="immediateCorrections"
              label="Immediate Corrections"
            />
            <FormInputFieldComponent
              name="reporterSignature"
              label="Signature"
            />
          </div>
        </AccordainComponent>
      </div>
    </>
  );
};
