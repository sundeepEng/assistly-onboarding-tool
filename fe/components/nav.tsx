'use client'
import Cookies from "js-cookie";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import { useContext, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import Button from "../commonComponents/button";
import Form from "../commonComponents/form";
import FormInputFieldComponent from "../commonComponents/form-input-field-component";
import FormInputCheckboxComponent from "../commonComponents/form-input-checkbox-component";
import CommonModal from "../commonComponents/common-modal";
import PopoverComponent from "../commonComponents/popover-component";
import FormTextareaComponent from "../commonComponents/form-textarea-component";
import { updatePasswordSchema } from "../model/crm/user.model";
import { SupportRequestSchema } from "../model/support/support.model";
import { z } from "zod";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../redux/slices/exception-popover-slice";
import {
  handleCloseAddGuestModal,
  handleCloseAddLeadModal,
  handleCloseAddNurseModal,
  handleCloseAddPCGModal,
  handleCloseAddReferralModal,
  handleCloseEditReferralModal,
  handleCloseProfileModal,
  handleCloseAddSalesMemberModal,
  handleOpenAddGuestModal,
  handleOpenAddLeadModal,
  handleOpenAddNurseModal,
  handleOpenAddPCGModal,
  handleOpenAddReferralModal,
  handleOpenProfileModal,
  handleOpenSupportModal,
  handleCloseSupportModal,
} from "../redux/slices/modal-slice";
import useGetById, { fetchById } from "../services/getById";
import useUpdatePassword, {
  UpdatePasswordDataType,
} from "../services/update-user-password";
import {
  getHomeIdFromToken,
  getUserIdFromToken,
  getUserRoleFromToken,
  useCookieListener,
  setIsSalesRequiredInCookie,
  getIsSalesRequiredFromCookie,
} from "../utils/auth";
import {
  ACCESS_TOKEN,
  createSupportRequestPath,
  ID_TOKEN,
  REFERRAL_AGENT,
  stripeAccountCreationPath,
  updatePasswordPath,
  USER_ID,
  UserPath,
  userRoles,
  homePath,
  salesDashboardPath,
} from "../utils/constants";
import { Role } from "../utils/roles";
import { AddLeadFormWrapper } from "./add-lead";
import AddPCG from "./pcg/add-pcg";
import AddNurse from "./nurse/add-nurse";
import { ProtectedComponent } from "./protectedComponent";
import AddReferral from "./referral/add-referral";
import { RoleContext } from "./role-provider";
import ProfileDashboard from "./profile/profile-dashboard";
import { handleSetProfileActiveTab } from "../redux/slices/tab-slice";
import _ from "lodash";
import AddComplianceGuest from "./compliance/add-compliance-guest";
import AddSalesMember from "./sales/add-sales-member";
import DropdownArrow from "../public/icons/dropdown-arrow";
import { TailSpin } from "react-loader-spinner";
import { CreditCard } from "lucide-react";
import useCreate from "../services/create";
import { useQueryClient } from "@tanstack/react-query";
import { hasAccess } from "../utils/roleAccess";
import Avatar from "../commonComponents/avatar";

export type NavType = {
  className?: string;
  userData?: any; // Add userData prop
};

const Nav: NextPage<NavType> = ({ className = "" }) => {
  const contextRole = useContext(RoleContext)?.role;
  const [role, setRole] = useState<string | undefined>(contextRole);
  useEffect(() => {
    const cookieRole = getUserRoleFromToken();
    const finalRole = contextRole || cookieRole;
    setRole(finalRole);
  }, [contextRole]);

  const [addNewRolePopoverOpen, setAddNewRolePopoverOpen] = useState(false);
  const [switchMultiHomePopoverOpen, setSwitchMultiHomePopoverOpen] =
    useState(false);
  const isAddLeadModalOpen = useAppSelector(
    (state: { modal: { isAddLeadModalOpen: boolean } }) =>
      state.modal.isAddLeadModalOpen
  );
  const isAddReferralModalOpen = useAppSelector(
    (state: { modal: { isAddReferralModalOpen: boolean } }) =>
      state.modal.isAddReferralModalOpen
  );
  // Select edit referral modal state from Redux store
  const isEditReferralModalOpen = useAppSelector(
    (state: { modal: { isEditReferralModalOpen: boolean } }) =>
      state.modal.isEditReferralModalOpen
  );
  // Select referral data for pre-filling edit form
  const editReferralData = useAppSelector(
    (state: { modal: { editReferralData: any } }) =>
      state.modal.editReferralData
  );
  const isAddPCGModalOpen = useAppSelector(
    (state: { modal: { isAddPCGModalOpen: boolean } }) =>
      state.modal.isAddPCGModalOpen
  );
  const isAddNurseModalOpen = useAppSelector(
    (state: { modal: { isAddNurseModalOpen: boolean } }) =>
      state.modal.isAddNurseModalOpen
  );
  const isProfileModalOpen = useAppSelector(
    (state: { modal: { isProfileModalOpen: boolean } }) =>
      state.modal.isProfileModalOpen
  );
  const isAddComplianceGuestModalOpen = useAppSelector(
    (state: { modal: { isAddComplianceModalOpen: boolean } }) =>
      state.modal.isAddComplianceModalOpen
  );
  const isAddSalesMemberModalOpen = useAppSelector(
    (state: { modal: { isAddSalesMemberModalOpen: boolean } }) =>
      state.modal.isAddSalesMemberModalOpen
  );
  const router = useRouter();
  const dispatch = useAppDispatch();

  const hadSessionRef = useRef(false);
  const isValidSession = useCookieListener([ID_TOKEN, ACCESS_TOKEN, USER_ID]);

  useEffect(() => {
    hadSessionRef.current = Boolean(
      Cookies.get(ID_TOKEN) || Cookies.get(ACCESS_TOKEN) || Cookies.get(USER_ID),
    );
  }, []);

  useEffect(() => {
    if (isValidSession) {
      hadSessionRef.current = true;
    }
  }, [isValidSession]);

  useEffect(() => {
    if (!isValidSession && !router.pathname.includes("/login")) {
      router.push("/login");

      if (hadSessionRef.current) {
        dispatch(handleOpenPopover());
        dispatch(
          handleShowPopoverMessage(
            "Your session has expired. Please log in again."
          )
        );
      }
    }
  }, [isValidSession, router.pathname, dispatch, router]);

  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    setUser(getUserIdFromToken());
  }, []);

  const { data: userData, isLoading } = useGetById({
    key: "user",
    payload: { path: UserPath, id: user, enabled: isValidSession && !!user },
  });

  const defaultHomeName = userData?.home || "Switch Home";

  // State to store currently selected home
  const [selectedHome, setSelectedHome] = useState(defaultHomeName);

  useEffect(() => {
    const cookieHomeId = getHomeIdFromToken();

    if (cookieHomeId && userData?.associatedHomes) {
      const allHomes = [
        { homeId: userData?.homeId, home: userData?.home },
        ...userData?.associatedHomes,
      ];
      const foundHome = allHomes.find((h) => h.homeId === cookieHomeId);
      if (foundHome) {
        setSelectedHome(foundHome.home);
        return;
      }
    }

    // fallback
    if (defaultHomeName) {
      setSelectedHome(defaultHomeName);
    }
  }, [defaultHomeName, userData]);

  const isSupportModalOpen = useAppSelector(
    (state: { modal: { isSupportModalOpen: boolean } }) =>
      state.modal.isSupportModalOpen,
  );
  const [stripeModalOpen, setStripeModalOpen] = useState(false);
  const [open, setOpen] = useState(false);

  const [supportFiles, setSupportFiles] = useState<File[]>([]);
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const { mutate: createSupportMutate } = useCreate();

  const subPath = router?.pathname?.split("/");
  const path = router.pathname;
  const isTopLevelOrStatic = !path.includes("[");

  return (
    <div
      className={`flex flex-row items-center justify-start gap-4 text-left text-base text-darkgray-200 font-poppins ${className}`}
    >
      {/* TODO: Search functionality placeholder */}
      {/* <div className="h-[44.4px] w-[200px] relative">
                <div className="absolute top-[0px] left-[0px] w-[200px] h-[44.4px]">
                    Search functionality placeholder
                </div>
            </div> */}

      {/* <ProtectedComponent
        role={role as Role}
        feature="CRM_ADDNEW"
        access="EDIT"
      >
        <PopoverComponent
          body={
            <NewRoleItemPopoverBody setPopoverOpen={setAddNewRolePopoverOpen} />
          }
          isOpen={addNewRolePopoverOpen}
          setIsOpen={setAddNewRolePopoverOpen}
        >
          {subPath[1] === "crm" && (
            <div className="flex items-center justify-center cursor-pointer">
              <div className="h-[44.4px] w-auto rounded-lg bg-transparent flex items-center justify-between px-4 gap-2 hover:bg-white/10 transition-colors cursor-pointer">
                <span className="text-white font-medium text-[20px] font-Jakarta">
                  Add New
                </span>
                <DropdownArrow isOpen={addNewRolePopoverOpen} />
              </div>
            </div>
          )}
        </PopoverComponent>
      </ProtectedComponent> */}
      {/* Switch homes */}
      {isTopLevelOrStatic && userData?.associatedHomes && userData?.homeId && (
        <PopoverComponent
          body={
            <MultiHomeDropPopoverBody
              homes={[
                { homeId: userData?.homeId, home: userData?.home }, // default
                ...(userData?.associatedHomes || []), // additional
              ]}
              onSelect={async (home: any) => {
                setSelectedHome(home.home);
                Cookies.set("homeId", home.homeId);

                // Fetch home data and store isSalesRequired in cookie when switching homes
                try {
                  const homeData = await fetchById({ id: home.homeId, path: homePath });
                  const isSalesRequired = homeData?.home?.isSalesRequired ?? false;
                  setIsSalesRequiredInCookie(isSalesRequired);

                  // If currently on sales dashboard but new home doesn't have sales required, redirect to CRM
                  if (router.pathname === salesDashboardPath && !isSalesRequired) {
                    router.push("/crm");
                  } else {
                    router.reload();
                  }
                } catch (error) {
                  console.error("Error fetching home data:", error);
                  router.reload();
                }
              }}
            />
          }
          isOpen={switchMultiHomePopoverOpen}
          setIsOpen={setSwitchMultiHomePopoverOpen}
        >
          <div className="flex flex-row items-center justify-center cursor-pointer">
            <div className="h-[44.4px] w-auto rounded-lg px-3 flex items-center justify-between cursor-pointer bg-transparent hover:bg-white/10 transition-colors gap-2">
              <span
                className="text-white font-medium text-[20px] font-Jakarta truncate"
                title={_.startCase(_.toLower(selectedHome))}
              >
                {selectedHome?.length > 12
                  ? `${_.startCase(_.toLower(selectedHome)).substring(
                    0,
                    12
                  )}...`
                  : _.startCase(_.toLower(selectedHome))}
              </span>
              <DropdownArrow isOpen={switchMultiHomePopoverOpen} />
            </div>
          </div>
        </PopoverComponent>
      )}

      <PopoverComponent
        body={
          <PopoverBody
            openSupportModal={() => dispatch(handleOpenSupportModal())}
            setStripeModal={setStripeModalOpen}
          />
        }
        isOpen={open}
        setIsOpen={setOpen}
      >
        {isLoading ? (
          <div className="w-[50px] h-[57px] flex items-center justify-center bg-gray-200 rounded-full">
            <div className="w-8 h-8 border-4 border-t-transparent border-[#9C9999] border-solid rounded-full animate-spin"></div>
          </div>
        ) : (
          <Avatar src={userData?.profileImageUrl} name={userData?.name} size={40} variant="solid" alt="Profile" className="cursor-pointer" />
        )}
      </PopoverComponent>
      {/* Add Lead Modal */}
      {isAddLeadModalOpen && (
        <CommonModal
          title="Add Senior Lead"
          modalOpen={isAddLeadModalOpen}
          setModalOpen={() => dispatch(handleCloseAddLeadModal())}
          crossCTA={true}
          className="!min-w-[400px]"
        >
          <div className="px-[20px]">
            <AddLeadFormWrapper />
          </div>
        </CommonModal>
      )}
      {/* Add Referral Modal */}
      {isAddReferralModalOpen && (
        <CommonModal
          title="Add Referral Agent"
          modalOpen={isAddReferralModalOpen}
          setModalOpen={() => dispatch(handleCloseAddReferralModal())}
          crossCTA={true}
        >
          <div className={`flex w-full max-h-[85vh] overflow-y-auto overflow-x-auto justify-center px-[20px]`}>
            <AddReferral />
          </div>
        </CommonModal>
      )}
      {/* Edit Referral Modal */}
      {isEditReferralModalOpen && (
        <CommonModal
          title="Edit Referral Agent"
          modalOpen={isEditReferralModalOpen}
          setModalOpen={() => dispatch(handleCloseEditReferralModal())}
          crossCTA={true}
        >
          <div className={`flex w-full max-h-[85vh] overflow-y-auto overflow-x-auto justify-center px-[20px]`}>
            <AddReferral initialData={editReferralData} isEdit={true} />
          </div>
        </CommonModal>
      )}
      {/* Add PCG Modal */}
      {isAddPCGModalOpen && (
        <CommonModal
          title="Add Care Lead"
          modalOpen={isAddPCGModalOpen}
          setModalOpen={() => dispatch(handleCloseAddPCGModal())}
          crossCTA={true}
        >
          <div className="px-[20px]">
            <AddPCG />
          </div>
        </CommonModal>
      )}

      {/* Add Nurse Modal */}
      {isAddNurseModalOpen && (
        <CommonModal
          title="Add Nurse Lead"
          modalOpen={isAddNurseModalOpen}
          setModalOpen={() => dispatch(handleCloseAddNurseModal())}
          crossCTA={true}
        >
          <div className="px-[20px]">
            <AddNurse />
          </div>
        </CommonModal>
      )}
      {isAddComplianceGuestModalOpen && (
        <CommonModal
          modalOpen={isAddComplianceGuestModalOpen}
          title="Add Compliance Guest"
          setModalOpen={() => dispatch(handleCloseAddGuestModal())}
          crossCTA={true}
        >
          <div className="px-[20px]">
            <AddComplianceGuest />
          </div>
        </CommonModal>
      )}
      {/* Add Sales Team Member Modal */}
      {isAddSalesMemberModalOpen && (
        <CommonModal
          title="Add Sales Team Member"
          modalOpen={isAddSalesMemberModalOpen}
          setModalOpen={() => dispatch(handleCloseAddSalesMemberModal())}
          crossCTA={true}
        >
          <div className="px-[20px]">
            <AddSalesMember />
          </div>
        </CommonModal>
      )}
      {/* Profile Modal */}
      {isProfileModalOpen && (
        <CommonModal
          modalOpen={isProfileModalOpen}
          setModalOpen={() => {
            dispatch(handleCloseProfileModal());
            dispatch(handleSetProfileActiveTab("Personal Details"));
          }}
          crossCTA={true}
          className="h-[700px] overflow-y-auto"
        // paddingRight="0px"
        >
          <ProfileDashboard userData={userData} />
        </CommonModal>
      )}

      {isSupportModalOpen && (
        <CommonModal
          title="Support"
          modalOpen={isSupportModalOpen}
          setModalOpen={() => dispatch(handleCloseSupportModal())}
          crossCTA={true}
          width="600px"
        >
          <SupportTicketForm
            userDataToSend={userData}
            supportFiles={supportFiles}
            setSupportFiles={setSupportFiles}
            isSubmitting={supportSubmitting}
            setIsSubmitting={setSupportSubmitting}
            createSupportMutate={createSupportMutate}
            closeModal={() => dispatch(handleCloseSupportModal())}
          />
        </CommonModal>
      )}

      {stripeModalOpen && (
        <CommonModal
          title="Connect Stripe"
          modalOpen={stripeModalOpen}
          setModalOpen={setStripeModalOpen}
          crossCTA={true}
          width="520px"
        >
          <StripeConnectForm closeModal={() => setStripeModalOpen(false)} userData={userData} />
        </CommonModal>
      )}
    </div>
  );
};

