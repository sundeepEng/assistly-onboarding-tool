import React from "react";
import { FileTextIcon } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { getFileUrl } from "../../../utils/uploadToS3";
import { getHomeIdFromToken } from "../../../utils/auth";
import { safe } from "../../../utils/safe";

/** Convert UTC ISO string to local ISO string (preserves local date/time) */
function utcToLocal(iso?: string): string {
  if (!iso || typeof iso !== "string") return "";
  const utcDate = new Date(iso);
  if (isNaN(utcDate.getTime())) return "";
  const localDate = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16); // Returns YYYY-MM-DDTHH:mm
}

function splitISO(iso?: string) {
  if (!iso || typeof iso !== "string") return { date: "", time: "" };
  const [d, t] = iso.split("T");
  return { date: d || "", time: (t || "").slice(0, 5) };
}

const b = (v: unknown) => v === true;

function getFieldMaybe(form: any, name: string) {
  try {
    return form.getField(name);
  } catch {
    return undefined;
  }
}
function setText(form: any, name: string, value?: string) {
  try {
    const f = getFieldMaybe(form, name);
    if (f && typeof f.setText === "function" && value !== undefined) {
      f.setText(value ?? "");
    }
  } catch {}
}
function setCheck(form: any, name: string, checked?: boolean) {
  try {
    const f = getFieldMaybe(form, name);
    if (!f) return;
    // @ts-ignore
    checked ? f.check?.() : f.uncheck?.();
  } catch {}
}

function anyTrue(o?: Record<string, unknown>) {
  if (!o || typeof o !== "object") return false;
  return Object.values(o).some(Boolean);
}

function getNotifByRole(notifs: any[] | undefined, role: string) {
  const found = notifs?.find((n) => n?.role === role);
  const { date, time } = splitISO(utcToLocal(found?.notifiedAt));
  return { name: safe(found?.name, ""), date, time };
}

function firstEntry(incident: any) {
  return Array.isArray(incident?.incidentType) ? incident.incidentType[0] ?? {} : {};
}
function firstResident(incident: any) {
  return Array.isArray(incident?.residentName) ? incident.residentName[0] ?? "" : "";
}

