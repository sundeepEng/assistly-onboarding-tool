import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { shortTermIllnessOptions } from "../../../utils/constants";

function ShortTermIllness() {
    return (
        <div className="pl-[20px]">
            <div>
                Short-term Illness - Level of Care:
                <FormSingleRadioSelect 
                    name={"carePlan.physicalHealth.shortTermIllnessCareLevel"} 
                    options={shortTermIllnessOptions}
                />
                
                
            </div>
        </div>
    );
}

export default ShortTermIllness;
