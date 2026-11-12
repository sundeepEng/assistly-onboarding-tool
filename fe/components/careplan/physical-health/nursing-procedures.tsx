import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { nursingProceduresOptions } from "../../../utils/constants";

function NursingProcedures() {
    return (
        <div className="pl-[20px]">
            <div>
                Nursing Procedures - Level of Care:
                <FormSingleRadioSelect 
                    name={"carePlan.physicalHealth.nursingProceduresCareLevel"} 
                    options={nursingProceduresOptions}
                />
            </div>
        </div>
    );
}

export default NursingProcedures;
