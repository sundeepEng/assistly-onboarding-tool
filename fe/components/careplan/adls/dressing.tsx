import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { levelOfCareOptions } from "../../../utils/constants";

function dressing() {
    return (
        <div className="pl-[20px]">
            <div>
                Dressing - Level of Care:
                <FormSingleRadioSelect
                    name={"carePlan.adl.dressing.careLevel"}
                    options={levelOfCareOptions}
                />
            </div>
        </div>
    );
}

export default dressing;
