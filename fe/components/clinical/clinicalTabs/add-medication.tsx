import React, { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import Button from "../../../commonComponents/button";
import Form from "../../../commonComponents/form";
import FormInputFieldComponent from "../../../commonComponents/form-input-field-component";
import FormMultiSelectComponent from "../../../commonComponents/form-multiselect-component";
import FormTextareaComponent from "../../../commonComponents/form-textarea-component";
import { ClinicalSchema } from "../../../model/clinical/clinical.model";
import { useAppDispatch } from "../../../redux/hooks";
import {
    handleOpenPopover,
    handleShowCloseOptions,
    handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { handleCloseAddMedicationModal } from "../../../redux/slices/modal-slice";
import useUpdate from "../../../services/update";
import { CLINICAL_USER_PATH_OMIT_FIELDS, ClinicalUserPath } from "../../../utils/constants";
import { fixTimingFormat, omit, timeOptions, timeOptions24H } from "../../../utils/dateUtils";
import { format } from "date-fns";

interface AddMedicationFormProps {
    seniorData: any;
    defaultValues?: any; // Accept defaultValues for editing
}

export const AddMedicationForm = ({ defaultValues }) => {
    const { setValue, control } = useFormContext();
    const schema = "medication";
    const today = defaultValues?.startdate ? defaultValues?.startdate : format(new Date(), "yyyy-MM-dd")
    // Watch start and end date fields
    const startDate = useWatch({ control, name: `${schema}.startdate` });
    const endDate = useWatch({ control, name: `${schema}.enddate` });

    return (
        <div className="font-poppins w-[550px] pb-1">
            <div className="flex flex-col gap-4">
                <FormInputFieldComponent
                    label="Name * :"
                    name={`${schema}.name`}
                    className="mt-1 block !w-[425px] h-[41px]"
                    placeholder="Enter Medication Name"
                    containerClass={"!flex-row w-full"}
                    titleClass="!flex !self-center !w-[120px]"
                />
                <FormInputFieldComponent
                    label="Dosage * :"
                    name={`${schema}.dosage`}
                    className="mt-1 block !w-[425px] h-[41px] "
                    placeholder="Dosage"
                    containerClass={"!flex-row w-full"}
                    titleClass="!flex !self-center !w-[120px]"
                />
                <FormInputFieldComponent
                    label="Directions :"
                    name={`${schema}.directions`}
                    className="mt-1 block !w-[425px] h-[41px]"
                    placeholder="Enter Medication usage directions"
                    containerClass={"!flex-row w-full"}
                    titleClass="!flex !self-center !w-[120px]"
                />
                <div className="flex justify-between mt-[10px]">
                    <div className="flex justify-between items-center w-[52%]">
                        <FormInputFieldComponent
                            label="Start Date * :"
                            type="date"
                            name={`${schema}.startdate`}
                            className="mt-1 block !min-w-[150px] !w-[160px] h-[41px]"
                            placeholder="Start Date"
                            containerClass={"!flex-row w-full"}
                            titleClass="!flex !self-center !w-[120px]"
                            min={today}
                            max="9999-12-31"
                        />
                    </div>

                    <div className="flex justify-between w-[49%] items-center pl-[2px] pr-[5px]">
                        <FormInputFieldComponent
                            label="End Date :"
                            type="date"
                            name={`${schema}.enddate`}
                            className="mt-1 block !min-w-[150px] !w-[160px] h-[41px]"
                            placeholder="End Date"
                            containerClass={"!flex-row w-full"}
                            titleClass="!flex !self-center !w-[120px]"
                            min={startDate || today}
                            max="9999-12-31"
                        />
                    </div>
                </div>

                <FormMultiSelectComponent
                    label="Timings * :"
                    name={`${schema}.timings`}
                    options={timeOptions24H}
                    className="420px"
                    containerClass={"!flex !flex-row pt-2"}
                    titleClass="!flex !flex-row !w-[120px] mt-2"
                    optionsClass="ml-[125px] mt-[40px] w-[430px]"
                />
                <div className="mt-[10px]">
                    <FormTextareaComponent
                        label="Additional Comments :"
                        name={`${schema}.additionalComments`}
                        onChange={() => { }}
                        className="m-0 block w-full "
                        placeholder="Comment here..."
                    />
                </div>
                <div className="flex justify-center items-center">
                    <Button
                        buttonClick={() => { }}
                        name="Save"
                        type="submit"
                        classname="flex items-center w-[194px] h-[57px] border border-transparent shadow-sm text-[18px] font-poppins font-semibold rounded-md text-white bg-[#3089AB]  "
                    />
                </div>
            </div>
        </div>
    );
};

const AddMedicationFormWrapper: React.FC<AddMedicationFormProps> = ({
    seniorData,
    defaultValues,
}) => {
    const { mutate } = useUpdate();
    const dispatch = useAppDispatch();
    const handleSubmit = (data: any) => {
        // Prepare form data
        const formData = {
            ...data.medication,
            id: defaultValues?.id || uuidv4(), // Use existing ID if editing
            overTheCounter: false,
        };
        // Check if seniorData and clinical structure is as expected, or create new
        if (!seniorData?.clinical) {
            seniorData.clinical = {}; // Initialize clinical if not present
        }
        if (!Array.isArray(seniorData?.clinical?.medication)) {
            seniorData.clinical.medication = []; // Initialize medication array if not present
        }

        if (defaultValues) {
            // Edit existing medication
            const index = seniorData?.clinical?.medication?.findIndex(
                (med) => med.id === defaultValues.id
            );
            if (index !== -1) {
                seniorData.clinical.medication[index] = formData;
            }
        } else {
            // Add new medication
            seniorData?.clinical?.medication?.push(formData);
        }
        const clinicalData = seniorData?.clinical || {};
        // Prepare payload
        const payloadData = {
            ...clinicalData,
            medication: clinicalData?.medication || [],
            userId: seniorData?.userId,
        };
        const cleanedMedicationData: any = omit(payloadData, CLINICAL_USER_PATH_OMIT_FIELDS);

        const payload = {
            data: { ...cleanedMedicationData },
            path: ClinicalUserPath,
        };
        // API Call
        mutate(payload, {
            onSuccess: () => {
                dispatch(handleOpenPopover());
                dispatch(
                    handleShowPopoverMessage(
                        defaultValues
                            ? "Medication updated"
                            : "Medication added"
                    )
                );
                dispatch(handleCloseAddMedicationModal());
            },
            onError: (error: any) => {
                dispatch(handleOpenPopover());
                dispatch(handleShowCloseOptions());
                dispatch(
                    handleShowPopoverMessage(
                        defaultValues
                            ? `Error in updating the medication ${error?.response?.data?.message}!`
                            : `Error in adding the medication ${error?.response?.data?.message}!`
                    )
                );
            },
        });
    };
    return (
        <div className="font-poppins">
            <Form
                onSubmit={handleSubmit}
                schema={ClinicalSchema}
                defaultValues={{ medication: defaultValues || {} }}
            >
                <AddMedicationForm defaultValues={defaultValues} />
            </Form>
        </div>
    );
};

export default AddMedicationFormWrapper;