const PopoverBody = ({
  openSupportModal,
  setStripeModal,
}: {
  openSupportModal: () => void;
  setStripeModal: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const router = useRouter();
  const dispatch = useDispatch();
  const { setRole, role: contextRole } = useContext(RoleContext)!;
  const currentRole = contextRole || getUserRoleFromToken();
  const [confirmationMaodal, setConfirmationModal] = useState(false)
  const [openModal, setModalOpen] = useState(false)

  const handleOptionClick = (option: string) => {
    if (option === "Logout") {
      Cookies.remove("idToken");
      Cookies.remove("accessToken");
      Cookies.remove("userId");
      Cookies.remove("role");
      Cookies.remove("homeId");
      Cookies.remove("isSalesRequired");
      setRole(null); // now valid
      router.push("/login");
      dispatch(handleOpenPopover());
      dispatch(handleShowPopoverMessage("Logging out!"));
    } else if (option === "Profile") {
      dispatch(handleOpenProfileModal());
    } else if (option === "Support") {
      openSupportModal();
    }
  };

  return (
    <div className={currentRole && hasAccess(currentRole as Role, "CONNECT_STRIPE", "EDIT") ? "w-[260px]" : "w-[100px]"}>

      <div
        className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
        onClick={() => handleOptionClick("Profile")}
      >
        Profile
      </div>
      <div
        className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
        onClick={() => handleOptionClick("Support")}
      >
        Support
      </div>
      <div
        className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
        onClick={() => { setConfirmationModal(true), setModalOpen(true) }}
      >
        Logout
      </div>
      {confirmationMaodal && <ConfirmationModal handleOptionClick={handleOptionClick} setModalOpen={setModalOpen} openModal={openModal} />}

      <ProtectedComponent role={currentRole as Role} feature={"CONNECT_STRIPE"} access={"EDIT"}>
        <div className="mt-2 pt-2 border-t border-solid border-[#E5E7EB]">
          <div className="p-3 rounded-md border border-solid border-[#E5E7EB] bg-white">
            <div className="flex items-start gap-3">
              <div className="mt-[2px] text-primary">
                <CreditCard size={18} />
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-poppins font-[500] text-black">
                  Connect Stripe
                </div>
                <div className="text-[12px] text-[#6B7280] leading-[16px] mt-1">
                  Accept payments & manage payouts securely
                </div>
                <div className="mt-3">
                  <Button
                    name="Connect with Stripe"
                    buttonClick={() => setStripeModal(true)}
                    classname="bg-primary text-white w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </ProtectedComponent>
    </div>
  );
};

const StripeConnectSchema = z
  .object({
    consent: z.boolean().refine((v) => v, { message: "Consent is required" }),
  })
  .strict();

const fileToBase64 = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read file"));
        return;
      }

      // result is a data URL like: data:image/png;base64,AAA...
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

