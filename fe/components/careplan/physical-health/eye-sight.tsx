import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { eyeSightOptions } from "../../../utils/constants";


function EyeSight() {
    return (
        <div className="pl-[20px]">
            <div>
                Eye Sight - Level of Care:
                <FormSingleRadioSelect 
                    name={"carePlan.physicalHealth.eyeSightCareLevel"} 
                    options={eyeSightOptions}
                />
            </div>
        </div>
    );
}

export default EyeSight;
