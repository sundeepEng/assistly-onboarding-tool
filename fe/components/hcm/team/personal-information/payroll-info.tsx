import { useState } from "react";
import FormInputFieldComponent from "../../../../commonComponents/form-input-field-component";
import Button from "../../../../commonComponents/button";

const PayrollInfo = () => {
    const [editAccess, setEditAccess] = useState(false);
    return (
        <div>
            <h1>Payment Information</h1>
            <div className=" border-2 border-solid rounded-xl">
                <div className="flex items-center justify-between">
                    <div>
                        <div>
                            {editAccess ? (
                                <div>
                                    <FormInputFieldComponent
                                        label={"Legal first name"}
                                        name={"legal_first_name"}
                                        titleClass="!flex !self-center !w-[100px]"
                                        containerClass={"!flex-row w-full"}
                                    />
                                    <FormInputFieldComponent
                                        label={"Legal middle name"}
                                        name={"legal_middle_name"}
                                        titleClass="!flex !self-center !w-[100px]"
                                        containerClass={"!flex-row w-full"}
                                    />
                                    <FormInputFieldComponent
                                        label={"Legal last name"}
                                        name={"legal_last_name"}
                                        titleClass="!flex !self-center !w-[100px]"
                                        containerClass={"!flex-row w-full"}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <div>Legal name</div>
                                    <div></div>
                                </div>
                            )}
                        </div>
                        <div>
                            {editAccess ? (
                                <div>
                                    <FormInputFieldComponent
                                        label={"Date of birth"}
                                        name={"legal_middle_name"}
                                        titleClass="!flex !self-center !w-[100px]"
                                        containerClass={"!flex-row w-full"}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <div>Date of birth</div>
                                    <div></div>
                                </div>
                            )}
                        </div>
                        <div>
                            {editAccess ? (
                                <div>
                                    <FormInputFieldComponent
                                        label={"Social Security number"}
                                        name={"legal_middle_name"}
                                        titleClass="!flex !self-center !w-[100px]"
                                        containerClass={"!flex-row w-full"}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <div>Social Security number</div>
                                    <div></div>
                                </div>
                            )}
                        </div>
                        <div>
                            {editAccess ? (
                                <div>
                                    <FormInputFieldComponent
                                        label={"Social Security number"}
                                        name={"legal_middle_name"}
                                        titleClass="!flex !self-center !w-[100px]"
                                        containerClass={"!flex-row w-full"}
                                    />
                                    <FormInputFieldComponent
                                        label={"Address line 1"}
                                        name={"legal_middle_name"}
                                        titleClass="!flex !self-center !w-[100px]"
                                        containerClass={"!flex-row w-full"}
                                    />
                                    <FormInputFieldComponent
                                        label={"Address line 2"}
                                        name={"legal_middle_name"}
                                        titleClass="!flex !self-center !w-[100px]"
                                        containerClass={"!flex-row w-full"}
                                    />
                                    <FormInputFieldComponent
                                        label={"City"}
                                        name={"legal_middle_name"}
                                        titleClass="!flex !self-center !w-[100px]"
                                        containerClass={"!flex-row w-full"}
                                    />
                                    <div className="flex">
                                        <FormInputFieldComponent
                                            label={"State and ZIP code"}
                                            name={"legal_middle_name"}
                                            titleClass="!flex !self-center !w-[100px]"
                                            containerClass={"!flex-row w-full"}
                                        />
                                        <FormInputFieldComponent
                                            label={""}
                                            name={"legal_middle_name"}
                                            titleClass="!flex !self-center !w-[100px]"
                                            containerClass={"!flex-row w-full"}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div>Home address</div>
                                    <div></div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        {!editAccess && (
                            <Button
                                name={"Edit"}
                                buttonClick={() =>
                                    setEditAccess((prev) => !prev)
                                }
                            />
                        )}
                    </div>
                </div>
                <div className="flex justify-end">
                    {editAccess && (
                        <div className="flex gap-2">
                            <Button
                                name={"Cancel"}
                                buttonClick={() => setEditAccess(false)}
                            />
                            <Button
                                name={"Save"}
                                buttonClick={() => setEditAccess(false)}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PayrollInfo;
