import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { chronicIllnessOptions } from "../../../utils/constants";

function ChronicIllness() {
    return (
        <div className="pl-[20px]">
            <div>
                ChronicIllness - Level of Care:
                <FormSingleRadioSelect 
                    name={"carePlan.physicalHealth.chronicIllnessCareLevel"} 
                    options={chronicIllnessOptions}
                />
                
                
            </div>
        </div>
    );
}

export default ChronicIllness;
