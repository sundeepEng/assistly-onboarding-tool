import { useState, useEffect, useRef } from "react";
import { useFormContext } from "react-hook-form";
import FormInputFieldComponent from "../../commonComponents/form-input-field-component";
import FormSelectComponent from "../../commonComponents/form-select-component";
import FormTextareaComponent from "../../commonComponents/form-textarea-component";
import PopoverComponent from "../../commonComponents/popover-component";
import InfoIcon from "../../public/icons/info-circle-icon";
import {
  basePathPersonalDetails,
  genderOptions,
  InHomeCare,
  OccupationOptions,
  raceOptions,
} from "../../utils/constants";
import { useGetHomeType } from "../../utils/gethomeType";
import { attachAddressAutocomplete } from "../../utils/googlePlacesAddress";

function PersonalDetails() {
  const { formState } = useFormContext();
  const [open, setOpen] = useState(false);
  const [infoOpen, setinfoOpen] = useState(false);
  const { getValues, setValue } = useFormContext();
  const occupationData = getValues(`${basePathPersonalDetails}.occupation`);
  const raceData = getValues(`${basePathPersonalDetails}.race`);

  const homeType = useGetHomeType();
  const isInHomeCare = homeType === InHomeCare;
  const [showSSN, setShowSSN] = useState(false);
  const ssnTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const cleanup = attachAddressAutocomplete(
      `${basePathPersonalDetails}.address.street1`,
      setValue,
      {
        street: `${basePathPersonalDetails}.address.street1`,
        city: `${basePathPersonalDetails}.address.city`,
        state: `${basePathPersonalDetails}.address.state`,
        zipCode: `${basePathPersonalDetails}.address.zipCode`,
      },
    );
    return cleanup;
  }, [setValue]);

  return (
    <div className="pl-[20px] bg-transparent">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <FormInputFieldComponent
            label={"First Name *"}
            className=""
            placeholder={"ex: jon"}
            onChange={(e) => void {}}
            name={`firstName`}
          />
        </div>
        <div>
          <FormInputFieldComponent
            label={"Middle Name"}
            className=""
            placeholder={""}
            onChange={(e) => void {}}
            name={`middleName`}
          />
        </div>
        <div>
          <FormInputFieldComponent
            label={"Last Name *"}
            className=""
            placeholder={"ex:doe"}
            onChange={(e) => void {}}
            name={`lastName`}
          />
        </div>
        <div>
          <FormInputFieldComponent
            label={"Nick Name"}
            className=""
            placeholder={"Value"}
            onChange={(e) => void {}}
            name={`${basePathPersonalDetails}.nickName`}
          />
        </div>
        <div>
          <FormInputFieldComponent
            label={"Birth date *"}
            className=""
            placeholder={"Value"}
            onChange={(e) => void {}}
            name={`${basePathPersonalDetails}.birthdate`}
            type="date"
            max={new Date().toISOString().split("T")[0]}
          />
        </div>
        <div>
      <FormInputFieldComponent
            label={"SSN"}
            className="w-full"
            SubcontainerClass="!max-w-full"
            placeholder="999-999-999"
            name={`${basePathPersonalDetails}.ssn`}
            passwordVisibility={true}
          />
        </div>
        <div>
          <FormSelectComponent
            label="Gender *"
            options={genderOptions}
            value={""}
            onChange={(e) => void {}}
            className=""
            name={`${basePathPersonalDetails}.gender`}
          />
        </div>
        <div>
          <FormSelectComponent
            label="Race"
            options={raceOptions}
            onChange={(e) => void {}}
            className=""
            name={`${basePathPersonalDetails}.race`}
          />
        </div>
        {raceData === "Other" && (
          <div className="flex">
            <div className="flex-1">
              <FormTextareaComponent
                label={"Other Race"}
                className={"max-w-[625px] mb-[20px]"}
                name={`${basePathPersonalDetails}.otherRace`}
                onChange={(e) => void {}}
              />
            </div>
            <div>
              <PopoverComponent
                body={
                  <div className="w-[300px] font-poppins">
                    If your race is not in options, add your race here
                  </div>
                }
                isOpen={infoOpen}
                setIsOpen={setinfoOpen}
                triggerOnHover={true}
              >
                <div className="flex cursor-pointer w-[20px] h-[20px] rounded-lg justify-center ">
                  <InfoIcon />
                </div>
              </PopoverComponent>
            </div>
          </div>
        )}
      </div>

      <h4 className="font-poppins">Contact Information</h4>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <FormInputFieldComponent
            label={"Email"}
            className=""
            placeholder={"Value"}
            onChange={(e) => void {}}
            name={"email"} //email is present in the root schema.
            readOnly={formState?.defaultValues?.email ? true : false}
          />
        </div>
        <div>
          <FormInputFieldComponent
            label={isInHomeCare ? "Mobile *" : "Mobile"}
            className=""
            placeholder={"999-999-9999"}
            onChange={(e) => void {}}
            name={`mobile`}
            type="phone"
          />
        </div>

        <div>
          <FormInputFieldComponent
            label={"Emergency contact name"}
            className={"mb-[20px]"}
            placeholder={""}
            onChange={(e) => void {}}
            name={`${basePathPersonalDetails}.emergencyContactName`}
          />
        </div>
        <div>
          <FormInputFieldComponent
            label={"Emergency contact number"}
            className={"mb-[20px]"}
            placeholder={""}
            onChange={(e) => void {}}
            name={`${basePathPersonalDetails}.emergencyContactNumber`}
          />
        </div>
      </div>

      <h4 className="font-poppins">Address</h4>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <FormInputFieldComponent
            label={isInHomeCare ? "Street 1 *" : "Street 1"}
            className=""
            placeholder={"Value"}
            onChange={(e) => void {}}
            name={`${basePathPersonalDetails}.address.street1`}
          />
        </div>
        <div>
          <FormInputFieldComponent
            label={"Street 2"}
            className=""
            placeholder={"Value"}
            onChange={(e) => void {}}
            name={`${basePathPersonalDetails}.address.street2`}
          />
        </div>
        <div>
          <FormInputFieldComponent
            label={isInHomeCare ? "City *" : "City"}
            className=""
            placeholder={"Value"}
            onChange={(e) => void {}}
            name={`${basePathPersonalDetails}.address.city`}
          />
        </div>
        <div>
          <FormInputFieldComponent
            label={isInHomeCare ? "State *" : "State"}
            className=""
            placeholder={"Value"}
            onChange={() => void {}}
            name={`${basePathPersonalDetails}.address.state`}
          />
        </div>
        <div>
          <FormInputFieldComponent
            label={isInHomeCare ? "Zip code *" : "Zip code"}
            className=""
            placeholder={"Value"}
            onChange={(e) => void {}}
            name={`${basePathPersonalDetails}.address.zipCode`}
          />
        </div>
        <div>
          <FormInputFieldComponent
            label={"Previous place of residence"}
            className={"mb-[20px]"}
            placeholder={""}
            onChange={(e) => void {}}
            name={`${basePathPersonalDetails}.address.previousPlaceOfResidence`}
          />
        </div>
      </div>

      <h4 className="font-poppins">Occupation</h4>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <FormSelectComponent
            label="Occupation"
            options={OccupationOptions}
            onChange={(e) => {
              if (occupationData != "Other") {
                setValue(`${basePathPersonalDetails}.otherOccupation`, "");
              }
            }}
            className={"mb-[20px]"}
            name={`${basePathPersonalDetails}.occupation`}
          />
        </div>

        {occupationData === "Other" && (
          <div className="flex">
            <div className="flex-1">
              <FormTextareaComponent
                label={"Other occupation details"}
                className={"max-w-[625px] mb-[20px]"}
                name={`${basePathPersonalDetails}.otherOccupation`}
                onChange={(e) => void {}}
              />
            </div>
            <div>
              <PopoverComponent
                body={
                  <div className="w-[300px] font-poppins">
                    Please specify if you&apos;re a spouse of a veteran or
                    provide details about your current occupation.
                  </div>
                }
                isOpen={infoOpen}
                setIsOpen={setinfoOpen}
                triggerOnHover={true}
              >
                <div className="flex cursor-pointer w-[20px] h-[20px] rounded-lg justify-center ">
                  <InfoIcon />
                </div>
              </PopoverComponent>
            </div>
          </div>
        )}
        <div className="flex">
          <div className="flex-1">
            <FormTextareaComponent
              label={"Comments"}
              className={"max-w-[625px] mb-[20px]"}
              onChange={(e) => void {}}
              name={`${basePathPersonalDetails}.comments`}
            />
          </div>
          <div>
            <PopoverComponent
              body={
                <div className="w-[300px] font-poppins">
                  Provide details based on your occupation (e.g., VA info for
                  veterans, profession for others), and use this space to add
                  any missing personal information.
                </div>
              }
              isOpen={open}
              setIsOpen={setOpen}
              triggerOnHover={true}
            >
              <div className="flex cursor-pointer w-[20px] h-[20px] rounded-lg justify-center ">
                <InfoIcon />
              </div>
            </PopoverComponent>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PersonalDetails;