const SupportTicketForm = ({
  userDataToSend,
  supportFiles,
  setSupportFiles,
  isSubmitting,
  setIsSubmitting,
  createSupportMutate,
  closeModal,
}: {
  userDataToSend: any;
  supportFiles: File[];
  setSupportFiles: React.Dispatch<React.SetStateAction<File[]>>;
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  createSupportMutate: any;
  closeModal: () => void;
}) => {
  const dispatch = useAppDispatch();

  const onSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);

      const attachments = supportFiles.length
        ? await Promise.all(
          supportFiles.map(async (f) => ({
            filename: f.name,
            contentType: f.type || "application/octet-stream",
            data: await fileToBase64(f),
          })),
        )
        : undefined;

      const payload = {
        userEmail: userDataToSend?.email,
        subject: data?.subject,
        body: data?.body,
        ...(attachments ? { attachments } : {}),
      };
      const datatopost = {
        userData: payload,
        path: createSupportRequestPath
      }
      const parsed = SupportRequestSchema.safeParse(payload);
      if (!parsed.success) {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage(parsed.error.errors?.[0]?.message));
        setIsSubmitting(false);
        return;
      }

      createSupportMutate(
        datatopost,
        {
          onSuccess: () => {
            dispatch(handleOpenPopover());
            dispatch(handleShowPopoverMessage("Support request submitted!"));
            setSupportFiles([]);
            setIsSubmitting(false);
            closeModal();
          },
          onError: (error: any) => {
            const errMsg =
              typeof error?.response?.data?.error === "string"
                ? error.response.data.error
                : "Failed to submit support request";
            dispatch(handleOpenPopover());
            dispatch(handleShowCloseOptions());
            dispatch(handleShowPopoverMessage(errMsg));
            setIsSubmitting(false);
          },
        },
      );
    } catch (e: any) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage(e?.message ?? "Failed to submit"));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-[20px] w-full">
      <Form
        schema={SupportRequestSchema.omit({ userEmail: true, attachments: true })}
        onSubmit={onSubmit}
        defaultValues={{
          subject: "",
          body: "",
        }}
      >
        <div className="flex flex-col gap-3 w-full">
          <FormInputFieldComponent
            label={"Subject *"}
            className="w-full"
            SubcontainerClass="!max-w-full"
            placeholder="Subject"
            name={"subject"}
          />

          <FormTextareaComponent
            label={"Description *"}
            placeholder="Describe what happened, what you expected, and steps to reproduce if applicable"
            name={"body"}
            onChange={() => { }}
            className="!max-w-full"
          />

          <div className="w-full">
            <div className="text-base font-poppins mb-[5px]">Attachments</div>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                if (!files.length) return;

                // Calculate total size of existing files + new files
                const existingSize = supportFiles.reduce((total, file) => total + file.size, 0);
                const newFilesSize = files.reduce((total, file) => total + file.size, 0);
                const totalSize = existingSize + newFilesSize;

                // Check if total size exceeds 10MB (10 * 1024 * 1024 bytes)
                const maxSize = 10 * 1024 * 1024; // 10MB
                if (totalSize > maxSize) {
                  dispatch(handleOpenPopover());
                  dispatch(handleShowCloseOptions());
                  dispatch(
                    handleShowPopoverMessage(
                      `Total file size cannot exceed 10MB. Current total: ${(totalSize / (1024 * 1024)).toFixed(2)}MB`
                    )
                  );
                  e.currentTarget.value = "";
                  return;
                }

                setSupportFiles((prev) => [...prev, ...files]);
                e.currentTarget.value = "";
              }}
              className="w-full"
            />

            {/* File size indicator */}
            {supportFiles.length > 0 && (
              <div className="mt-[5px] text-sm text-gray-600">
                Total size: {(supportFiles.reduce((total, file) => total + file.size, 0) / (1024 * 1024)).toFixed(2)}MB / 10MB
              </div>
            )}

            {supportFiles.length > 0 && (
              <div className="mt-[10px] flex flex-col gap-2">
                {supportFiles.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="flex items-center justify-between border border-solid border-[#E5E7EB] rounded-md px-3 py-2"
                  >
                    <div
                      className="truncate pr-2 text-primary cursor-pointer"
                      onClick={() => {
                        const url = URL.createObjectURL(f);
                        window.open(url, "_blank", "noopener,noreferrer");
                        setTimeout(() => URL.revokeObjectURL(url), 60_000);
                      }}
                      title={f.name}
                    >
                      {f.name}
                    </div>
                    <div
                      className="text-primary cursor-pointer"
                      onClick={() =>
                        setSupportFiles((prev) =>
                          prev.filter((_, i) => i !== idx),
                        )
                      }
                    >
                      Remove
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-center pt-[20px]">
            <Button
              name="Submit"
              buttonClick={() => { }}
              isLoading={isSubmitting}
              classname="bg-primary text-white w-full"
              type="submit"
            />
          </div>
        </div>
      </Form>
    </div>
  );
};

const StripeConnectForm = ({
  closeModal,
  userData,
}: {
  closeModal: () => void;
  userData: any;
}) => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const { mutate, isPending } = useCreate();

  const onSubmit = async (data: any) => {
    if (!userData?.email) {
      dispatch(handleOpenPopover());
      dispatch(
        handleShowPopoverMessage(
          "Email is required to connect Stripe. Please add an email and try again.",
        ),
      );
      dispatch(handleShowCloseOptions());
      return;
    }

    const payload = {
      path: stripeAccountCreationPath,
      userData: { email: userData?.email, consent: data?.consent },
    };

    mutate(payload, {
      onSuccess: (response: any) => {
        queryClient.invalidateQueries({ queryKey: ["user"] });

        dispatch(handleOpenPopover());
        dispatch(
          handleShowPopoverMessage(
            "Stripe connection submitted. Please check your email to continue Stripe onboarding.",
          ),
        );

        closeModal();
      },
      onError: (error: any) => {
        const statusCode = error?.response?.status;

        const alreadyExistsMsg =
          typeof error?.response?.data?.message === "string"
            ? error.response.data.message
            : "Stripe account already exists for this user";

        const errMsg =
          statusCode === 409
            ? alreadyExistsMsg
            : "Stripe connection failed. Please try again.";
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage(errMsg));
        dispatch(handleShowCloseOptions());
      },
    });
  };

  return (
    <div className="px-[20px] w-full">
      <Form
        schema={StripeConnectSchema}
        onSubmit={onSubmit}
        defaultValues={{
          consent: false,
        }}
      >
        <div className="flex flex-col gap-3 w-full">
          <div className="rounded-md border border-gray-200 bg-white p-4 text-[16px] font-[400] leading-[24px] text-gray-700">
            <p className="text-[16px] font-[600] leading-[24px] text-gray-900">
              Stripe Payout Account Setup
            </p>
            <p className="mt-2">
              To receive payouts through our platform, you must create a Stripe account.
            </p>
            <p className="mt-2">
              By clicking <span className="font-medium">Create</span>, you authorize us to securely share your name and
              email address with Stripe for the purpose of setting up and managing your payout account.
            </p>
            <p className="mt-2">
              Stripe will process your information in accordance with its{" "}
              <a
                href="https://stripe.com/privacy"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline"
              >
                Privacy Policy
              </a>{" "}
              and{" "}
              <a
                href="https://stripe.com/legal"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline"
              >
                Terms of Service
              </a>
              .
            </p>
            <p className="mt-2">
              You are responsible for providing accurate information and complying with Stripe’s verification
              requirements.
            </p>
          </div>

          <div className="pt-2">
            <FormInputCheckboxComponent
              name="consent"
              label="I consent to the sharing of my information with Stripe for the purpose of creating and managing my payout account."
              initialChecked={false}
            />
          </div>

          <div className="flex justify-end gap-3 pt-[20px]">
            <Button
              name="Cancel"
              buttonClick={closeModal}
              classname="bg-gray-300 text-black"
              titleClass="!text-[14px]"
              type="button"
              disabled={isPending}
            />
            <Button
              name="Create"
              buttonClick={() => { }}
              classname="bg-primary text-white"
              titleClass="!text-[14px]"
              type="submit"
              isLoading={isPending}
              disabled={isPending}
            />
          </div>
        </div>
      </Form>
    </div>
  );
};

