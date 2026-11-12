import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { recurringIllnessOptions } from "../../../utils/constants";


function RecurringIllness() {
    return (
        <div className="pl-[20px]">
            <div>
                Recurring Illness - Level of Care:
                <FormSingleRadioSelect 
                    name={"carePlan.physicalHealth.recurringIllnessCareLevel"} 
                    options={recurringIllnessOptions}
                />
               
            </div>
        </div>
    );
}

export default RecurringIllness;
