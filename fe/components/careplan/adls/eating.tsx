import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { levelOfCareOptions, booleanOptions } from "../../../utils/constants";


function eating() {
    const basePath = "carePlan.adl";
    return (
        <div>
            <div className="pl-[20px]">
                <div>
                    Eating - Level of Care:
                    <FormSingleRadioSelect
                        name={`${basePath}.eating.careLevel`}
                        options={levelOfCareOptions}
                    />
                </div>

            </div>
        </div>
    );
}

export default eating;
