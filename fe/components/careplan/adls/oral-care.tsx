import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { levelOfCareOptions } from "../../../utils/constants";

function oralcare() {
    return (
        <div>
            Oral Care - Level of Care:
            <FormSingleRadioSelect
                name={"carePlan.adl.oralCare.careLevel"}
                options={levelOfCareOptions}
            />
        </div>
    );
}

export default oralcare;
