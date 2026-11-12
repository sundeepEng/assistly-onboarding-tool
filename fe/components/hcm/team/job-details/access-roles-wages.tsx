import { useRouter } from "next/router";
import { useState } from "react";
import { useDispatch } from "react-redux";
import useGetById from "../../../../services/getById";
import {
  AccessRoleOptions,
  CARE_TEAM,
  hcmTeamRoasterPath,
  USER_PATH_OMIT_FIELDS,
  UserPath,
  WageOptions,
} from "../../../../utils/constants";
import useUpsert from "../../../../services/upsert";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../../redux/slices/exception-popover-slice";
import Form from "../../../../commonComponents/form";
import { updateHcmTeamMember } from "../../../../model/hcm/team-model";
import Button from "../../../../commonComponents/button";
import FormSelectComponent from "../../../../commonComponents/form-select-component";
import FormInputFieldComponent from "../../../../commonComponents/form-input-field-component";
import { dateFormat, omit } from "../../../../utils/dateUtils";
import useUpdate from "../../../../services/update";
import useGetAllShifts from "../../../../services/hcm-getall-shifts";
import Loader from "../../../../commonComponents/loader";
import { getHomeIdFromToken } from "../../../../utils/auth";

const AccessRolesWages = () => {
  const [editAccess, setEditAccess] = useState(false);
  const router = useRouter();
  const { userId } = router.query;
  const dispatch = useDispatch();

  //Calls to fetch user data along with shifts and roaster data
  const {
    data: userData,
    isLoading: userDataLoading,
    refetch,
  } = useGetById({
    key: "team member",
    payload: { id: userId as string, path: UserPath,enabled:!!userId },
  });
  const { data: shiftsData, isLoading: shiftDataLoading } = useGetAllShifts({
    key: "shifts",
    params: { user_id: userId },
  });

  // Prepare defaultvalues to form
  const defaultValues = {
    ...userData,
    // wage: "Hourly",
    pay_frequency: userData?.roaster?.[0]?.pay_frequency || "Hourly",
    pay_rate: Number(userData?.roaster[0]?.pay_rate || 0),
  };

  // Upsert roaster data
  const { mutate } = useUpsert();
  const { mutate: updateMutate } = useUpdate();
  const homeId = getHomeIdFromToken();
  const handleSubmitAccessRoleWage = (data) => {
    setEditAccess(false);

    // Upsert team roaster
    const payload = {
      data: {
        user_id: userId,
        pay_rate: data?.pay_rate,
        pay_frequency: data?.pay_frequency,
        home_id: homeId,
      },
      path: hcmTeamRoasterPath,
    };
    mutate(payload, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Updated Successfully!"));
      },
      onError: (error: any) => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage("Error in updating!"));
      },
    });

    // Update user data
    var userPayloadData = {
      ...userData,
      contractCompletedOn: data?.contractCompletedOn,
    };

    const cleanedPayload = omit(userPayloadData, USER_PATH_OMIT_FIELDS);
    const userPayload = {
      data: cleanedPayload,
      path: UserPath,
    };

    updateMutate(userPayload, {
      onSuccess: () => {
        refetch();
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Updated Successfully!"));
      },
      onError: (error: any) => {
        console.log(error);
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(handleShowPopoverMessage("Error in updating!"));
      },
    });
  };
  if (userDataLoading || shiftDataLoading) return <Loader fullScreen={false} />;
  return (
    <div>
      {
        <Form
          onSubmit={handleSubmitAccessRoleWage}
          schema={updateHcmTeamMember}
          defaultValues={defaultValues}
        >
          <div>
            <h1>Access, Roles & Wages</h1>
            <div className="border-2 border-solid w-full rounded-xl p-[20px]">
              <div className="flex justify-between items-center">
                {/* Temporarily disabled - location */}
                <div className="flex gap-4 items-center">
                  <h3 className="text-[23px]">{userData?.name}</h3>
                  {/* <div className="font-medium bg-blue-500 rounded-2xl bg-opacity-30 text-[blue] px-[7px]">
                                        Primary location
                                    </div> */}
                </div>
                {!editAccess && (
                  <div
                    className={`${
                      userData?.isDeleted
                        ? "!cursor-not-allowed opacity-50"
                        : ""
                    }`}
                  >
                    <Button
                      name={"Edit"}
                      type="button"
                      buttonClick={() => setEditAccess((prev) => !prev)}
                      classname={`h-[40px] ${
                        userData?.isDeleted ? "pointer-events-none" : ""
                      }`}
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap justify-between ">
                <div className="flex">
                  {editAccess ? (
                    <div className="flex">
                      <div className="flex">
                        <FormSelectComponent
                          label={"Role(s)"}
                          options={AccessRoleOptions}
                          name={"role"}
                          titleClass={"text-[18px] font-bold"}
                          containerClass="w-[390px] m-[10px]"
                          disabled={true}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <h3>Role(s) & Wages(s):</h3>
                      <div>
                        {CARE_TEAM}{" "}
                        {defaultValues?.roaster?.[0]?.pay_rate || "--"}
                        {defaultValues?.pay_frequency === "Monthly"
                          ? "/month"
                          : "/hour"}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex">
                  {editAccess ? (
                    <div className="flex">
                      <FormInputFieldComponent
                        label={"Start Date:"}
                        name={"contractCompletedOn"}
                        titleClass={"text-[18px] font-bold"}
                        containerClass="w-[390px] m-[10px]"
                        type="date"
                        max={defaultValues?.contractCompletedOn}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <h3>Start Date:</h3>
                      <div>{dateFormat(defaultValues?.contractCompletedOn) || "--"}</div>
                    </div>
                  )}
                </div>

                <div className="flex">
                  {editAccess && (
                    <div className="flex">
                      <FormSelectComponent
                        label={"Wage(s)"}
                        options={WageOptions}
                        name={"pay_frequency"}
                        titleClass={"text-[18px] font-bold"}
                        containerClass="w-[390px] m-[10px]"
                        value={defaultValues?.pay_frequency || "Hourly"}
                      />
                    </div>
                  )}
                </div>
                <div className="flex">
                  {editAccess && (
                    <div className="flex">
                      <FormInputFieldComponent
                        label={"Wage Rate($)"}
                        name={"pay_rate"}
                        titleClass={"text-[18px] font-bold"}
                        containerClass="w-[390px] m-[10px]"
                        type="number"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end pt-[20px]">
                {editAccess && (
                  <div className="flex gap-2">
                    <Button
                      name={"Cancel"}
                      type="button"
                      buttonClick={() => setEditAccess(false)}
                    />
                    <Button name={"Save"} type="submit" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </Form>
      }
    </div>
  );
};

export default AccessRolesWages;
