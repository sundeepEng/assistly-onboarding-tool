import { useState } from "react";
import FormSelectComponent from "../../../../commonComponents/form-select-component";
import Button from "../../../../commonComponents/button";

const PayrollInformation = () => {
    const [editAccess, setEditAccess] = useState(false);
    return (
        <div>
            <h1>Payment Information</h1>

            <div className="border-2 border-solid w-full rounded-xl p-[20px]">
                {editAccess ? (
                    <div>
                        <FormSelectComponent
                            label={"Payroll Classification:"}
                            options={[]}
                            name={"payroll"}
                            titleClass={"!flex !self-center text-[23px] font-bold"}
                            containerClass="!flex-row w-full"
                        />
                    </div>
                ) : (
                    <div className="flex justify-between items-center">
                        <div className="flex gap-6 items-center">
                            <h3 className="text-[23px]">
                                Payroll Classification:
                            </h3>
                            <div>W-2 Employee</div>
                        </div>
                        <Button
                            name={"Edit"}
                            classname="h-[40px]"
                            buttonClick={() => setEditAccess((prev) => !prev)}
                        />
                    </div>
                )}
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

export default PayrollInformation;
