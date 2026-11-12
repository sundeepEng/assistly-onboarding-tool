import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { levelOfCareOptions } from "../../../utils/constants";

function bathing() {
    return (
        <div className="pl-[20px]">
                <div>
                    Bathing - Level of Care:
                    <FormSingleRadioSelect
                        name={"carePlan.adl.bathing.careLevel"}
                        options={levelOfCareOptions}
                    />
                </div>
        </div>
    );
}

export default bathing;
