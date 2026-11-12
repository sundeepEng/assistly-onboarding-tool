import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { booleanOptions } from "../../../utils/constants";

export default function Choking() {
    return (
        <div className="pl-[20px]">
            <div>
                Choking Risk:
                <FormSingleRadioSelect
                    name={"carePlan.physicalHealth.chokingRisk"}
                    options={booleanOptions}
                />
            </div>
        </div>
    );
}
