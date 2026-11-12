import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { levelOfCareOptions } from "../../../utils/constants";

function continence() {
    return (
        <div className="pl-[20px]">
            <div>
                Continence - Level of Care:
                <FormSingleRadioSelect
                    name={"carePlan.adl.continence.careLevel"}
                    options={levelOfCareOptions}
                />
            </div>
            <div>
                Toileting - Level of Care:
                <FormSingleRadioSelect
                    name={`carePlan.adl.toileting.careLevel`}
                    options={levelOfCareOptions}
                />
            </div>
        </div>
    );
}

export default continence;
