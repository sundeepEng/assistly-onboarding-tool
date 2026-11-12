import type { NextPage } from "next";
import { useRouter } from "next/router";
import { useContext, useEffect, useRef, useState } from "react";
import { ProtectedComponent } from "../components/protectedComponent";
import { RoleContext } from "../components/role-provider";
import PencilIcon from "../public/icons/pencil-icon";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../redux/slices/exception-popover-slice";
import { handleOpenAddMedicationModal } from "../redux/slices/modal-slice";
import useUpdate from "../services/update";
import { Senior } from "../types/senior-types";
import {
  CLINICAL_USER_PATH_OMIT_FIELDS,
  ClinicalUserPath,
  homePath,
  InHomeCare,
  SeniorProfileCardButtons,
  UserPath,
  USER_PATH_OMIT_FIELDS,
} from "../utils/constants";
import { calculateAge, omit, formatAddress } from "../utils/dateUtils";
import { hasAccess } from "../utils/roleAccess";
import { Role } from "../utils/roles";
import Button from "./button";
import CircleComponent from "./circle-component";
import InputFieldComponent from "./input-field-component";
import Avatar from "./avatar";
import { getHomeIdFromToken, getUserRoleFromToken } from "../utils/auth";
import { Edit2 } from 'lucide-react';
import CommonModal from "./common-modal";
import ChangeProfileImage from "../components/changeProfileImage";
import useGetById from "../services/getById";

interface SeniorProfileCardProps {
  seniorData: Senior;
  updateUser?: (user: Senior) => void;
}

