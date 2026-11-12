"use client";

import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { toTitleCase } from "../../utils/getSignatureUtil";
import { calculateAge, omit } from "../../utils/dateUtils";
import Button from "../../commonComponents/button";
import Avatar from "../../commonComponents/avatar";
import {
  FaceSheetDraft,
  faceSheetSchema,
} from "../../model/clinical/face-sheet.model";
import { useZodForm } from "./inline-form";
import useUpdate from "../../services/update";
import { useDispatch } from "react-redux";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import {
  CLINICAL_USER_PATH_OMIT_FIELDS,
  ClinicalUserPath,
  FACESHEET_DOC_TYPES,
  in_the_event_of_death,
  milestones,
  USER_PATH_OMIT_FIELDS,
  UserPath,
} from "../../utils/constants";
import { ExtendedLead } from "../stage-popup";
import { hasAccess } from "../../utils/roleAccess";
import { Role } from "../../utils/roles";
import { RoleContext } from "../role-provider";
import { deleteFromS3, uploadToS3 } from "../../utils/uploadToS3";
import {
  deepMerge,
  removeEmptyValuesDeep,
  safeStr,
  splitName,
  toDateInputValue,
} from "../../utils/facesheetUtil";
import {
  Card,
  ContactBlock,
  SectionTitle,
  SimpleListSection,
} from "./face-sheet-components";
import { getHomeIdFromToken, getUserRoleFromToken } from "../../utils/auth";
import fetchPreSignedUrl from "../../services/get-presigned-url";
import {
  InlineInput,
  InlineSelect,
  Row,
  UploadRow,
} from "../../commonComponents/inline-form-fields";

// build draft to show them as default values
function buildDraftFromLeadData(
  leadData: any,
  insuranceDetails: { providerName: string; memberId: string },
): FaceSheetDraft {
  const birthdate = safeStr(
    leadData?.biography?.personalDetails?.birthdate ||
      leadData?.facesheet?.birthdate,
  );
  const gender = safeStr(
    leadData?.biography?.personalDetails?.gender || leadData?.facesheet?.gender,
  );
  const allergies = leadData?.medical?.general?.foodAllergies;
  const keyConditions = leadData?.facesheet?.keyConditions;
  const primaryLanguage = leadData?.facesheet?.primaryLanguage?.trim()
    ? leadData?.facesheet?.primaryLanguage?.trim()
    : "English";
  const existingDocuments = leadData?.facesheet?.documents || {};

  return {
    name: safeStr(leadData?.name || leadData?.facesheet?.name),
    gender: gender as "Male" | "Female" | "Other",
    birthdate,
    room: safeStr(
      leadData?.clinical?.roomNumber || leadData?.facesheet?.room,
    ) as unknown as number,
    address:
         {
            street: safeStr(leadData?.facesheet?.address?.street || leadData?.biography?.personalDetails?.address?.street1),
            city: safeStr(leadData?.facesheet?.address?.city || leadData?.biography?.personalDetails?.address?.city),
            state: safeStr(leadData?.facesheet?.address?.state || leadData?.biography?.personalDetails?.address?.state),
            zipCode: safeStr(leadData?.facesheet?.address?.zipCode || leadData?.biography?.personalDetails?.address?.zipCode),
          },
    primaryLanguage: safeStr(primaryLanguage),

    emergencyPrimaryName: safeStr(
      leadData?.biography?.personalDetails?.emergencyContactName ||
        leadData?.facesheet?.emergencyPrimaryName,
    ),
    emergencyPrimaryRelationship: safeStr(
      leadData?.facesheet?.emergencyPrimaryRelationship,
    ),
    emergencyPrimaryPhone: safeStr(
      leadData?.biography?.personalDetails?.emergencyContactNumber ||
        leadData?.facesheet?.emergencyPrimaryPhone,
    ),
    emergencySecondaryName: safeStr(
      leadData?.facesheet?.emergencySecondaryName,
    ),
    emergencySecondaryRelationship: safeStr(
      leadData?.facesheet?.emergencySecondaryRelationship,
    ),
    emergencySecondaryPhone: safeStr(
      leadData?.facesheet?.emergencySecondaryPhone,
    ),
    allergies,
    keyConditions,
    insuranceProvider: safeStr(
      leadData?.facesheet?.insuranceProvider || insuranceDetails.providerName,
    ),
    insuranceMemberId: safeStr(
      leadData?.facesheet?.insuranceMemberId || insuranceDetails.memberId,
    ),
    medicaid: safeStr(leadData?.facesheet?.medicaid),
    dnr:
      (safeStr(leadData?.facesheet?.dnr) as FaceSheetDraft["dnr"]) ||
      "Not on file",
    advanceDirective:
      (safeStr(
        leadData?.facesheet?.advanceDirective,
      ) as FaceSheetDraft["advanceDirective"]) || "Not on file",
    documents: {
      insuranceDocument: existingDocuments.insuranceDocument || {
        status: "empty",
      },
      dnrForm: existingDocuments.dnrForm || { status: "empty" },
      advanceDirectiveWill: existingDocuments.advanceDirectiveWill || {
        status: "empty",
      },
    },
  };
}

