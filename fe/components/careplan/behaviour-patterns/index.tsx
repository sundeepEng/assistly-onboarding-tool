import _ from "lodash";
import Button from "../../../commonComponents/button";
import Form from "../../../commonComponents/form";
import { UpdateLeadOrSeniorSchema } from "../../../model/crm/user.model";
import { useAppDispatch } from "../../../redux/hooks";
import {
  handleOpenPopover,
  handleShowCloseOptions,
  handleShowPopoverMessage,
} from "../../../redux/slices/exception-popover-slice";
import { handleSetCarePlanLeadActiveTab } from "../../../redux/slices/tab-slice";
import useUpdate from "../../../services/update";
import {
  InHomeCare,
  leadCarePlanTabConstants,
  USER_PATH_OMIT_FIELDS,
  UserPath,
} from "../../../utils/constants";
import { omit } from "../../../utils/dateUtils";
import FormInputCheckboxComponent from "../../../commonComponents/form-input-checkbox-component";
import { useGetHomeType } from "../../../utils/gethomeType";

function Index({ careplanData }: any) {
  const { mutate, isPending } = useUpdate();
  const dispatch = useAppDispatch();

  const handleFormSubmit = (data: any) => {
    const formattedData = _.merge({}, careplanData, data);
    const cleanedData: any = omit(formattedData, USER_PATH_OMIT_FIELDS);

    // Prepare payload and trigger mutation
    const payload = { data: cleanedData, path: UserPath };
    mutate(payload, {
      onSuccess: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowPopoverMessage("Data Saved Successfully"));
        dispatch(
          handleSetCarePlanLeadActiveTab(
            leadCarePlanTabConstants.OVERALL_HEALTH_TAB
          )
        );
      },
      onError: () => {
        dispatch(handleOpenPopover());
        dispatch(handleShowCloseOptions());
        dispatch(
          handleShowPopoverMessage("Not able to update careplan data of Lead"),
        );
      },
    });
  };
  const userData = omit(careplanData, [
    "clinical",
    "lastLoginTimestamp",
    "modifiedAt",
    "userId",
    "createdAt",
  ]);
  const basePath = "carePlan.behaviourPatterns";
  const behaviourData = [
    { name: `${basePath}.wanderingRisk`, label: "Wandering Risk" },
    {
      name: `${basePath}.evacuationAssistance`,
      label: "Evacuation Assistance",
    },
  ];
  const homeType = useGetHomeType();
  const isInHomeCare = homeType === InHomeCare;
  const formSchema = UpdateLeadOrSeniorSchema(isInHomeCare);
  return (
    <Form
      schema={formSchema}
      onSubmit={handleFormSubmit}
      defaultValues={userData}
    >
      <div className="flex w-full justify-center">
        <div className="flex bg-white p-[30px] max-w-[1114px] rounded-md">
          <div className="flex flex-col items-center gap-[4vh] max-w-[1114px]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 justify-start self-start max-w-[1114px]">
              {behaviourData?.map((behaviour) => (
                <div
                  key={behaviour?.label}
                  className="w-full flex px-[30px] py-[15px]"
                >
                  <FormInputCheckboxComponent
                    name={behaviour?.name}
                    label={behaviour?.label}
                  />
                </div>
              ))}
            </div>
            <div className="flex">
              <Button
                name="Save"
                classname="w-[350px]"
                buttonClick={() => {}}
                isLoading={isPending}
              />
            </div>
          </div>
        </div>
      </div>
    </Form>
  );
}

export default Index;
