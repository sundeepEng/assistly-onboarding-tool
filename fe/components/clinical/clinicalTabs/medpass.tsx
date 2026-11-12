import React from "react"; // Add this line
import { NextPage } from "next";
import { useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import BaseTable from "../../../commonComponents/base-table";
import Button from "../../../commonComponents/button";
import Comments from "../../../commonComponents/comments/comments";
import TextareaComponent from "../../../commonComponents/textarea-component";
import ToggleButton from "../../../commonComponents/toggle-button";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import useUpdate from "../../../services/update";
import {
  CLINICAL_USER_PATH_OMIT_FIELDS,
  ClinicalUserPath,
  PASS,
  REFUSE,
  UserPath,
} from "../../../utils/constants";
import {
  dateFormat,
  formatUtcToLocalDisplay,
  getYYYYMMDDString,
  omit,
  timeFormat,
} from "../../../utils/dateUtils";
import { hasAccess } from "../../../utils/roleAccess";
import { Role } from "../../../utils/roles";
import { ReportedByCell } from "../../reported-by-cell";
import { RoleContext } from "../../role-provider";
import EmarDataLayer from "../../../utils/emarDataLayer";
import useCommentUsers from "../../../utils/useCommentUsers";
import SelectComponent from "../../../commonComponents/select-component";
import { getUserIdFromToken, getUserRoleFromToken } from "../../../utils/auth";
import InputFieldComponent from "../../../commonComponents/input-field-component";
import { ProtectedComponent } from "../../protectedComponent";

interface MedPass {
  name: string;
  directions: string;
  date: string;
  timings: string;
  comments: string;
  medPassBy: string;
  medicationId?: string;
}

const Medpass: NextPage<{ seniorData: any; refetch: any }> = ({
  seniorData,
  refetch,
}) => {
  const { mutate } = useUpdate();
  const dispatch = useDispatch();
  const [editAccess, setEditAccess] = useState(false);
  const medicationData = seniorData?.clinical?.medication || [];
  const currentDate = getYYYYMMDDString(new Date());
  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(contextRole);
  const [medpassFilter, setMedpassFilter] = useState<string>(currentDate);

  const getMedpassDateTime = (date: string, timing: string) => {
    return new Date(`${date}T${timing}`).toISOString();
  };
  const isFutureMedpassTime = (date: string, timing: string) => {
    const selectedDateTime = new Date(`${date}T${timing}`);
    const now = new Date();

    return selectedDateTime > now;
  };
  const emarOptions = [
    { value: "", option: "Generate EMAR" },
    ...Array.from({ length: 12 }).map((_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - index);
      const value = date.toISOString().slice(0, 7); // "YYYY-MM"
      const option = date.toLocaleString("default", {
        month: "long",
        year: "numeric",
      }); // "July 2025"
      return { value, option };
    }),
  ];

  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole]);
  const userIds = seniorData?.clinical?.medPass?.services?.map(
    (u) => u?.providedBy,
  );
  const { userMap, isLoading } = useCommentUsers({ userIds, path: UserPath });

  // Prepare data without useMemo
  const dateFilteredMedications = medicationData?.filter((data) => {
    if (data?.startdate <= medpassFilter && !data?.overTheCounter) {
      if (!data?.enddate || data?.enddate >= medpassFilter) {
        return true;
      }
    }
    return false;
  });

  const expandedMedications = dateFilteredMedications?.flatMap((data) => {
    if (Array.isArray(data?.timings)) {
      return data?.timings.map((timing) => ({
        ...data,
        timings: timing,
        medicationId: data?.id,
        id: `${data?.id}-${timing}`,
      }));
    }
    return data;
  });
  // Build rows from current medication list
  const currentMedicationRows = expandedMedications || [];

  // Reconstruct historical rows from medPass services recorded on the selected date
  // so medications removed today still appear for dates they were administered.
  const historicalMedicationRows = (seniorData?.clinical?.medPass?.services || [])
    .filter((service) => {
      if (!service?.providedAt) return false;
      return getYYYYMMDDString(service.providedAt) === medpassFilter;
    })
    .map((service) => {
      const existingMed = medicationData.find(
        (med) => med.id === service.medicationId,
      );
      return {
        ...existingMed,
        id: `${service.medicationId}-${service.timing}`,
        medicationId: service.medicationId,
        timings: service.timing,
        name: existingMed?.name || service.medicationId || "Unknown Medication",
        directions: existingMed?.directions || "",
        dosage: existingMed?.dosage || "",
      };
    });

  // Merge current and historical rows, keeping current metadata when available
  const medicationRowMap = new Map<string, any>();
  const rowKey = (row: any) => `${row.medicationId || row.id}-${row.timings}`;

  [...currentMedicationRows, ...historicalMedicationRows].forEach((row) => {
    const key = rowKey(row);
    if (!medicationRowMap.has(key)) {
      medicationRowMap.set(key, row);
    }
  });

  const scheduledMedication = Array.from(medicationRowMap.values()).sort(
    (a, b) => {
      const [aHours, aMinutes] = a.timings.split(":").map(Number);
      const [bHours, bMinutes] = b.timings.split(":").map(Number);
      const aTotalMinutes = aHours * 60 + aMinutes;
      const bTotalMinutes = bHours * 60 + bMinutes;
      return aTotalMinutes - bTotalMinutes;
    },
  );
  const isToday = medpassFilter === currentDate;

  useEffect(() => {
    const canEditToday =
      hasAccess(role as Role, "CLINICAL_MEDPASS", "EDIT") ||
      hasAccess(role as Role, "CLINICAL_TABS", "EDIT");
    const canEditHistory = hasAccess(
      role as Role,
      "CLINICAL_MEDPASS_HISTORY_EDIT",
      "EDIT",
    );
    setEditAccess(isToday ? canEditToday : canEditHistory);
  }, [role, isToday]);

  const canEditHistoryComments = hasAccess(
    role as Role,
    "CLINICAL_COMMENTS_HISTORY_EDIT",
    "EDIT",
  );
  const commentEditAccess = isToday || canEditHistoryComments;

  const handlePass = (state, data) => {
    if (state == "Pass") {
      if (!seniorData?.clinical?.medPass) {
        seniorData.clinical.medPass = { services: [] };
      }
      const providedAt = getMedpassDateTime(medpassFilter, data.timings);
      const ownerUserId = getUserIdFromToken();
      const medicationId = data?.medicationId || data?.id;

      const payloadData = {
        medicationId: medicationId,
        passOrRefuse: "Pass",
        remarks: "",
        providedAt: providedAt,
        providedBy: ownerUserId,
        timing: data.timings,
      };
      let existingIndex = -1;
      seniorData?.clinical?.medPass?.services?.some((item, index) => {
        if (
          item?.medicationId === medicationId &&
          item?.timing === data.timings
        ) {
          const apiDateOnly = getYYYYMMDDString(item?.providedAt);
          if (apiDateOnly === medpassFilter) {
            existingIndex = index;
            return true;
          }
        }

        return false;
      });

      if (existingIndex !== -1) {
        seniorData.clinical.medPass.services[existingIndex] = payloadData;
      } else {
        seniorData?.clinical?.medPass?.services?.push(payloadData);
      }

      const cleanedMedpassData: any = omit(
        seniorData?.clinical,
        CLINICAL_USER_PATH_OMIT_FIELDS,
      );

      const payload = {
        data: cleanedMedpassData,
        path: ClinicalUserPath,
      };

      mutate(payload, {
        onSuccess: () => { },
        onError: (error: any) => {
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(handleShowPopoverMessage(`Not able to update action!`));
        },
      });
    }
  };

