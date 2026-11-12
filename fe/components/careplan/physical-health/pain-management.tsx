import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { levelOfPainOptions } from "../../../utils/constants";

function PainManagement() {
    return (
        <div className="pl-[20px]">
            <div>
                PainManagement - Level of Care:
                <FormSingleRadioSelect
                    name={"carePlan.physicalHealth.painManagementCareLevel"}
                    options={levelOfPainOptions}
                />
            </div>
        </div>
    );
}

export default PainManagement;
