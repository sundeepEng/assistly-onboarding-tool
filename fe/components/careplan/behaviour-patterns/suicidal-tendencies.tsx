import React from 'react'
import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { booleanOptions } from "../../../utils/constants";

export default function SuicidalTendencies() {
  return (
    <div className="pl-[20px]">
        <div>
        Suicidal Tendencies:
          <FormSingleRadioSelect
            name={"carePlan.behaviourPatterns.suicidalTendencies"}
            options={booleanOptions}
          />
        </div>
        </div>
  )
}
