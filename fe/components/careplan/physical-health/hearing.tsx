import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { hearingOptions } from "../../../utils/constants";

function Hearing() {
    return (
        <div className="pl-[20px]">
            <div>
                Hearing - Level of Care:
                <FormSingleRadioSelect 
                    name={"carePlan.physicalHealth.hearing"} 
                    options={hearingOptions}
                />
            </div>
        </div>
    );
}

export default Hearing;