// build payload to update user
function buildUpdatePayload(leadData: any, draft: FaceSheetDraft) {
  const { firstName, lastName } = splitName(draft.name);
  const oldDocuments = leadData?.facesheet?.documents || {};
  const newDocuments = draft.documents || {};
  const removedDocumentTypes = Object.keys(oldDocuments).filter(
    (docType) => !(docType in newDocuments),
  );
  const facesheetData = {
    ...draft,
    documents: {
      ...newDocuments,
      ...removedDocumentTypes.reduce((acc, docType) => {
        acc[docType] = undefined;
        return acc;
      }, {} as any),
    },
  };

  const biographyAddress = draft.address
    ? {
        street1: draft.address?.street || "",
        street2:
          leadData?.biography?.personalDetails?.address?.street2 || "",
        city: draft.address?.city || "",
        state: draft.address?.state || "",
        zipCode: draft.address?.zipCode || "",
        previousPlaceOfResidence:
          leadData?.biography?.personalDetails?.address
            ?.previousPlaceOfResidence || "",
      }
    : undefined;
  const patch = {
    name: draft.name,
    firstName,
    lastName,
    biography: {
      personalDetails: {
        birthdate: draft.birthdate,
        gender: draft.gender,
        emergencyContactName: draft.emergencyPrimaryName,
        emergencyContactNumber: draft.emergencyPrimaryPhone,
        address: biographyAddress,
      },
    },
    medical: {
      general: {
        foodAllergies: draft.allergies,
      },
    },
    clinical: {
      roomNumber: Number(draft.room),
    },
    facesheet: facesheetData,
  };
  const cleanedPatch = removeEmptyValuesDeep(patch);
  const result = deepMerge(leadData, cleanedPatch);

  result.facesheet = {
    ...(result.facesheet ?? {}),
    ...(cleanedPatch.facesheet ?? {}),
    documents: draft.documents ?? {},
  };

  return result;
}

