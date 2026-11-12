import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { levelOfCareOptions } from "../../../utils/constants";

function toileting() {
    const basePath = "carePlan.adl"
    return (
        <div>
            <div>
                Toileting - Level of Care:
                <FormSingleRadioSelect
                    name={`${basePath}.toileting.careLevel`}
                    options={levelOfCareOptions}
                />
            </div>
        </div>
    );
}

export default toileting;
