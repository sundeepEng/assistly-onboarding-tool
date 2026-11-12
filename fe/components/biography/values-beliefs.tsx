import React from "react";
import FormTextareaComponent from "../../commonComponents/form-textarea-component";
import { basePathValues } from "../../utils/constants";
import FormInputFieldComponent from "../../commonComponents/form-input-field-component";

function Values() {

    return (
        <div>
            <div className="font-poppins font-semibold pb-[10px]">Religion</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                    <FormInputFieldComponent
                        label={"Religion entity name"}
                        className={"mb-[20px]"}
                        placeholder={""}
                        onChange={(e) => void {}}
                        name={`${basePathValues}.religiousEntity`}
                    />
                </div>
                <div>
                    <FormInputFieldComponent
                        label={"Religious entity contact number"}
                        className={"mb-[20px]"}
                        placeholder={""}
                        onChange={(e) => void {}}
                        name={`${basePathValues}.religiousEntityContactNumber`}
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                    <FormTextareaComponent
                        label={"Important dates"}
                        value={""}
                        placeholder={"Comments"}
                        className={"max-w-[625px] mb-[20px]"}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            void {}
                        }
                        name={`${basePathValues}.importantDates`}
                    />
                </div>
                <div className="pb-5">
                    <FormTextareaComponent
                        label={"Personal philosophy on life"}
                        placeholder={"Comments"}
                        className={"max-w-[625px] mb-[20px]"}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            void {}
                        }
                        name={`${basePathValues}.personalPhilosophy`}
                    />
                </div>
            </div>
        </div>
    );
}

export default Values;
