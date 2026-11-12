import { useState } from "react";
import FormInputFieldComponent from "../../commonComponents/form-input-field-component";
import FormTextareaComponent from "../../commonComponents/form-textarea-component";
import PopoverComponent from "../../commonComponents/popover-component";
import InfoIcon from "../../public/icons/info-circle-icon";
import { basePathMedicalGeneral } from "../../utils/constants";

function general() {
    const [open, setOpen] = useState(false);
    return (
        <div className="pl-[20px]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                    <FormInputFieldComponent
                        label={"Practice Name"}
                        className=""
                        onChange={(e) => void {}}
                        name={`${basePathMedicalGeneral}.practiceName`}
                        placeholder={""}
                    />
                </div>
                <div>
                    <FormInputFieldComponent
                        label={"Practice Number"}
                        className=""
                        onChange={(e) => void {}}
                        name={`${basePathMedicalGeneral}.practiceNumber`}
                        placeholder={""}
                    />
                </div>
                <div>
                    <FormInputFieldComponent
                        label={"Pharmacy Name"}
                        className=""
                        onChange={(e) => void {}}
                        name={`${basePathMedicalGeneral}.pharmacyName`}
                        placeholder={""}
                    />
                </div>
                <div>
                    <FormInputFieldComponent
                        label={"Pharmacy Number"}
                        className=""
                        onChange={(e) => void {}}
                        name={`${basePathMedicalGeneral}.pharmacyNumber`}
                        placeholder={""}
                    />
                </div>
                <div className="flex ">
                     <div className="flex-1"><FormTextareaComponent
                        label={"Food Allergies"}
                        className={"max-w-[625px] mb-[20px]"}
                        placeholder={""}
                        onChange={(e) => void {}}
                        name={`${basePathMedicalGeneral}.foodAllergies`}
                    />
                    </div>
                    <div><PopoverComponent
                            body={
                                <div className="w-[200px] font-poppins text-[12px]">
                                    Please mention any known food allergies to help us ensure safety and avoid allergic reactions.
                                </div>
                            }
                            isOpen={open}
                            setIsOpen={setOpen}
                            triggerOnHover={true}
                        >
                            <div className="flex cursor-pointer w-[20px] h-[20px] rounded-lg justify-center ">
                                <InfoIcon />
                            </div>
                        </PopoverComponent></div>
                   
                </div>
            </div>
        </div>
    );
}

export default general;