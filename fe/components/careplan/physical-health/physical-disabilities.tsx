import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { physicalDisabilitiesOptions } from "../../../utils/constants";


function PhysicalDisabilities() {
    return (
        <div className="pl-[20px]">
            <div>
                Physical Disabilities - Level of Care:
                <FormSingleRadioSelect 
                    name={"carePlan.physicalHealth.physicalDisabilitiesCareLevel"} 
                    options={physicalDisabilitiesOptions}
                />
            </div>
        </div>
    );
}

export default PhysicalDisabilities;