/** ---------------- Component ---------------- */
export default function FaceSheet({ leadData }: any) {
  const [isSaving, setIsSaving] = useState(false);
  const faceSheetRef = useRef<HTMLDivElement | null>(null);
  const tokenRole = getUserRoleFromToken();
  const providerRole = useContext(RoleContext)?.role;
  const contextRole = tokenRole ?? providerRole;
  const canEdit = hasAccess(contextRole as Role, "SENIOR_FACE_SHEET", "EDIT");
  
  // Disable editing if lead is deleted or has lost milestone
  const isDeletedOrLost = leadData?.isDeleted || leadData?.milestone?.includes(milestones.LOST);
  const canEditFinal = canEdit && !isDeletedOrLost;
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const { mutate } = useUpdate();
  const dispatch = useDispatch();
  const homeId = getHomeIdFromToken();
  const addressEditorRef = useRef<HTMLDivElement | null>(null);

  const handleAddressBlurCapture = (e: React.FocusEvent<HTMLDivElement>) => {
    const nextFocused = e.relatedTarget as Node | null;

    if (
      addressEditorRef.current &&
      nextFocused &&
      addressEditorRef.current.contains(nextFocused)
    ) {
      return;
    }

    setIsEditingAddress(false);
  };

  //Function to print facesheet
  const printFaceSheetOnly = () => {
    if (!faceSheetRef.current) return;

    const printContents = faceSheetRef.current.innerHTML;
    const originalContents = document.body.innerHTML;
    const headHtml = document.head.innerHTML;

    document.body.innerHTML = `
      <html>
        <head>${headHtml}</head>
        <body>
          <div style="padding:16px">${printContents}</div>
        </body>
      </html>
    `;

    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload();
  };

  // Getting insurance details from users documents(in_the event_of_death)
  const insuranceDetails = useMemo(() => {
    const docs = leadData?.documents ?? [];

    const insuranceDoc =
      docs.find(
        (d: any) => d?.documentName?.split(".")?.[0] === in_the_event_of_death,
      ) ?? null;

    const providerName = safeStr(
      insuranceDoc?.documentValues?.resident_life_insurance_provider,
    );
    const memberId = safeStr(
      insuranceDoc?.documentValues?.resident_life_insurance_policy_number,
    );
    const insuranceDocument =
      insuranceDoc?.fileUrl ?? insuranceDoc?.s3Url ?? insuranceDoc ?? null;

    return { providerName, memberId, insuranceDocument };
  }, [leadData?.documents]);

  const initialDraft = useMemo(
    () => buildDraftFromLeadData(leadData, insuranceDetails),
    [leadData, insuranceDetails.providerName, insuranceDetails.memberId],
  );

  const bucketName = process.env.NEXT_PUBLIC_AWS_USER_DOCUMENTS_BUCKET_NAME;

  // imports form properties
  const {
    values: draft,
    setFieldValue,
    setMultipleValues,
    validateForm,
    resetForm,
    markCurrentAsClean,
    isDirty,
    bindField,
    errors,
    touched,
    touchField,
  } = useZodForm({
    schema: faceSheetSchema as any,
    initialValues: initialDraft,
  });

  useEffect(() => {
    resetForm(initialDraft);
  }, [initialDraft]);

  const age = useMemo(() => calculateAge(draft.birthdate), [draft.birthdate]);
  const addressDisplay = [
    draft.address?.street,
    draft.address?.city,
    draft.address?.state,
    draft.address?.zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  // facesheet documents to upload
  const DOC_TYPES = FACESHEET_DOC_TYPES;

  type DocType = (typeof DOC_TYPES)[number];

  // if user want to upload/remove doc,  after hitting save this will upload/remove doc from s3
  const applyDocumentSideEffects = async () => {
    const updatedDocs: any = { ...(draft.documents ?? {}) };

    for (const docType of DOC_TYPES) {
      const doc = updatedDocs[docType];

      // Upload new file ONLY now
      if (doc?.status === "new" && doc?.file) {
        const fileName = `${homeId}/${leadData?.userId}/${docType}`;
        const uploadedUrl = await uploadToS3(doc.file, fileName, bucketName!);

        updatedDocs[docType] = {
          fileUrl: uploadedUrl,
          fileName: doc.file.name,
          fileSize: doc.file.size,
          uploadedAt: new Date().toISOString(),
          status: "existing",
        };
      }
      if (doc?.status === "remove") {
        const bucketUploadPath = `${homeId}/${leadData?.userId}/${docType}`;
        if (doc?.fileName) {
          await deleteFromS3(doc.fileName, bucketUploadPath, bucketName!);
        }

        delete updatedDocs[docType];
      }
      if (doc?.status === "empty") {
        delete updatedDocs[docType];
      }
    }

    return updatedDocs;
  };

  // perform form validation and update user and clinical table
  const onSave = async () => {
    if (!isDirty) return;

    const isValid = validateForm();
    if (!isValid) return;
    setIsSaving(true);
    try {
      const finalDocs = await applyDocumentSideEffects();
      const draftForSave = {
        ...draft,
        documents: finalDocs,
      };

      const payload = buildUpdatePayload(leadData, draftForSave);

      const finalData = omit(
        payload,
        USER_PATH_OMIT_FIELDS,
      ) as unknown as ExtendedLead;
      const finalPayload = { data: finalData, path: UserPath };

      const clinicalPayload = {
        data: omit(payload.clinical, CLINICAL_USER_PATH_OMIT_FIELDS),
        path: ClinicalUserPath,
      };
      mutate(finalPayload, {
        onSuccess: () => {
          mutate(clinicalPayload, {
            onSuccess: () => {
              dispatch(handleOpenPopover());
              dispatch(
                handleShowPopoverMessage("FaceSheet updated successfully"),
              );
              markCurrentAsClean();
            },
            onError: (error: any) => {
              dispatch(handleOpenPopover());
              dispatch(handleShowCloseOptions());
              dispatch(
                handleShowPopoverMessage(
                  error?.response?.data?.message ||
                    "Error in updating user details",
                ),
              );
            },
          });
        },
        onError: (error: any) => {
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(
            handleShowPopoverMessage(
              error?.response?.data?.message ||
                "Error in updating user details",
            ),
          );
        },
      });
    } catch (e) {
      console.error("Save FaceSheet failed:", e);
    } finally {
      setIsSaving(false);
    }
  };

  // stages all uploading docs
  const stageDocumentUpload = (
    documentType: "insuranceDocument" | "dnrForm" | "advanceDirectiveWill",
    file: File,
  ) => {
    setMultipleValues({
      documents: {
        ...(draft.documents ?? {}),
        [documentType]: {
          ...(draft.documents?.[documentType] ?? { status: "empty" }),
          file,
          status: "new",
        },
      },
    });
  };

  // stages all removing docs
  const stageDocumentRemove = (
    documentType: "insuranceDocument" | "dnrForm" | "advanceDirectiveWill",
  ) => {
    const current = draft.documents?.[documentType];
    if (current?.status === "new") {
      setMultipleValues({
        documents: {
          ...(draft.documents ?? {}),
          [documentType]: { status: "empty" },
        },
      });
      return;
    }
    if (current?.fileUrl) {
      setMultipleValues({
        documents: {
          ...(draft.documents ?? {}),
          [documentType]: {
            ...current,
            status: "remove",
          },
        },
      });
      return;
    }

    setMultipleValues({
      documents: {
        ...(draft.documents ?? {}),
        [documentType]: { status: "empty" },
      },
    });
  };

  // if want to undo the remove operation of doc
  const stageUndoRemove = (documentType: DocType) => {
    const cur = draft.documents?.[documentType];
    if (!cur) return;

    if (cur?.fileUrl) {
      setMultipleValues({
        documents: {
          ...(draft.documents ?? {}),
          [documentType]: { ...cur, status: "existing" },
        },
      });
    } else {
      setMultipleValues({
        documents: {
          ...(draft.documents ?? {}),
          [documentType]: { status: "empty" },
        },
      });
    }
  };

  const handleViewFile = async (documentUrl: string) => {
    try {
      const url = await fetchPreSignedUrl(documentUrl);
      if (url) {
        window.open(url, "_blank");
      }
    } catch (error) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage("Unable to load File. Please try again."),
      );
    }
  };

  // upload file size validation
  const handleFileSizeError = (errorMessage: string) => {
    dispatch(handleOpenPopover());
    dispatch(handleShowCloseOptions());
    dispatch(handleShowPopoverMessage(errorMessage));
  };
  const today = new Date().toISOString().split("T")[0];
  // binding values to form fields
  const nameField = bindField("name");
  const genderField = bindField("gender");
  const roomField = bindField("room");
  const birthdateField = bindField("birthdate");
  const primaryLanguageField = bindField("primaryLanguage");
  const allergiesField = bindField("allergies");
  const keyConditions = bindField("keyConditions");
  const insuranceProviderField = bindField("insuranceProvider");
  const insuranceMemberIdField = bindField("insuranceMemberId");
  const medicaidField = bindField("medicaid");
  const dnrField = bindField("dnr");
  const advanceDirectiveField = bindField("advanceDirective");

  return (
    <div className="w-full max-w-xl mx-auto p-4 space-y-8 bg-white print:p-0 print:m-0">
      <div className="flex justify-end mb-3 print:hidden">
        <Button name="Print Face Sheet" buttonClick={printFaceSheetOnly} />
      </div>

      <div
        ref={faceSheetRef}
        className={`
    w-full max-w-xl mx-auto p-4 space-y-8 bg-white print:p-0 print:m-0
    ${!canEditFinal ? "pointer-events-none select-none opacity-95" : ""}
  `}
      >
        {/* HERO */}
        <Card className="p-6">
          <div className="flex items-center gap-5">
            {/* Profile Image */}
            <Avatar
              src={leadData?.profileImageUrl}
              name={draft?.name || leadData?.name}
              size={100}
              variant="bordered"
              alt="Senior Profile"
            />
            <div className="flex-1">
              {/* Name Field */}
              <div className="text-xl font-extrabold text-gray-900 leading-tight">
                <InlineInput
                  value={toTitleCase(String(nameField.value ?? ""))}
                  onChange={(v) => nameField.onChange(v)}
                  onBlur={nameField.onBlur}
                  error={nameField.error}
                  placeholder="Name"
                  className="text-xl font-extrabold leading-tight"
                />
              </div>

              {/* Age & Gender */}
              <div className="flex mt-1 text-sm text-gray-500 justify-between">
                <div className="flex">
                  <span className="text-sm text-gray-400 font-medium pt-[2px]">
                    Age:
                  </span>
                  <span className="pt-[2px]">{age ?? "—"}</span>
                </div>
                <div className="flex justify-end">
                  <span className="text-sm text-gray-400 font-medium pt-[2px]">
                    Gender:
                  </span>
                  <div className="">
                    <InlineSelect
                      value={String(genderField.value ?? "")}
                      onChange={(v) =>
                        genderField.onChange(v as FaceSheetDraft["gender"])
                      }
                      onBlur={genderField.onBlur}
                      error={genderField.error}
                      className="text-sm text-gray-500 font-medium"
                      options={[
                        { label: "-", value: "" },
                        { label: "Male", value: "Male" },
                        { label: "Female", value: "Female" },
                        { label: "Other", value: "Other" },
                      ]}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-1 text-sm text-gray-400">
                <div className="">
                  {/* Home */}
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400 font-medium pt-[2px]">
                      Home:
                    </span>
                    <div className="text-sm text-gray-400 font-bold">
                      {leadData.home}
                    </div>
                  </div>
                  {/* Address */}
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400 font-medium pt-[2px]">
                      Address:
                    </span>
                    <div className="">
                      <div
                        ref={addressEditorRef}
                        onBlurCapture={handleAddressBlurCapture}
                        className="w-full text-right"
                      >
                        {!isEditingAddress ? (
                          <div className="w-full">
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditingAddress(true);
                                touchField("address");
                              }}
                              className="w-full text-right bg-transparent border-0 p-0"
                            >
                              <div className="text-sm text-gray-400 font-medium">
                                {addressDisplay || "—"}
                              </div>
                            </button>

                            {touched.address && errors.address ? (
                              <div className="mt-1 text-xs text-red-500 text-right">
                                {errors.address}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <InlineInput
                              value={String(draft.address?.street ?? "")}
                              onChange={(v) =>
                                setMultipleValues({
                                  address: {
                                    ...(draft.address ?? {}),
                                    street: v,
                                  },
                                })
                              }
                              onBlur={() => touchField("address")}
                              // error={
                              //   touched.address ? errors.address || "" : ""
                              // }
                              placeholder="Street"
                              className="text-sm text-gray-400 font-medium text-right"
                            />

                            <InlineInput
                              value={String(draft.address?.city ?? "")}
                              onChange={(v) =>
                                setMultipleValues({
                                  address: {
                                    ...(draft.address ?? {}),
                                    city: v,
                                  },
                                })
                              }
                              onBlur={() => touchField("address")}
                              // error={
                              //   touched.address ? errors.address || "" : ""
                              // }
                              placeholder="City"
                              className="text-sm text-gray-400 font-medium text-right"
                            />

                            <InlineInput
                              value={String(draft.address?.state ?? "")}
                              onChange={(v) =>
                                setMultipleValues({
                                  address: {
                                    ...(draft.address ?? {}),
                                    state: v,
                                  },
                                })
                              }
                              onBlur={() => touchField("address")}
                              // error={
                              //   touched.address ? errors.address || "" : ""
                              // }
                              placeholder="State"
                              className="text-sm text-gray-400 font-medium text-right"
                            />

                            <InlineInput
                              value={String(draft.address?.zipCode ?? "")}
                              onChange={(v) =>
                                setMultipleValues({
                                  address: {
                                    ...(draft.address ?? {}),
                                    zipCode: v,
                                  },
                                })
                              }
                              onBlur={() => touchField("address")}
                              // error={
                              //   touched.address ? errors.address || "" : ""
                              // }
                              placeholder="Zip Code"
                              className="text-sm text-gray-400 font-medium text-right"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-sm text-gray-400 font-medium pt-[2px]">
                    Room:
                  </span>
                  <div className="w-[120px]">
                    <InlineInput
                      value={String(roomField.value ?? "")}
                      onChange={(v) => roomField.onChange(v as any)}
                      onBlur={roomField.onBlur}
                      error={roomField.error}
                      placeholder="—"
                      className="text-sm text-gray-400 font-medium"
                      type="number"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Core demographics */}
        <Card>
          <SectionTitle title="Core demographics" />
          <div className="mt-6">
            <Row label="Date of birth">
              <InlineInput
                type="date"
                value={toDateInputValue(String(birthdateField.value ?? ""))}
                onChange={(v) => birthdateField.onChange(v)}
                onBlur={birthdateField.onBlur}
                error={birthdateField.error}
                className="text-right"
                max={today}
              />
            </Row>

            <Row label="Primary language" divider={false}>
              <InlineInput
                value={String(primaryLanguageField.value ?? "")}
                onChange={(v) => primaryLanguageField.onChange(v)}
                onBlur={primaryLanguageField.onBlur}
                error={primaryLanguageField.error}
                className="text-right"
              />
            </Row>
          </div>
        </Card>

        {/* Emergency contacts */}
        <Card>
          <SectionTitle title="Emergency contacts" />
          <div className="mt-6">
            <ContactBlock
              title="Primary"
              name={draft.emergencyPrimaryName}
              relationship={draft.emergencyPrimaryRelationship}
              phone={draft.emergencyPrimaryPhone}
              errors={{
                name: touched.emergencyPrimaryName
                  ? errors.emergencyPrimaryName || ""
                  : "",
                relationship: touched.emergencyPrimaryRelationship
                  ? errors.emergencyPrimaryRelationship || ""
                  : "",
                phone: touched.emergencyPrimaryPhone
                  ? errors.emergencyPrimaryPhone || ""
                  : "",
              }}
              onBlur={(field) => {
                if (field === "name") touchField("emergencyPrimaryName");
                if (field === "relationship") {
                  touchField("emergencyPrimaryRelationship");
                }
                if (field === "phone") touchField("emergencyPrimaryPhone");
              }}
              onChange={(patch) =>
                setMultipleValues({
                  emergencyPrimaryName:
                    patch.name ?? draft.emergencyPrimaryName,
                  emergencyPrimaryRelationship:
                    patch.relationship ?? draft.emergencyPrimaryRelationship,
                  emergencyPrimaryPhone:
                    patch.phone ?? draft.emergencyPrimaryPhone,
                })
              }
              divider={false}
            />
            <ContactBlock
              title="Secondary"
              name={draft.emergencySecondaryName}
              relationship={draft.emergencySecondaryRelationship}
              phone={draft.emergencySecondaryPhone}
              errors={{
                name: touched.emergencySecondaryName
                  ? errors.emergencySecondaryName || ""
                  : "",
                relationship: touched.emergencySecondaryRelationship
                  ? errors.emergencySecondaryRelationship || ""
                  : "",
                phone: touched.emergencySecondaryPhone
                  ? errors.emergencySecondaryPhone || ""
                  : "",
              }}
              onBlur={(field) => {
                if (field === "name") touchField("emergencySecondaryName");
                if (field === "relationship") {
                  touchField("emergencySecondaryRelationship");
                }
                if (field === "phone") touchField("emergencySecondaryPhone");
              }}
              onChange={(patch) =>
                setMultipleValues({
                  emergencySecondaryName:
                    patch.name ?? draft.emergencySecondaryName,
                  emergencySecondaryRelationship:
                    patch.relationship ?? draft.emergencySecondaryRelationship,
                  emergencySecondaryPhone:
                    patch.phone ?? draft.emergencySecondaryPhone,
                })
              }
              divider={false}
            />
          </div>
        </Card>

        {/* Clinical snapshot */}
        <Card>
          <SectionTitle title="Clinical snapshot" />
          <div className="mt-2">
            <SimpleListSection
              title="Allergies"
              valueText={String(allergiesField.value ?? "")}
              onChange={(v) => allergiesField.onChange(v)}
              onBlur={allergiesField.onBlur}
              error={allergiesField.error}
            />
          </div>
          <div className="">
            <SimpleListSection
              title="Key Conditions"
              valueText={String(keyConditions.value ?? "")}
              onChange={(v) => keyConditions.onChange(v)}
              onBlur={keyConditions.onBlur}
              error={keyConditions.error}
            />
          </div>
        </Card>

        {/* Insurance */}
        <Card>
          <SectionTitle title="Insurance" />
          <div className="mt-6">
            <Row label="Provider">
              <InlineInput
                value={String(insuranceProviderField.value ?? "")}
                onChange={(v) => insuranceProviderField.onChange(v)}
                onBlur={insuranceProviderField.onBlur}
                error={insuranceProviderField.error}
                className="text-right"
              />
            </Row>

            <Row label="Member ID" divider={false}>
              <InlineInput
                value={String(insuranceMemberIdField.value ?? "")}
                onChange={(v) => insuranceMemberIdField.onChange(v)}
                onBlur={insuranceMemberIdField.onBlur}
                error={insuranceMemberIdField.error}
                className="text-right"
              />
            </Row>
            <Row label="Medic ID" divider={false}>
              <InlineInput
                value={String(medicaidField.value ?? "")}
                onChange={(v) => medicaidField.onChange(v)}
                onBlur={medicaidField.onBlur}
                error={medicaidField.error}
                className="text-right"
              />
            </Row>
            

            <div className="px-6 py-2 text-xs text-gray-400 print:hidden">
              Insurance document:{" "}
              {leadData?.facesheet?.documents?.insuranceDocument
                ? "On file"
                : "Not on file"}
            </div>
          </div>
        </Card>

        {/* Care directives */}
        <Card>
          <SectionTitle title="Care directives" />
          <div className="mt-6">
            <Row label="Do Not Resuscitate (DNR)">
              <InlineSelect
                value={String(dnrField.value ?? "")}
                onChange={(v) => dnrField.onChange(v as FaceSheetDraft["dnr"])}
                onBlur={dnrField.onBlur}
                error={dnrField.error}
                options={[
                  { label: "Yes", value: "Yes" },
                  { label: "No", value: "No" },
                  { label: "Not on file", value: "Not on file" },
                ]}
                className="text-right"
              />
            </Row>

            <Row label="Advance directive / Will" divider={false}>
              <InlineSelect
                value={String(advanceDirectiveField.value ?? "")}
                onChange={(v) =>
                  advanceDirectiveField.onChange(v as FaceSheetDraft["dnr"])
                }
                onBlur={advanceDirectiveField.onBlur}
                error={advanceDirectiveField.error}
                options={[
                  { label: "Yes", value: "Yes" },
                  { label: "No", value: "No" },
                  { label: "Not on file", value: "Not on file" },
                ]}
                className="text-right"
              />
            </Row>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Documents" />
          <div className="mt-6">
            <UploadRow
              label="Insurance document"
              disabled={!canEdit}
              doc={draft.documents?.insuranceDocument}
              onView={() =>
                handleViewFile(draft.documents?.insuranceDocument?.fileUrl)
              }
              onPickFile={(file) =>
                stageDocumentUpload("insuranceDocument", file)
              }
              onRemove={() => stageDocumentRemove("insuranceDocument")}
              onUndo={() => stageUndoRemove("insuranceDocument")}
              onFileSizeError={handleFileSizeError}
            />
            <UploadRow
              label="DNR form"
              disabled={!canEdit}
              doc={draft.documents?.dnrForm}
              onView={() => handleViewFile(draft.documents?.dnrForm?.fileUrl)}
              onPickFile={(file) => stageDocumentUpload("dnrForm", file)}
              onRemove={() => stageDocumentRemove("dnrForm")}
              onUndo={() => stageUndoRemove("dnrForm")}
              onFileSizeError={handleFileSizeError}
            />
            <UploadRow
              label="Advance directive / Will"
              disabled={!canEdit}
              doc={draft.documents?.advanceDirectiveWill}
              onView={() =>
                handleViewFile(draft.documents?.advanceDirectiveWill?.fileUrl)
              }
              onPickFile={(file) =>
                stageDocumentUpload("advanceDirectiveWill", file)
              }
              onRemove={() => stageDocumentRemove("advanceDirectiveWill")}
              onUndo={() => stageUndoRemove("advanceDirectiveWill")}
              onFileSizeError={handleFileSizeError}
            />
          </div>
        </Card>
      </div>

      {isDirty ? (
        <div className="sticky bottom-4 z-10 print:hidden">
          <div className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white shadow-md px-4 py-3 flex items-center justify-between">
            <div className="text-sm text-gray-600">Unsaved changes</div>
            <Button
              type="button"
              name={isSaving ? "Saving..." : "Save"}
              buttonClick={onSave}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
