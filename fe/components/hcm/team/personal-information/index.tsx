import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import Form from "../../../../commonComponents/form";
import { UpdatePCGSchema } from "../../../../model/crm/user.model";
import {
    handleOpenPopover,
    handleShowCloseOptions,
    handleShowPopoverMessage,
} from "../../../../redux/slices/exception-popover-slice";
import useGetById from "../../../../services/getById";
import useUpdate from "../../../../services/update";
import { USER_PATH_OMIT_FIELDS, UserPath } from "../../../../utils/constants";
import { omit } from "../../../../utils/dateUtils";
import ContactInformation from "./contact-information";
import { useState } from "react";

const PersonalInformation = () => {
    const router = useRouter();
    const dispatch = useDispatch();
    const { userId } = router.query;
    const [editAccess, setEditAccess] = useState(false);

    const { data: defaultValues,
        refetch } = useGetById({
        key: "user",
        payload: { id: userId as string, path: UserPath,enabled:!!userId },
    });
    const { mutate } = useUpdate();
    const handleSubmit = (data) => {
        const modifiedData = omit(defaultValues, USER_PATH_OMIT_FIELDS);
        const payload = {
            data: {
                ...modifiedData,
                ...data,
                name: [data?.firstName, data?.middleName, data?.lastName]
                    .filter(Boolean)
                    .join(" "),
            },
            path: UserPath,
        };
        setEditAccess(false);
        mutate(payload, {
            onSuccess: () => {
                refetch()
                dispatch(handleOpenPopover());
                dispatch(handleShowPopoverMessage("Updated Successfully!"));
            },
            onError: (error: any) => {
                dispatch(handleOpenPopover());
                dispatch(handleShowCloseOptions());
                dispatch(handleShowPopoverMessage("Error in updating!"));
            },
        });
    };
    return (
        <div>
            <Form
                onSubmit={handleSubmit}
                defaultValues={defaultValues}
                schema={UpdatePCGSchema}
            >
                <ContactInformation
                    editAccess={editAccess}
                    setEditAccess={setEditAccess}
                />
            </Form>
        </div>
    );
};

export default PersonalInformation;