const SeniorProfileCard: NextPage<SeniorProfileCardProps> = ({
  seniorData,
  updateUser,
}) => {
  const [canEdit, setCanEdit] = useState(false);
  const [roomResetKey, setRoomResetKey] = useState(0);
  const [statusResetKey, setStatusResetKey] = useState(0);
  const [editingField, setEditingField] = useState<
    "status" | "roomNumber" | "clientRate" | "payRate" | null
  >(null);
  const [status, setStatus] = useState(seniorData?.clinical?.status);
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [initialStatus, setInitialStatus] = useState(
    seniorData?.clinical?.status
  );
  const [roomNumber, setRoomNumber] = useState();
  const [initialRoom, setInitialRoom] = useState(
    seniorData?.clinical?.roomNumber
  );

  // Client rate and pay rate states for independent editing
  const [clientRate, setClientRate] = useState<number | undefined>(
    seniorData?.clientRate
  );
  const [initialClientRate, setInitialClientRate] = useState<number | undefined>(
    seniorData?.clientRate
  );
  const [clientRateResetKey, setClientRateResetKey] = useState(0);
  const [payRate, setPayRate] = useState<number | undefined>(
    seniorData?.payRate
  );
  const [initialPayRate, setInitialPayRate] = useState<number | undefined>(
    seniorData?.payRate
  );
  const [payRateResetKey, setPayRateResetKey] = useState(0);

  const router = useRouter();
  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(contextRole);
  useEffect(() => {
    // Read from cookie only on client
    const cookieRole = getUserRoleFromToken();

    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole, router]);

  // to avoid the state set issues

  const statusInputRef = useRef<HTMLInputElement>(null);
  const roomNumberInputRef = useRef<HTMLInputElement>(null);
  const clientRateInputRef = useRef<HTMLInputElement>(null);
  const payRateInputRef = useRef<HTMLInputElement>(null);

  const isAddMedicationModalOpen = useAppSelector(
    (state: { modal: { isAddMedicationModalOpen: boolean } }) =>
      state.modal.isAddMedicationModalOpen
  );
  const dispatch = useAppDispatch();

  const tabMapping: Record<string, string> = {
    "Add Medication": "Medication",
    "MedPass": "MedPass",
    "Medication List": "Medication",
    "Over-the-Counter": "Over-The-Counter Medication",
    "Care Plan": "Care Plan",
    Profile: "Profile",
    "Incident Report": "Incident Report",
  };

  useEffect(() => {
    setInitialRoom(initialRoom);
    setInitialStatus(initialStatus);
  }, [initialRoom, initialStatus]);

  const handleClick = (data: { label: string }) => {
    if (data?.label === "Add Medication") {
      const activeTabLabel = tabMapping[data?.label] || "Medication";
      router.push(
        `/clinical/${seniorData?.userId}?activeTab=${encodeURIComponent(
          activeTabLabel
        )}`
      );
      if (router.isReady) {
        dispatch(handleOpenAddMedicationModal());
      }
    } else if (data?.label === "Profile" && seniorData?.userId) {
      router.push(`/clinical/biography/${seniorData?.userId}`);
    } else if (data?.label === "Incident Report" && seniorData?.userId) {
      const activeTabLabel = tabMapping[data?.label] || "Medication";
      router.push(
        `/clinical/${seniorData?.userId}?activeTab=${encodeURIComponent(
          activeTabLabel
        )}`
      );
    } else if (seniorData?.userId) {
      const activeTabLabel = tabMapping[data?.label] || "Medication";
      router.push(
        `/clinical/${seniorData?.userId}?activeTab=${encodeURIComponent(
          activeTabLabel
        )}`
      );
    }
    else {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("User Data Not Found"));
    }
  };

  const { mutate } = useUpdate();

  const handleEditStatus = () => {
    setCanEdit(true);
    setEditingField("status");
    setTimeout(() => {
      statusInputRef.current?.focus();
    }, 10);
  };

  const handleEditRoomNumber = () => {
    setCanEdit(true);
    setEditingField("roomNumber");
    setTimeout(() => {
      roomNumberInputRef.current?.focus();
    }, 10);
  };

  // Enable editing for client rate
  const handleEditClientRate = () => {
    setCanEdit(true);
    setEditingField("clientRate");
    setTimeout(() => {
      clientRateInputRef.current?.focus();
    }, 10);
  };

  // Enable editing for pay rate
  const handleEditPayRate = () => {
    setCanEdit(true);
    setEditingField("payRate");
    setTimeout(() => {
      payRateInputRef.current?.focus();
    }, 10);
  };

  const handleCancelEdit = () => {
    setCanEdit(false);
    setEditingField(null);
    if (editingField === "roomNumber") {
      setRoomNumber(initialRoom);
      setRoomResetKey((prevKey) => prevKey + 1);
    } else if (editingField === "status") {
      setStatus(initialStatus);
      setStatusResetKey((prevKey) => prevKey + 1);
    } else if (editingField === "clientRate") {
      setClientRate(initialClientRate);
      setClientRateResetKey((prevKey) => prevKey + 1);
    } else if (editingField === "payRate") {
      setPayRate(initialPayRate);
      setPayRateResetKey((prevKey) => prevKey + 1);
    }
  };

  const handleSaveButton = () => {
    setCanEdit(false);
    if (editingField === "roomNumber") {
      setInitialRoom(roomNumber);
    } else if (editingField === "status") {
      setInitialStatus(status);
    } else if (editingField === "clientRate") {
      setInitialClientRate(clientRate);
    } else if (editingField === "payRate") {
      setInitialPayRate(payRate);
    }

    let updatedData;
    let path = ClinicalUserPath;
    let omitFields = CLINICAL_USER_PATH_OMIT_FIELDS;
    const roomNumberAsNumber = Number(roomNumber);
    const clientRateAsNumber = Number(clientRate);
    const payRateAsNumber = Number(payRate);

    if (editingField === "status") {
      updatedData = {
        ...seniorData?.clinical,
        status: status,
      };
    } else if (editingField === "roomNumber") {
      updatedData = {
        ...seniorData?.clinical,
        roomNumber: roomNumberAsNumber,
      };
    } else if (editingField === "clientRate") {
      // Client rate is a top-level user field, not clinical
      updatedData = {
        ...seniorData,
        clientRate: clientRateAsNumber,
      };
      path = UserPath;
      omitFields = USER_PATH_OMIT_FIELDS;
    } else if (editingField === "payRate") {
      // Pay rate is a top-level user field, not clinical
      updatedData = {
        ...seniorData,
        payRate: payRateAsNumber,
      };
      path = UserPath;
      omitFields = USER_PATH_OMIT_FIELDS;
    } else {
      return;
    }

    const cleanedData: any = omit(updatedData, omitFields);
    const payload = {
      data: cleanedData,
      path: path,
    };

    const fieldLabelMap: Record<string, string> = {
      roomNumber: "Room Number",
      status: "Status",
      clientRate: "Client Rate",
      payRate: "Pay Rate",
    };

    mutate(payload, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(
          handleShowPopoverMessage(
            `${fieldLabelMap[editingField]} Updated Successfully`
          )
        );
      },
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage(
            `${
              error?.response?.data?.error?.[0]?.message ||
              `Error in updating ${fieldLabelMap[editingField]}: ${error?.response?.data?.message}`
            }`
          )
        );
      },
    });
  };

  const handleChangeRoom = (e) => {
    setRoomNumber(e?.target?.value);
  };

  const handleChangeStatus = (e) => {
    setStatus(e?.target?.value);
  };

  // Handle client rate input changes
  const handleChangeClientRate = (e) => {
    const value = e?.target?.value;
    setClientRate(value === "" ? undefined : Number(value));
  };

  // Handle pay rate input changes
  const handleChangePayRate = (e) => {
    const value = e?.target?.value;
    setPayRate(value === "" ? undefined : Number(value));
  };

  const visibleButtons = SeniorProfileCardButtons.filter(
    (data) =>
      hasAccess(role as Role, "CLINICAL_TABS", "EDIT") ||
      hasAccess(role as Role, data.feature, "VIEW") ||
      hasAccess(role as Role, data.feature, "EDIT")
  );

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  // Fetch home data to get homeType

  const homeId = getHomeIdFromToken();
  const { data: homeData } = useGetById({
    key: "home-data",
    payload: { id: homeId, path: homePath, enabled: !!homeId },
  });
  const homeType = homeData?.home?.homeType;
  const isInHomeCare = homeType === InHomeCare;

  return (
    <div className="flex flex-col items-center p-6">
      {/* Profile Section */}
      <div className="flex gap-6">
        <div className="flex flex-col items-center">
          <div className="relative w-[150px] h-[150px]">
            <Avatar
              src={profileImageUrl || seniorData?.profileImageUrl}
              name={seniorData?.name}
              size={150}
              variant="bordered"
              alt="Senior Profile"
            />
            <ProtectedComponent role={role as Role} feature={"CLINICAL_SENIOR_PROFILE_EDIT"} access={"EDIT"} >
            <button
              className="absolute bottom-3 right-1 bg-white h-[30px] w-[30px] rounded-full shadow-lg flex items-center justify-center cursor-pointer"
              onClick={() => setProfileModalOpen(true)}
            >
              <PencilIcon />
            </button>
            </ProtectedComponent>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <CircleComponent data={seniorData} alignHorizontal={true} />
          </div>
        </div>
        <div>
          <div className="flex flex-col flex-1">
            <div className="font-poppins font-normal mb-2 ">
              <span className="font-medium font-poppins pr-2">Name:</span>
              {seniorData?.name}
            </div>
            <div className="font-poppins font-normal mb-2">
              <span className="font-medium font-poppins pr-2">Age:</span>
              {calculateAge(
                seniorData?.biography?.personalDetails?.birthdate
              ) ?? "-"}
            </div>
            {/* Room Number Field */}
            {!isInHomeCare && (
              <div
                className={`flex font-poppins font-normal items-center mb-2 ${seniorData?.isDeleted ? "pointer-events-none opacity-50" : ""
                  }`}
              >
                <InputFieldComponent
                  ref={roomNumberInputRef}
                  label="Room Number:"
                  name="roomNumber"
                  type="number"
                  titleClass="font-medium pr-2 mt-1"
                  containerClass="!flex-row items-center "
                  className={`pl-2 text-[#3089AB] font-medium px-4 py-2 rounded-lg !w-[64px] appearance-none ${canEdit && editingField === "roomNumber"
                    ? "border-[#3089AB] cursor-text"
                    : "border-[#E9E9E9] cursor-not-allowed"
                    }`}
                  inputClass="text-[#3089AB]"
                  value={initialRoom}
                  key={`room-${roomResetKey}`}
                  onChange={(e) => handleChangeRoom(e)}
                  disabled={!(canEdit && editingField === "roomNumber")}
                />

                <ProtectedComponent
                  role={role as Role}
                  feature={"CLINICAL_SENIOR_ROOM_NUMBER"}
                  access={"EDIT"}
                >
                  <div className="flex ml-2">
                    {canEdit && editingField === "roomNumber" ? (
                      <>
                        <Button
                          name="Save"
                          classname="h-[30px] w-[50px] bg-green-500 font-poppins text-white rounded align-center mr-1"
                          buttonClick={handleSaveButton}
                          titleClass="font-normal !text-[16px] justify-center"
                        ></Button>

                        <Button
                          name="Cancel"
                          classname="h-[30px] w-[50px] bg-darkgray-200 font-poppins text-white rounded align-center"
                          buttonClick={handleCancelEdit}
                          titleClass="font-normal !text-[16px] justify-center"
                        ></Button>
                      </>
                    ) : (
                      <button
                        className="bg-transparent cursor-pointer"
                        onClick={handleEditRoomNumber}
                      >
                        <PencilIcon />
                      </button>
                    )}
                  </div>
                </ProtectedComponent>

                </div>
            )}
            
            <div className="font-poppins font-normal mb-2">
              <span className="font-medium font-poppins pr-2">
                Emergency Contact:
              </span>
              {seniorData?.biography?.personalDetails?.emergencyContactName}-
              {seniorData?.biography?.personalDetails?.emergencyContactNumber}
                </div>
                
            {/* Status Field */}
            <div
              className={`flex font-poppins font-normal items-center ${
                seniorData?.isDeleted ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <InputFieldComponent
                ref={statusInputRef}
                label="Status:"
                name="status"
                type="text"
                titleClass="font-medium pr-2 mt-1"
                containerClass="!flex-row items-center"
                className={`pl-2 bg-primary/20 text-primary font-medium rounded-lg cursor-pointer !w-[130px] ${
                  canEdit && editingField === "status"
                    ? "border-primary"
                    : "border-[#E9E9E9] cursor-not-allowed"
                }${
                  status?.toLowerCase()?.includes("house") ||
                  status?.toLowerCase()?.includes("home")
                    ? "bg-primary !text-primary"
                    : "bg-primary bg-opacity-10 text-primary"
                }`}
                inputClass={`font-medium !text-primary`}
                value={initialStatus}
                key={`status-${statusResetKey}`}
                onChange={(e) => handleChangeStatus(e)}
                disabled={!(canEdit && editingField === "status")}
              />
              <div className="flex ml-2">
                {canEdit && editingField === "status" ? (
                 <div className="flex gap-2">
                      <Button
                        name="Save"
                        classname="!h-[30px] !w-[60px]"
                        buttonClick={handleSaveButton}
                      ></Button>

                      <Button
                        name="Cancel"
                        classname="!h-[30px] !w-[60px]"
                        buttonClick={handleCancelEdit}
                      ></Button>
                    </div>
                ) : (
                  <button
                    className="bg-transparent cursor-pointer"
                    onClick={handleEditStatus}
                  >
                    <PencilIcon />
                  </button>
                )}
              </div>
            </div>
            {/* Client Rate and Pay Rate Fields - only for InHomeCare */}
            {isInHomeCare && (
              <div className="flex flex-col gap-2 mt-2">
                {/* Client Rate Field */}
                <ProtectedComponent
                  role={role as Role}
                  feature={"CLIENT_RATE"}
                  access={"EDIT"}
                >
                <div
                  className={`flex font-poppins font-normal items-center ${
                    seniorData?.isDeleted ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  <InputFieldComponent
                    ref={clientRateInputRef}
                    label="Client Rate:"
                    name="clientRate"
                    type="number"
                    titleClass="font-medium pr-2 mt-1"
                    containerClass="!flex-row items-center"
                    className={`pl-2 text-gray-900 font-medium px-4 py-2 rounded-lg !w-[80px] appearance-none bg-gray-50 ${
                      canEdit && editingField === "clientRate"
                        ? "border-[#3089AB] cursor-text"
                        : "border-gray-300 cursor-not-allowed"
                    }`}
                    inputClass="text-gray-900"
                    value={initialClientRate != null ? String(initialClientRate) : ""}
                    key={`clientRate-${clientRateResetKey}`}
                    onChange={(e) => handleChangeClientRate(e)}
                    disabled={!(canEdit && editingField === "clientRate")}
                    placeholder="Rate"
                  />
                  <ProtectedComponent
                    role={role as Role}
                    feature={"CLINICAL_SENIOR_PROFILE_EDIT"}
                    access={"EDIT"}
                  >
                    <div className="flex ml-2">
                      {canEdit && editingField === "clientRate" ? (
                        <div className="flex gap-2">
                          <Button
                            name="Save"
                            classname="!h-[30px] !w-[60px]"
                            buttonClick={handleSaveButton}
                          ></Button>

                          <Button
                            name="Cancel"
                            classname="!h-[30px] !w-[60px]"
                            buttonClick={handleCancelEdit}
                          ></Button>
                        </div>
                      ) : (
                        <button
                          className="bg-transparent cursor-pointer"
                          onClick={handleEditClientRate}
                        >
                          <PencilIcon />
                        </button>
                      )}
                    </div>
                  </ProtectedComponent>
                </div>
                </ProtectedComponent>

                {/* Pay Rate Field */}
                <div
                  className={`flex font-poppins font-normal items-center ${
                    seniorData?.isDeleted ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  <InputFieldComponent
                    ref={payRateInputRef}
                    label="Pay Rate:"
                    name="payRate"
                    type="number"
                    titleClass="font-medium pr-2 mt-1"
                    containerClass="!flex-row items-center"
                    className={`pl-2 text-gray-900 font-medium px-4 py-2 rounded-lg !w-[80px] appearance-none bg-gray-50 ${
                      canEdit && editingField === "payRate"
                        ? "border-[#3089AB] cursor-text"
                        : "border-gray-300 cursor-not-allowed"
                    }`}
                    inputClass="text-gray-900"
                    value={initialPayRate != null ? String(initialPayRate) : ""}
                    key={`payRate-${payRateResetKey}`}
                    onChange={(e) => handleChangePayRate(e)}
                    disabled={!(canEdit && editingField === "payRate")}
                    placeholder="Rate"
                  />
                  <ProtectedComponent
                    role={role as Role}
                    feature={"CLINICAL_SENIOR_PROFILE_EDIT"}
                    access={"EDIT"}
                  >
                    <div className="flex ml-2">
                      {canEdit && editingField === "payRate" ? (
                        <div className="flex gap-2">
                          <Button
                            name="Save"
                            classname="!h-[30px] !w-[60px]"
                            buttonClick={handleSaveButton}
                          ></Button>

                          <Button
                            name="Cancel"
                            classname="!h-[30px] !w-[60px]"
                            buttonClick={handleCancelEdit}
                          ></Button>
                        </div>
                      ) : (
                        <button
                          className="bg-transparent cursor-pointer"
                          onClick={handleEditPayRate}
                        >
                          <PencilIcon />
                        </button>
                      )}
                    </div>
                  </ProtectedComponent>
                </div>
              </div>
            )}

            {/* Address and phone number */}
            {isInHomeCare && (
              <div>
                <div className="font-poppins font-normal w-[320px] pt-2">
                  <span className="font-medium font-poppins pr-2">Mobile:</span>
                  {seniorData?.mobile || "—"}
                </div>
                <div className="font-poppins font-normal w-[320px] pt-2">
                  <span className="font-medium font-poppins pr-2">Address:</span>
                  {formatAddress(seniorData?.biography?.personalDetails?.address)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Buttons Section */}
      <div className="flex flex-wrap justify-center gap-4 mt-6">
        {visibleButtons?.map((data, index) => (
          <Button
            key={index}
            classname={`w-[259px] h-[49px] ${
              (data?.feature === "CLINICAL_ADD" ||
                data?.feature === "CLINICAL_CAREPLAN" ||
                data?.feature === "CRM_BIOGRAPHY") &&
              seniorData?.isDeleted
                ? "pointer-events-none !cursor-not-allowed opacity-50"
                : ""
            }`}
            name={data?.label}
            buttonClick={() => handleClick(data)}
          />
        ))}
      </div>
      <CommonModal
        modalOpen={profileModalOpen}
        setModalOpen={() => {
          setProfileModalOpen(false);
        }}
        crossCTA={true}
        className="w-[400px] h-[400px] overflow-y-auto"
        // paddingRight="0px"
      >
        <ChangeProfileImage
          userData={seniorData}
          setModalClose={setProfileModalOpen}
          setProfileImageUrl={setProfileImageUrl}
        />
      </CommonModal>
    </div>
  );
};

export default SeniorProfileCard;
