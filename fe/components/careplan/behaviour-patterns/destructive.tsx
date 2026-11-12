import React from 'react'
import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { booleanOptions } from "../../../utils/constants";

export default function Destructive() {
  return (
    <div className="pl-[20px]">
        <div>
        Destructive/Abusive:
          <FormSingleRadioSelect
            name={"carePlan.behaviourPatterns.destructiveAbusive"}
            options={booleanOptions}
          />
        </div>
        </div>
  )
}