export const ChangePassword = ({
  setChangePasswordModal,
}: {
  setChangePasswordModal?: React.Dispatch<React.SetStateAction<boolean>>;
  dispatch?: any;
}) => {
  const { mutate } = useUpdatePassword();
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(null);

  const onSubmit = (data: any) => {
    const { oldPassword, newPassword, reEnterNewPassword } = data;
    if (newPassword !== reEnterNewPassword) {
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(handleShowPopoverMessage("Passwords does not match!"));
      return;
    } else if (oldPassword === newPassword) {
      setIsLoading(false);
      dispatch(handleOpenPopover());
      dispatch(handleShowCloseOptions());
      dispatch(
        handleShowPopoverMessage(
          "New password cannot be the same as old password!"
        )
      );
      return;
    }
    const accessToken = Cookies.get("accessToken");
    setIsLoading(true);
    const payload = {
      body: {
        accessToken: accessToken,
        oldPassword: oldPassword,
        newPassword: newPassword,
      },
      path: updatePasswordPath,
      type: "UPDATE_PASSWORD",
    };
    if (accessToken) {
      mutate(payload as UpdatePasswordDataType, {
        onSuccess: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("Password updated Successfully!"));
          setIsLoading(false);
        },
        onError: (error: any) => {
          setIsLoading(false);
          const errMsg =
            typeof error?.response?.data?.error === "string"
              ? error.response.data.error
              : "Failed to update Password";

          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage(errMsg));
          dispatch(handleShowCloseOptions());
        },
      });
    }
  };
  return (
    <Form onSubmit={onSubmit} schema={updatePasswordSchema}>
      <div className="flex flex-col items-center justify-center p-[10px] gap-4">
        <FormInputFieldComponent
          label={"Old Password"}
          placeholder={"********"}
          name={"oldPassword"}
          className="!w-[359px] h-[40px]"
          passwordVisibility={true}
        />
        <FormInputFieldComponent
          label={"New Password"}
          placeholder={"********"}
          name={"newPassword"}
          className="!w-[359px] h-[40px]"
          passwordVisibility={true}
        />
        <FormInputFieldComponent
          label={"Re-enter New Password"}
          placeholder={"********"}
          name={"reEnterNewPassword"}
          className="!w-[359px] h-[40px]"
          passwordVisibility={true}
        />
        <div className="flex justify-center pt-[20px]">
          <Button name="Save" buttonClick={() => { }} isLoading={isLoading} />
        </div>
      </div>
    </Form>
  );
};

