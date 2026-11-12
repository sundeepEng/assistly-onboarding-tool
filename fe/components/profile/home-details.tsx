import { useEffect, useState } from "react";
import Button from "../../commonComponents/button";
import FormInputFieldComponent from "../../commonComponents/form-input-field-component";
import Form from "../../commonComponents/form";
import { useFormContext } from "react-hook-form";
import { HOME_PATH_OMIT_FIELDS, homePath } from "../../utils/constants";
import { omit } from "../../utils/dateUtils";
import { useDispatch } from "react-redux";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../redux/slices/exception-popover-slice";
import _ from "lodash";
import useUpsert from "../../services/upsert";
import { HomeDetailsSchema } from "../../model/home/home-model";
import { attachAddressAutocomplete } from "../../utils/googlePlacesAddress";

const HomeDetails = ({ defaultValues, editAccess, setEditAccess }) => {
  const { reset, setValue } = useFormContext();
  const renderRow = (label, viewValue, editFields) => (
    <div className="flex items-center text-xl">
      <div className="font-medium font-jakarta w-[200px] font-lg">{label}</div>
      <div className="w-[400px]">
        {editAccess ? (
          editFields
        ) : (
          <span>
            {viewValue ? _.startCase(_.toLower(`${viewValue}`)) : "-"}
          </span>
        )}
      </div>
    </div>
  );

  useEffect(() => {
    if (!editAccess) return;
    const cleanup = attachAddressAutocomplete("homeAddress.street", setValue, {
      street: "homeAddress.street",
      city: "homeAddress.city",
      state: "homeAddress.state",
      zipCode: "homeAddress.zipCode",
    });
    return cleanup;
  }, [editAccess, setValue]);

  return (
    <div className="font-poppins">
      <div className="rounded-md bg-white  p-4 overflow-x-auto">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-6">
            {/* Home Name */}
            {renderRow(
              "Home Name",
              defaultValues?.homeName || "-",
              <FormInputFieldComponent
                name="homeName"
                placeholder="Home Name"
                containerClass="w-full"
                titleClass="hidden"
                readOnly={true}
              />
            )}

            {/* Home Capacity */}
            {renderRow(
              "Home Capacity",
              defaultValues?.homeCapacity || "-",
              <FormInputFieldComponent
                name="homeCapacity"
                type="number"
                placeholder="Home Capacity"
                containerClass="w-full"
                titleClass="hidden"
                readOnly={true}
              />
            )}

            {/* Home Address - Street */}
            {renderRow(
              "Street",
              defaultValues?.homeAddress?.street || "-",
              <FormInputFieldComponent
                name="homeAddress.street"
                placeholder="Street"
                containerClass="w-full"
                titleClass="hidden"
              />
            )}

            {/* Home Address - City */}
            {renderRow(
              "City",
              defaultValues?.homeAddress?.city || "-",
              <FormInputFieldComponent
                name="homeAddress.city"
                placeholder="City"
                containerClass="w-full"
                titleClass="hidden"
                readOnly={true}
              />
            )}

            {/* Home Address - State */}
            {renderRow(
              "State",
              defaultValues?.homeAddress?.state || "-",
              <FormInputFieldComponent
                name="homeAddress.state"
                placeholder="State"
                containerClass="w-full"
                titleClass="hidden"
                readOnly={true}
              />
            )}

            {/* Home Address - Zip Code */}
            {renderRow(
              "Zip Code",
              defaultValues?.homeAddress?.zipCode || "-",
              <FormInputFieldComponent
                name="homeAddress.zipCode"
                placeholder="Zip Code"
                containerClass="w-full"
                titleClass="hidden"
                readOnly={true}
              />
            )}
          </div>

          {!editAccess && (
            <div>
              <div className="flex justify-center items-center align-center font-base font-medium cursor-pointer">
                <div
                  className="flex border border-solid rounded-[7px] py-[10px] px-[30px] h-fit border-gray1"
                  onClick={() => setEditAccess(true)}
                >
                  Edit Home Details
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

const HomeDetailsFormWrapper = ({ defaultValues }) => {
  const [editAccess, setEditAccess] = useState(false);
  const { mutate } = useUpsert();
  const dispatch = useDispatch();

  const handleSubmit = (data) => {
    const defaultSubset = _.pick(defaultValues, Object.keys(data));
    const isValid = _.isEqual(data, defaultSubset);

    if (isValid) {
      setEditAccess(false);
      return;
    } else {
      const modifiedData = omit(defaultValues, HOME_PATH_OMIT_FIELDS);
      const merged = _.merge({}, modifiedData, data);
      const payload = {
        data: merged,
        path: homePath,
      };
      setEditAccess(false);
      mutate(payload, {
        onSuccess: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowPopoverMessage("Updated Successfully!"));
        },
        onError: () => {
          dispatch(handleOpenPopover());
          dispatch(handleShowCloseOptions());
          dispatch(handleShowPopoverMessage("Error in updating Home Details!"));
        },
      });
    }
  };

  return (
    <div className="p-2">
      <Form
        onSubmit={handleSubmit}
        schema={HomeDetailsSchema}
        defaultValues={defaultValues}
      >
        <HomeDetails
          editAccess={editAccess}
          setEditAccess={setEditAccess}
          defaultValues={defaultValues}
        />
      </Form>
    </div>
  );
};

export default HomeDetailsFormWrapper;
