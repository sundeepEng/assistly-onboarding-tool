import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import FormInputFieldComponent from "../../../../commonComponents/form-input-field-component";
import useGetById from "../../../../services/getById";
import { UserPath } from "../../../../utils/constants";
import Button from "../../../../commonComponents/button";
import Loader from "../../../../commonComponents/loader";
const ContactInformation = ({ editAccess, setEditAccess }) => {
    const router = useRouter();
    const { userId } = router.query;

    // Get user data
    const { data: defaultValues, isLoading } = useGetById({
        key: "user",
        payload: { id: userId as string, path: UserPath,enabled:!!userId },
    });
    const { reset } = useFormContext();

    useEffect(() => {
        if (editAccess && defaultValues) {
            reset(defaultValues);
        }
    }, [editAccess, defaultValues, reset]);
    const { formState } = useFormContext();

    if (isLoading) return <Loader fullScreen={false}/>;
    return (
        <div className="font-poppins">
            <h1>Contact Information</h1>
            <div className=" border-2 border-solid rounded-xl p-[40px]">
                
                <div className="flex justify-between items-center">
                    <div></div>
                     <div className={`${defaultValues?.isDeleted?"cursor-not-allowed opacity-50":""}`}>
                     <div className={`${defaultValues?.isDeleted?"pointer-events-none":""}`}>
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
                </div>
                <div className="flex items-start justify-between ">
                    <div className="flex flex-col gap-6">
                        <div className="flex gap-4">
                            {editAccess ? (
                                <div className="flex min-w-[800px]">
                                    <FormInputFieldComponent
                                        label={"Preferred name"}
                                        name={"firstName"}
                                        titleClass="!flex !self-center min-w-[400px]"
                                        containerClass={
                                            "!flex-row w-full text-lg font-bold min-w-[400px]"
                                        }
                                        placeholder={"First name"}
                                    />
                                    <FormInputFieldComponent
                                        label={""}
                                        name={"lastName"}
                                        containerClass={
                                            "!flex-row w-full text-lg font-bold min-w-[400px]"
                                        }
                                        placeholder={"Last name"}
                                    />
                                </div>
                            ) : (
                                <div className="flex justify-around text-xl w-[800px] ">
                                    <div className="flex font-bold font-poppins min-w-[400px]">
                                        Preferred name
                                    </div>
                                    <div className="flex min-w-[400px]">
                                        {defaultValues?.name}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-4">
                            {editAccess ? (
                                <FormInputFieldComponent
                                    label={"Personal email"}
                                    name={"email"}
                                    titleClass="!flex !self-center min-w-[400px]"
                                    containerClass={
                                        "!flex-row w-full text-lg font-bold min-w-[400px]"
                                    }
                                    readOnly={
                                        formState?.defaultValues?.email
                                            ? true
                                            : false
                                    }
                                    placeholder={"Email"}
                                />
                            ) : (
                                <div className="flex justify-around text-xl w-[800px]">
                                    <div className="flex font-bold font-poppins  min-w-[400px]">
                                        Personal email
                                    </div>
                                    <div className="flex  min-w-[400px]">
                                        {defaultValues?.email}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-4">
                            {editAccess ? (
                                <FormInputFieldComponent
                                    label={"Mobile number"}
                                    name={"mobile"}
                                    titleClass="!flex !self-center  min-w-[400px]"
                                    containerClass={
                                        "!flex-row w-full text-lg font-bold min-w-[400px]"
                                    }
                                    placeholder={"Mobile"}
                                />
                            ) : (
                                <div className="flex justify-around text-xl w-[800px] ">
                                    <div className="flex font-bold font-poppins  min-w-[400px] ">
                                        Mobile number
                                    </div>
                                    <div className="flex  min-w-[400px]">
                                        {defaultValues?.mobile}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-4">
                            {editAccess ? (
                                <div className="flex">
                                    <FormInputFieldComponent
                                        label={"Emergency contact"}
                                        name={"biography.personalDetails.emergencyContactName"}
                                        titleClass="!flex !self-center min-w-[400px]"
                                        containerClass={
                                            "!flex-row w-full text-lg font-bold min-w-[400px]"
                                        }
                                        placeholder={"Name"}
                                    />
                                    <FormInputFieldComponent
                                        label={""}
                                        name={
                                            "biography.personalDetails.emergencyContactNumber"
                                        }
                                        containerClass={
                                            "!flex-row w-full text-lg min-w-[400px]"
                                        }
                                        placeholder={"Phone number"}
                                    />
                                </div>
                            ) : (
                                <div className="flex justify-around text-xl w-[800px] ">
                                    <div className="flex font-bold font-poppins  min-w-[400px]">
                                        Emergency contact
                                    </div>
                                    <div className="flex  min-w-[400px]">
                                        {defaultValues?.biography?.personalDetails
                                            ?.emergencyContactName || ""}{" "}
                                        {defaultValues?.biography?.personalDetails
                                            ?.emergencyContactNumber || "-"}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                   
                </div>
                <div className="flex justify-end  pt-[20px]">
                    {editAccess && (
                        <div className="flex gap-2">
                            <Button
                                name={"Cancel"}
                                buttonClick={() => setEditAccess(false)}
                            />
                            <Button name={"Save"} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContactInformation;