const handleUnselectMedpass = (data) => {
  if (!seniorData?.clinical?.medPass?.services) return;

  const medicationId = data?.medicationId || data?.id;

  seniorData.clinical.medPass.services =
    seniorData.clinical.medPass.services.filter((item) => {
      const apiDateOnly = getYYYYMMDDString(item?.providedAt);

      return !(
        item?.medicationId === medicationId &&
        item?.timing === data?.timings &&
        apiDateOnly === medpassFilter
      );
    });

  const cleanedMedpassData: any = omit(
    seniorData?.clinical,
    CLINICAL_USER_PATH_OMIT_FIELDS,
  );

  const payload = {
    data: cleanedMedpassData,
    path: ClinicalUserPath,
  };

  mutate(payload, {
    onSuccess: () => {
      refetch();
    },
    onError: () => {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage(`Not able to update action!`));
    },
  });
};
  const columns = [
    {
      header: "Medication",
      field: "name" as keyof MedPass,
      minWidth: "350px",
      render: (_value, row) => (
        <div className="flex flex-col pl-[25px] ">
          <p className="font-semibold">
            {row?.name} - {row?.dosage && row?.dosage}
          </p>
          <p className="text-sm font-medium text-gray-500 mt-[-10px]">
            {row?.directions}
          </p>
        </div>
      ),
      headerClassName: "pl-[25px] text-xs font-medium",
    },
    {
      header: "Date",
      field: "date" as keyof MedPass,
      minWidth: "100px",
      render: () => {
        return <div>{dateFormat(medpassFilter)}</div>;
      },
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Timings",
      field: "timings" as keyof MedPass,
      minWidth: "100px",
      render: (_value) => <div>{timeFormat(_value)}</div>,
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Actions",
      field: "actions",
      minWidth: "150px",
      render: (_value, data) => {
        let isPassed = "";
        const medicationId = data?.medicationId || data?.id;
        if (Array.isArray(seniorData?.clinical?.medPass?.services)) {
          seniorData?.clinical?.medPass?.services?.some((item) => {
            if (
              item?.medicationId === medicationId &&
              item?.timing === data?.timings
            ) {
              const apiDateOnly = getYYYYMMDDString(item?.providedAt);
              if (apiDateOnly === medpassFilter) {
                isPassed = item?.passOrRefuse;
                return true;
              }
            }
            return false;
          });
        }
        const toSeconds = (t: string) => {
          const [hh = "0", mm = "0", ss = "0"] = t.split(":");
          return Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
        };
        const timingSec = toSeconds(data.timings);
        const now = new Date();
        const currentSeconds =
          now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const isTimeValid = !isFutureMedpassTime(medpassFilter, data.timings);
        return (
          <div
            className={`flex gap-2 ${!editAccess && "cursor-none"} ${seniorData?.isDeleted ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <div
              className={`${seniorData?.isDeleted ? "pointer-events-none" : ""}`}
            >
             <ToggleButton
  key={`${medpassFilter}-${medicationId}-${data.timings}-${isPassed}`}
  passName={PASS}
  refuseName={REFUSE}
  initialState={isPassed}
  isTimeValid={isTimeValid}
  allowUnselect={true}
  onChange={(state) => {
    if (!isTimeValid) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage(
          "Medication can't be given before scheduled time!",
        ),
      );
      return;
    }

    if (state === "") {
      handleUnselectMedpass(data);
      return;
    }

    if (state === "Pass") {
      handlePass("Pass", data);
    }
  }}
  editAccess={editAccess}
  comments={true}
  ToggleBody={({ setOpen }) => (
    <RefuseComments
      setOpen={setOpen}
      seniorData={seniorData}
      medicationData={data}
      medpassFilter={medpassFilter}
      refetch={refetch}
    />
  )}
/>
            </div>
          </div>
        );
      },
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Comments",
      field: "comments" as keyof MedPass,
      minWidth: "150px",
      render: (_value, data) => {
        let comment = "";
        const medicationId = data?.medicationId || data?.id;

        if (Array.isArray(seniorData?.clinical?.medPass?.services)) {
          seniorData?.clinical?.medPass?.services?.some((item) => {
            if (
              item?.medicationId === medicationId &&
              item.timing === data.timings
            ) {
              const apiDateOnly = getYYYYMMDDString(item?.providedAt);
              const todayDateOnly = getYYYYMMDDString(new Date());
              if (apiDateOnly === medpassFilter) {
                comment = item?.remarks;
              }
            }
          });
        }

        return <div>{comment ? comment : "-"}</div>;
      },
      headerClassName: "text-xs font-medium",
    },
    {
      header: "MedPass By",
      field: "medPassBy" as keyof MedPass,
      minWidth: "150px",
      render: (_value, data) => {
        const med = seniorData?.clinical?.medPass?.services?.find(
          (item) =>
            item?.medicationId === data?.medicationId &&
            medpassFilter ===
              new Date(item?.providedAt).toLocaleDateString("en-CA") &&
            item?.timing === data?.timings,
        );
        return (
          <ReportedByCell
            id={med?.providedBy}
            date={med ? formatUtcToLocalDisplay(med?.providedAt) : "-"}
          />
        );
      },
      headerClassName: "text-xs font-medium",
    },
  ];

  const handleSubmitComment = (updatedComments) => {
    if (!seniorData?.clinical?.medPass) {
      seniorData.clinical.medPass = { comments: [], services: [] };
    }
    seniorData.clinical.medPass.comments =
      updatedComments?.length > 0
        ? updatedComments
        : seniorData?.clinical?.medPass?.comments;

    const cleanedCareplanData: any = omit(
      seniorData?.clinical,
      CLINICAL_USER_PATH_OMIT_FIELDS,
    );
    const payload = { data: cleanedCareplanData, path: ClinicalUserPath };
    mutate(payload);
  };

  return (
    <div className=" ">
      <ProtectedComponent
        role={role as Role}
        feature="CLINICAL_MEDPASS_DATE_SELECTOR"
        access="EDIT"
      >
        <div className="w-full flex justify-end">
          <div className="flex w-[200px]">
            <InputFieldComponent
              label={<></>}
              type="date"
              value={medpassFilter}
              onChange={(e) => {
                setMedpassFilter(e.target.value);
              }}
              name=""
              max={currentDate}
            />
          </div>
        </div>
      </ProtectedComponent>
      <div className="flex">
        <BaseTable
          columns={columns}
          data={scheduledMedication}
          headerStyles="pt-[5px]"
          cellStyles={(field) =>
            field === "id" ? " justify-end h-full" : "flex h-full"
          }
          tableContainerClass={"rounded-[7px] bg-white"}
        />
      </div>
      <div
        className={`${seniorData?.isDeleted ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <div
          className={`bg-white px-20 py-10 rounded-lg shadow flex ${seniorData?.isDeleted ? "pointer-events-none" : ""}`}
        >
          <Comments
            handleSubmitComment={handleSubmitComment}
            data={seniorData?.clinical?.medPass?.comments}
            selectedDate={medpassFilter}
            editAccess={commentEditAccess}
          />
        </div>
      </div>
    </div>
  );
};

const RefuseComments = ({
  setOpen,
  medicationData,
  seniorData,
  refetch,
  medpassFilter,
}) => {
  const { mutate } = useUpdate();
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const getMedpassDateTime = (date: string, timing: string) => {
    return new Date(`${date}T${timing}`).toISOString();
  };

  const medicationId = medicationData?.medicationId || medicationData?.id;
  let existingIndex = -1;

  seniorData?.clinical?.medPass?.services?.some((item, index) => {
    if (
      item.medicationId === medicationId &&
      item.timing === medicationData.timings
    ) {
      const apiDateOnly = item?.providedAt?.split("T")[0];
      if (apiDateOnly === medpassFilter) {
        existingIndex = index;
      }
    }
  });

  if (!seniorData?.clinical?.medPass) {
    seniorData.clinical.medPass = { services: [], comments: [] };
  }

  const handleSaveComments = () => {
    setLoading(true);
    setOpen(false);

    const providedAt = getMedpassDateTime(
      medpassFilter,
      medicationData.timings,
    );
    const ownerUserId = getUserIdFromToken();

    const payloadData = {
      medicationId: medicationId,
      passOrRefuse: "Refuse",
      remarks: comment,
      providedAt: providedAt,
      providedBy: ownerUserId,
      timing: medicationData.timings,
    };

    if (existingIndex !== -1) {
      seniorData.clinical.medPass.services[existingIndex] = payloadData;
    } else {
      seniorData?.clinical?.medPass?.services?.push(payloadData);
    }

    const cleanedData: any = omit(
      seniorData?.clinical,
      CLINICAL_USER_PATH_OMIT_FIELDS,
    );

    const payload = {
      data: cleanedData,
      path: ClinicalUserPath,
    };

    mutate(payload, {
      onSuccess: () => {
        refetch();
      },
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(`${error?.response?.data?.message}!`),
        );
      },
    });
  };

  const [saveComments, setStateSaveComments] = useState(false);
  return (
    <div>
      <TextareaComponent
        label="Comment here..."
        value={comment}
        onChange={(e) => {
          setComment(e.target.value);
          if (e.target.value.length > 0) {
            setStateSaveComments(true);
          }
        }}
        name="refuse comment"
      />
      <div className="flex justify-center pt-[20px]">
        <Button
          name={!saveComments ? "Save without Comments" : "Save"}
          buttonClick={handleSaveComments}
        />
      </div>
      {loading && <p className="text-gray-500 text-sm mt-2">Saving...</p>}
    </div>
  );
};

export default Medpass;
