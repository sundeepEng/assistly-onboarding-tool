import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { levelOfCareOptions } from "../../../utils/constants";

function grooming() {
    return (
        <div className="pl-[20px]">
            <div>
                Grooming - Level of Care:
                <FormSingleRadioSelect
                    name={"carePlan.adl.grooming.careLevel"}
                    options={levelOfCareOptions}
                />
            </div>
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

export default grooming;