/* -------------------- main fill fn (S3 only) -------------------- */
async function fillIncidentPdfFromIncident(incidentDetails: any) {
  // Build S3 URL for the PDF (must be .pdf for pdf-lib)
  const homeId = getHomeIdFromToken();
  const s3Url = await getFileUrl(
    process.env.NEXT_PUBLIC_AWS_ORIGINAL_CONTRACTS_BUCKET_NAME || "",
    `${homeId}/Senior/incident_report_template.pdf`
  );


  if (!s3Url) throw new Error("Template URL from S3 is empty.");

  // Fetch template from S3 (no fallback)
  const res = await fetch(s3Url, { mode: "cors", cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching template`);
  const arrayBuffer = await res.arrayBuffer();


  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const form = pdfDoc.getForm();

  // derive & split fields
  const entry = firstEntry(incidentDetails);
  const death = entry?.deathTypes ?? {};
  const miss  = entry?.missingResidentTypes ?? {};

  const residentName = firstResident(incidentDetails);

  const { date: incidentDate, time: incidentTime } = splitISO(utcToLocal(incidentDetails?.incidentDate));
  const { date: reportDate,  time: reportTime  } = splitISO(utcToLocal(incidentDetails?.incidentReportedAt));

  const fam = getNotifByRole(incidentDetails?.notifications, "FAMILY/GUARDIAN/RESPONSIBLE_PARTY");
  const phy = getNotifByRole(incidentDetails?.notifications, "PHYSICIAN");
  const pol = getNotifByRole(incidentDetails?.notifications, "POLICE");
  const oth = getNotifByRole(incidentDetails?.notifications, "OTHER");

  const { date: called911Date,       time: called911Time       } = splitISO(utcToLocal(death?.called911At));
  const { date: policeNotifiedDate,  time: policeNotifiedTime  } = splitISO(utcToLocal(miss?.policeNotifiedAt));

  /* ── text fields ── */
  setText(form, "email", safe(incidentDetails?.facilityEmail, ""));
  setText(form, "home_name", safe(incidentDetails?.facilityName, ""));
  setText(form, "county", safe(incidentDetails?.facilityCounty, ""));
  setText(form, "mobile", safe(incidentDetails?.facilityPhone, ""));
  setText(form, "fax", safe(incidentDetails?.facilityFax, ""));
  setText(form, "administrator_or_site_manager", safe(incidentDetails?.facilityAdministrator, ""));

  setText(form, "pch_initiated_by", safe(death?.pchInitiatedCprBy, ""));

  setText(form, "police_notified_date", policeNotifiedDate || pol.date);
  setText(form, "police_notified_time", policeNotifiedTime || pol.time);

  setText(form, "other", oth.name);

  setText(form, "senior_name", safe(residentName, ""));
  setText(form, "date_of_incident", incidentDate);
  setText(form, "time_of_incident", incidentTime);
  setText(form, "details_of_the_incident", safe(incidentDetails?.incidentDetails, ""));
  setText(form, "immediate_correction_steps", safe(incidentDetails?.immediateCorrections, ""));

  setText(form, "date_when_informed_family_person", fam.date);
  setText(form, "time_when_informed_family_person", fam.time);
  setText(form, "name_of_family_person", fam.name);

  setText(form, "date_physician", phy.date);
  setText(form, "time_physician", phy.time);
  setText(form, "name_of_physician", phy.name);

  setText(form, "date_police", pol.date);
  setText(form, "time_police", pol.time);
  setText(form, "name_of_police", pol.name);

  setText(form, "date_others", oth.date);
  setText(form, "time_others", oth.time);
  setText(form, "name_of_other", oth.name);

  setText(form, "alleged_perpetrator_name", safe(incidentDetails?.allegedPerpetratorDetails?.name, ""));
  setText(form, "relationship_to_resident", safe(incidentDetails?.allegedPerpetratorDetails?.relationshipToResident, ""));
  setText(form, "perpetrator_current_address", safe(incidentDetails?.allegedPerpetratorDetails?.address, ""));
  setText(form, "perpetrator_current_mobile", safe(incidentDetails?.allegedPerpetratorDetails?.phone, ""));
  setText(form, "perpetrator_current_city", safe(incidentDetails?.allegedPerpetratorDetails?.city, ""));
  setText(form, "perpetrator_current_state", safe(incidentDetails?.allegedPerpetratorDetails?.state, ""));
  setText(form, "perpetrator_current_zip", safe(incidentDetails?.allegedPerpetratorDetails?.zip, ""));

  const witnesses = Array.isArray(incidentDetails?.witnesses) ? incidentDetails.witnesses : [];
  const w1 = witnesses[0] || {};
  const w2 = witnesses[1] || {};
  const w3 = witnesses[2] || {};

  setText(form, "witness_1_name", safe(w1.name, ""));
  setText(form, "witness_1_address", safe(w1.address, ""));
  setText(form, "witness_1_mobile", safe(w1.phone, ""));
  setText(form, "witness_1_relation_to_senior", safe(w1.relationshipToResident, ""));

  setText(form, "witness_2_name", safe(w2.name, ""));
  setText(form, "witness_2_address", safe(w2.address, ""));
  setText(form, "witness_2_mobile", safe(w2.phone, ""));
  setText(form, "witness_2_relation_to_senior", safe(w2.relationshipToResident, ""));

  setText(form, "witness_3_name", safe(w3.name, ""));
  setText(form, "witness_3_address", safe(w3.address, ""));
  setText(form, "witness_3_mobile", safe(w3.phone, ""));
  setText(form, "witness_3_relation_to_senior", safe(w3.relationshipToResident, ""));

  setText(form, "pcg_name", safe(incidentDetails?.reporterName, ""));
  setText(form, "pcg_role", safe(incidentDetails?.reporterTitle, ""));
  setText(form, "date_of_report", reportDate);
  setText(form, "time_of_report", reportTime);
  setText(form, "signature", safe(incidentDetails?.signature, ""));


  setText(form, "called_time_911", called911Time);
  setCheck(form, "is_911_called", Boolean(called911Date || called911Time));

  // group flags & specifics
  const abuseGroup   = anyTrue(entry?.abuseTypes);
  const deathGroup   = anyTrue(death);
  const seriousGroup = anyTrue(entry?.seriousInjuryTypes);
  const externalGrp  = anyTrue(entry?.externalDisasterTypes);
  const missingGrp   = anyTrue(miss);
  const otherGroup   = anyTrue(entry?.other);

  setCheck(form, "abuse", abuseGroup);
  setCheck(form, "death", deathGroup);
  setCheck(form, "serious_injury", seriousGroup);
  setCheck(form, "external_disaster", externalGrp);
  setCheck(form, "missing_resident", missingGrp);
  setCheck(form, "other_checkbox", otherGroup);

  setCheck(form, "physical", b(entry?.abuseTypes?.physical));
  setCheck(form, "verbal", b(entry?.abuseTypes?.verbal));
  setCheck(form, "sexual", b(entry?.abuseTypes?.sexual));
  setCheck(form, "mental", b(entry?.abuseTypes?.mental));
  setCheck(form, "resident_to_resident", b(entry?.abuseTypes?.residentToResident));
  setCheck(form, "staff_to_resident", b(entry?.abuseTypes?.staffToResident));

  setCheck(form, "un_expected", b(death?.unexpected));
  setCheck(form, "wavier_request_pending", b(death?.waiverRequestPending));
  setCheck(form, "hospice_provided", b(death?.hospiceProvided));
  setCheck(form, "pch_initiated", Boolean(death?.pchInitiatedCprBy));

  setCheck(form, "resulted_in_death", b(entry?.seriousInjuryTypes?.resultedInDeath));
  setCheck(form, "hospital_admission", b(entry?.seriousInjuryTypes?.hospitalAdmission));
  setCheck(form, "er_visit", b(entry?.seriousInjuryTypes?.erVisit));
  setCheck(form, "md_visit", b(entry?.seriousInjuryTypes?.mdVisit));

  setCheck(form, "fire", b(entry?.externalDisasterTypes?.fire));
  setCheck(form, "flood", b(entry?.externalDisasterTypes?.flood));
  setCheck(form, "damage_to_physical_plant", b(entry?.externalDisasterTypes?.damageToPhysicalPlant));
  setCheck(form, "senior_relocated", b(entry?.externalDisasterTypes?.residentsRelocated));

  setCheck(form, "police_notified", Boolean(policeNotifiedDate || policeNotifiedTime));
  setCheck(form, "resident_has_memory_impairement", b(miss?.residentHasMemoryImpairment));

  setCheck(form, "neglect", b(entry?.other?.neglect));
  setCheck(form, "exploitation", b(entry?.other?.exploitation));
  setCheck(form, "owner_or_staff_aquire_criminal_record", b(entry?.other?.ownerStaffCriminalRecord));
  setCheck(form, "insurance", b(entry?.other?.insuranceWill));
  setCheck(form, "_incident_type_other", Boolean(entry?.other?.other));

  const safeResidentName = safe(residentName, "Filled"); // Assuming safe is a sanitization function
  
  

  // finalize
  form.flatten();
  const updatedPdf = await pdfDoc.save();

  const pdfBuffer = new Uint8Array(updatedPdf).buffer;

  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Incident_Report_${safeResidentName && safeResidentName}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/* -------------------- component -------------------- */
export const IncidentPDF: React.FC<{ incidentDetails: any }> = ({ incidentDetails }) => {
  const handlePDFDownload = async () => {
    try {
      if (!incidentDetails) {
        console.error("No incident details provided.");
        return;
      }
      await fillIncidentPdfFromIncident(incidentDetails);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    }
  };

  return (
    <div
      onClick={handlePDFDownload}
      className="inline-flex items-center justify-center p-2 hover:opacity-80 cursor-pointer border border-solid border-[#C8C8CC] rounded-md"
    >
      <FileTextIcon />
    </div>
  );
};
