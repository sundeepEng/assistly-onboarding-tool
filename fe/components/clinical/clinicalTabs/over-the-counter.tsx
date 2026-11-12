import { NextPage } from "next";
import { useContext, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import BaseTable from "../../../commonComponents/base-table";
import Button from "../../../commonComponents/button";
import Form from "../../../commonComponents/form";
import FormInputFieldComponent from "../../../commonComponents/form-input-field-component";
import FormMultiSelectComponent from "../../../commonComponents/form-multiselect-component";
import CommonModal from "../../../commonComponents/common-modal";
import { ClinicalSchema } from "../../../model/clinical/clinical.model";
import PlusIcon from "../../../public/icons/plus-icon";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import {
  handleCloseOverTheCounterMediactionModal,
  handleOpenOverTheCounterMediactionModal,
} from "../../../redux/slices/modal-slice";
import useUpdate from "../../../services/update";
import {
  CLINICAL_USER_PATH_OMIT_FIELDS,
  ClinicalUserPath,
} from "../../../utils/constants";
import {
  dateFormat,
  omit,
  timeArrayFormat,
  timeFormat,
  timeOptions24H,
} from "../../../utils/dateUtils";
import { Role } from "../../../utils/roles";
import { ProtectedComponent } from "../../protectedComponent";
import { ReportedByCell } from "../../reported-by-cell";
import { RoleContext } from "../../role-provider";
import { format } from "date-fns/format";
import { getUserIdFromToken, getUserRoleFromToken } from "../../../utils/auth";

interface OTCMedication {
  id: number;
  name: string;
  directions: string;
  startdate: string;
  timing: string;
  reason: string;
  medPassStatus?: string;
  medPassBy?: string;
}

//TODO: replace this dummy data with api

const OverTheCounter: NextPage<{ seniorData: any }> = ({ seniorData }) => {
  const [medication, setMedication] = useState(false);
  const dispatch = useAppDispatch();
  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(contextRole);
  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole]);
  const historyColumns = [
    {
      header: "S.No",
      field: "id" as keyof OTCMedication,
      minWidth: "50px",
      render: (_value, data, index) => {
        return <div className="pl-[25px] w-[250px]">{index + 1}.</div>;
      },
      headerClassName: "pl-[25px] text-xs font-medium",
    },
    {
      header: "Medication",
      field: "name" as keyof OTCMedication,
      minWidth: "300px",
      render: (_value, row) => (
        <div className="w-[250px]">
          <p className="text-md truncate px-[10px]">{row?.name}</p>
        </div>
      ),
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Date",
      field: "startdate" as keyof OTCMedication,
      minWidth: "150px",
      render: (_value) => <div className="px-[10px]">{dateFormat(_value)}</div>,
      headerClassName: "text-xs font-medium",
    },
    {
      header: "Timings",
      field: "timings" as keyof OTCMedication,
      minWidth: "150px",
      render: (_value) => {
        return (
          <div className="!w-[170px] truncate" title={timeArrayFormat(_value)}>
            {timeArrayFormat(_value)}{" "}
          </div>
        );
      },
      headerClassName: "text-xs font-medium",
    },
    {
      // TODO: need to change this to reason
      header: "Reason",
      field: "directions" as keyof OTCMedication,
      minWidth: "250px",
      render: (_value) => (
        <div className="w-[220px]">
          <p className="truncate">{_value}</p>
        </div>
      ),
      headerClassName: "text-xs font-medium",
    },
    {
      header: "MedPass By",
      field: "startdate" as keyof OTCMedication,
      minWidth: "200px",
      render: (_value, data) => {
        const medPassedBy = seniorData?.clinical?.medPass?.services?.find(
          (service) => service?.medicationId === data?.id
        );
        return (
          <ReportedByCell
            id={medPassedBy?.providedBy}
            date={
              dateFormat(data?.startdate) + " " + timeFormat(data?.timings[0])
            }
          />
        );
      },
      headerClassName: "text-xs font-medium",
    },
  ];

  return (
    <div className={`!h-full ${seniorData?.isDeleted ? "cursor-not-allowed opacity-50" : ""}`}>
      <AddOverTheCounterMedication seniorData={seniorData} />

      <BaseTable
        columns={historyColumns}
        data={seniorData?.clinical?.medication?.filter(
          (data) => data?.overTheCounter
        )}
        headerStyles="pt-[5px]"
        cellStyles={(field) =>
          field === "id" ? " justify-end h-full" : "flex h-full"
        }
        tableContainerClass="!w-full bg-white"
      />
    </div>
  );
};
const AddOverTheCounterMedication = ({ seniorData }) => {
  const { mutate } = useUpdate();
  const [isLoading, setIsLoading] = useState(null);
  const dispatch = useAppDispatch();
  const userId = getUserIdFromToken();
  const today = format(new Date(), "yyyy-MM-dd");

  const handleFormSubmit = (formData: any) => {
    setIsLoading(true);
    const { name, startdate, timings, dosage, directions } =
      formData?.medication;
    //TODO: this updated medication is temporary thing, just as test run for updating medication data
    const updateMedication = {
      name,
      startdate,
      timings,
      dosage,
      directions,
      id: uuidv4(),
      overTheCounter: true,
    };
    let formattedData = seniorData?.clinical;
    if (!formattedData?.medication) {
      formattedData = { medication: [] };
    }
    formattedData.medication.push(updateMedication);
    const serviceData = {
      medicationId: updateMedication?.id,
      passOrRefuse: "Pass",
      providedAt: new Date().toISOString(),
      providedBy: userId,
      timing: timings[0],
    };
    if (!formattedData.medPass) {
      formattedData.medPass = { services: [] };
    } else if (!formattedData.medPass.services) {
      formattedData.medPass = { ...formattedData.medPass, services: [] };
    }
    formattedData.medPass.services.push(serviceData);

    const data = {
      ...formattedData,
      userId: seniorData?.userId,
    };
    dispatch(handleCloseOverTheCounterMediactionModal());
    const cleanedOverTheCounterData: any = omit(
      data,
      CLINICAL_USER_PATH_OMIT_FIELDS
    );
    const payload = {
      data: cleanedOverTheCounterData,
      path: ClinicalUserPath,
    };
    mutate(payload, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Medication added!"));
        dispatch(handleCloseOverTheCounterMediactionModal());
        setIsLoading(false);
      },
      onError: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage(`Medication not added!`));
      },
    });
  };
  const schema = "medication";
  const isOverTheCounterMediactionModalOpen = useAppSelector(
    (state: { modal: { isOverTheCounterMediactionModalOpen: boolean } }) =>
      state.modal.isOverTheCounterMediactionModalOpen
  );
  return (
    <CommonModal
      modalOpen={isOverTheCounterMediactionModalOpen}
      setModalOpen={() => dispatch(handleCloseOverTheCounterMediactionModal())}
      crossCTA={true}
      title="Add Medication"
      width="675px"
      titleClass="text-[24px] font-semibold"
    >
      <div className="px-[20px]">
        <Form onSubmit={handleFormSubmit} schema={ClinicalSchema}>
          <div className="flex flex-col gap-6 p-[10px]">
            <div>
              <FormInputFieldComponent
                label={"Name * :"}
                name={`${schema}.name`}
                containerClass={"!flex-row w-full"}
                placeholder="Enter Medication Name"
                className=" !w-[425px] h-[41px]"
                titleClass="!flex !self-center !w-[100px]"
              />
            </div>
            <div>
              <FormInputFieldComponent
                label={"Reason:"}
                name={`${schema}.directions`}
                containerClass={"!flex-row w-full"}
                placeholder="Reason for Medication"
                className="!w-[425px] !h-[41px]"
                titleClass="!flex !self-center !w-[100px]"
              />
            </div>
            <div>
              <FormInputFieldComponent
                label={"Dosage * :"}
                name={`${schema}.dosage`}
                containerClass={"!flex-row w-full"}
                placeholder="Dosage for Medication"
                className="!w-[425px] !h-[41px]"
                titleClass="!flex !self-center !w-[100px]"
              />
            </div>
            <div>
              <FormInputFieldComponent
                label={"Date * :"}
                name={`${schema}.startdate`}
                containerClass={"!flex-row w-full"}
                placeholder="Start Date"
                className="!w-[425px] !h-[41px]"
                type="date"
                max={today}
                titleClass="!flex !self-center !w-[100px]"
              />
            </div>
            <div>
              {/* <FormInputFieldComponent
                            label={"Timings:"}
                            name={`${schema}.timings[0]`}
                            containerClass={"!flex-row w-full"}
                            type="time"
                            placeholder="Shcedule Medication Timings"
                            className="!w-[425px] !h-[41px]"
                            titleClass="!flex !self-center !w-[100px]"
                        /> */}
              <FormMultiSelectComponent
                label="Timings * :"
                name={`${schema}.timings`}
                options={timeOptions24H}
                className="420px"
                containerClass={"!flex !flex-row pt-2"}
                titleClass="!flex !flex-row !w-[100px] mt-2"
                optionsClass="ml-[105px] mt-[40px] w-[420px]"
              />
            </div>
            <div className="py-[10px] flex self-center">
              <Button
                name={"Save"}
                buttonClick={() => { }}
                type="submit"
                isLoading={isLoading}
              />
            </div>
          </div>
        </Form>
      </div>
    </CommonModal>
  );
};
export default OverTheCounter;