const NewRoleItemPopoverBody = ({
  setPopoverOpen,
}: {
  setPopoverOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const dispatch = useAppDispatch();

  const handleOptionClick = (option: string) => {
    const actionMap: Record<string, Function> = {
      [userRoles.LEAD]: handleOpenAddLeadModal,
      [REFERRAL_AGENT]: handleOpenAddReferralModal,
      [userRoles.PCG]: handleOpenAddPCGModal,
      [userRoles.COMPLIANCE_GUEST]: handleOpenAddGuestModal,
    };
    if (actionMap[option]) {
      dispatch(actionMap[option]());
    }
    setPopoverOpen(false);
  };
  return (
    <div className="w-[160px] z-10">
      <div
        className="p-[5px]  cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
        onClick={() => handleOptionClick(userRoles.LEAD)}
      >
        {userRoles.LEAD}
      </div>
      <div
        className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
        onClick={() => handleOptionClick(REFERRAL_AGENT)}
      >
        {REFERRAL_AGENT}
      </div>
      <div
        className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
        onClick={() => handleOptionClick(userRoles.PCG)}
      >
        {userRoles.PCG} Lead
      </div>
      <div
        className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
        onClick={() => handleOptionClick(userRoles.COMPLIANCE_GUEST)}
      >
        {userRoles.COMPLIANCE_GUEST}
      </div>
    </div>
  );
};

// Updated MultiHomeDropPopoverBody to accept dynamic homes
const MultiHomeDropPopoverBody = ({
  homes,
  onSelect,
}: {
  homes: Array<{ homeId: string; home: string }>;
  onSelect: (home: { homeId: string; home: string }) => void;
}) => {
  homes = _.sortBy(homes, (h) => h.home.toLowerCase());
  return (
    <div className="w-[160px] z-10">
      {homes?.map((home) => (
        <div
          key={home.homeId}
          className="p-[5px] cursor-pointer hover:bg-lightgray font-poppins hover:rounded-md"
          onClick={() => onSelect(home)}
        >
          {_.startCase(_.toLower(home.home))}
        </div>
      ))}
    </div>
  );
};

const ConfirmationModal = ({
  handleOptionClick,
  setModalOpen,
  openModal,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  return (
    <CommonModal
      title={"Logout"}
      modalOpen={openModal}
      setModalOpen={setModalOpen}
      crossCTA={true}
    >
      <div className="font-poppins min-w-[450px] px-[20px] bg-[transparent]">
        <div className="mb-4">
          <div className="text-sm text-gray-700 mb-4">
            Are you sure you want to logout ?
          </div>
        </div>
        {isLoading ? (
          <div className="flex justify-center items-center py-4">
            <TailSpin
              height={50}
              width={50}
              color="#6B7280"
              strokeWidth="4px"
            />
          </div>
        ) : (
          <div className="flex justify-center gap-6">
            <Button
              name="Confirm"
              classname="bg-green-500 text-white"
              titleClass="!text-[14px]"
              buttonClick={() => { handleOptionClick("Logout"), setIsLoading(true) }}
            />
            <Button
              name="Cancel"
              classname="bg-gray-300 text-black"
              titleClass="!text-[14px]"
              buttonClick={() => setModalOpen(false)}
            />
          </div>
        )}
      </div>
    </CommonModal>
  );
};

export default Nav;
