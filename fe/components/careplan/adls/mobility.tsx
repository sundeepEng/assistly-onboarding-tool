import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { levelOfCareOptions } from "../../../utils/constants";

function mobility() {
    const basePath = "carePlan.adl"
    return (
        <div>
            <div>
                Mobility-Level of Care:
                <FormSingleRadioSelect
                    name={`${basePath}.mobility.careLevel`}
                    options={levelOfCareOptions}
                />
            </div>
            <div>
            Transfering-Level of Care:
                <FormSingleRadioSelect
                    name={`${basePath}.transferring.careLevel`}
                    options={levelOfCareOptions}
                />
            </div>
        </div>
    );
}

export default mobility;
