import { useState } from "react";
import Button from "../../commonComponents/button";
import FormInputFieldComponent from "../../commonComponents/form-input-field-component";
import Form from "../../commonComponents/form";
import {
  PersonalDetailsSchema,
  PersonalDetailsSchemaPCHO,
} from "../../model/crm/user.model";
import { useFormContext } from "react-hook-form";
import {
  genderOptions,
  USER_PATH_OMIT_FIELDS,
  UserPath,
  userRoles,
} from "../../utils/constants";
import useUpdate from "../../services/update";
import { omit } from "../../utils/dateUtils";
import { useDispatch } from "react-redux";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import _ from "lodash";
import FormSelectComponent from "../../commonComponents/form-select-component";
import { getUserRoleFromToken } from "../../utils/auth";

const PersonalDetails = ({ editAccess, setEditAccess, defaultValues }) => {
  const role = getUserRoleFromToken();
  const { reset } = useFormContext();
  const renderRow = (label, viewValue, editFields) => (
    <div className="flex items-center text-xl">
      <div className="font-medium font-jakarta w-[200px] font-lg">{label}</div>
      <div className="w-[400px]">
        {editAccess ? editFields : <span>{viewValue}</span>}
      </div>
    </div>
  );

  return (
    <div className="font-poppins">
      <div className="rounded-md p-4  overflow-x-auto">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-6">
            {/* Preferred Name */}
            {renderRow(
              "Preferred name",
              `${defaultValues?.firstName || ""} ${
                defaultValues?.lastName || ""
              }`,
              <div className="flex gap-2">
                <FormInputFieldComponent
                  name="firstName"
                  placeholder="First name"
                  containerClass="w-full"
                  titleClass="hidden"
                />
                <FormInputFieldComponent
                  name="lastName"
                  placeholder="Last name"
                  containerClass="w-full"
                  titleClass="hidden"
                />
              </div>
            )}

            {/* Email */}
            {renderRow(
              "Email",
              defaultValues?.email || "-",
              <FormInputFieldComponent
                name="email"
                readOnly={!!defaultValues?.email}
                placeholder="Email"
                containerClass="w-full"
                titleClass="hidden"
              />
            )}

            {/* Mobile */}
            {renderRow(
              "Mobile number",
              defaultValues?.mobile || "-",
              <FormInputFieldComponent
                name="mobile"
                placeholder="Mobile"
                containerClass="w-full"
                titleClass="hidden"
              />
            )}

            {role != userRoles.PCHO && role != userRoles.COMPLIANCE_GUEST && (
              <>
                {/* Gender */}
                {renderRow(
                  "Gender",
                  defaultValues?.biography?.personalDetails?.gender || "-",
                  <FormSelectComponent
                    label="Gender *"
                    options={genderOptions}
                    name="biography.personalDetails.gender"
                    className="w-full"
                    titleClass="hidden"
                  />
                )}

                {/* Birthdate */}
                {renderRow(
                  "Birthdate",
                  defaultValues?.biography?.personalDetails?.birthdate
                    ? new Date(
                        defaultValues?.biography?.personalDetails?.birthdate
                      ).toLocaleDateString()
                    : "-",
                  <FormInputFieldComponent
                    label="Birthdate *"
                    placeholder="Value"
                    name="biography.personalDetails.birthdate"
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full"
                    titleClass="hidden"
                  />
                )}

                {/* Emergency Contact */}
                {renderRow(
                  "Emergency contact",
                  `${
                    defaultValues?.biography?.personalDetails
                      ?.emergencyContactName || "-"
                  } ${
                    defaultValues?.biography?.personalDetails
                      ?.emergencyContactNumber || "-"
                  }`,
                  <div className="flex gap-2">
                    <FormInputFieldComponent
                      name="biography.personalDetails.emergencyContactName"
                      placeholder="Name"
                      containerClass="w-full"
                      titleClass="hidden"
                    />
                    <FormInputFieldComponent
                      name="biography.personalDetails.emergencyContactNumber"
                      placeholder="Phone number"
                      containerClass="w-full"
                      titleClass="hidden"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {!editAccess && (
            <div>
              <div className="flex justify-center items-center align-center font-base font-medium cursor-pointer">
                <div
                  className="flex border border-solid rounded-[7px] py-[10px] px-[30px] h-fit border-gray1"
                  onClick={() => setEditAccess(true)}
                >
                  Edit Profile
                </div>
              </div>
            </div>
          )}
        </div>

        {editAccess && (
          <div className="flex justify-end gap-2 mt-8">
            <Button
              name="Cancel"
              buttonClick={() => {
                setEditAccess(false);
                reset();
              }}
            />
            <Button name="Save" type="submit" />
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalDetails;

export const PersonalDetailsFormWrapper = ({ defaultValues }) => {
  const [editAccess, setEditAccess] = useState(false);
  const { mutate } = useUpdate();
  const dispatch = useDispatch();
  const role = getUserRoleFromToken();

  const schema =
    role === userRoles.PCHO ? PersonalDetailsSchemaPCHO : PersonalDetailsSchema;
  const handleSubmit = (data) => {
    const defaultSubset = _.pick(defaultValues, Object.keys(data));

    const filteredData = {
      biography: {
        personalDetails: defaultValues.biography?.personalDetails || {},
      },
    };
    const finalDataOfDefaultValues = {
      ...defaultSubset,
      ...filteredData,
    };
    const isValid = _.isEqual(data, finalDataOfDefaultValues);

    if (isValid) {
      // if no changes were made, nothing to update
      setEditAccess(false);
      return;
    } else {
      const modifiedData = omit(defaultValues, USER_PATH_OMIT_FIELDS);
      const merged = _.merge({}, modifiedData, data);
      const payload = {
        data: {
          ...merged,
          name: [data?.firstName, data?.middleName, data?.lastName]
            .filter(Boolean)
            .join(" "),
        },
        path: UserPath,
      };
      setEditAccess(false);
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
    }
  };

  return (
    <div className="p-2">
      <Form
        onSubmit={handleSubmit}
        schema={schema}
        defaultValues={defaultValues}
      >
        <PersonalDetails
          editAccess={editAccess}
          setEditAccess={setEditAccess}
          defaultValues={defaultValues}
        />
      </Form>
    </div>
  );
};
