import React from 'react'
import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { booleanOptions } from "../../../utils/constants";

export default function SelfAbusiveBehaviour() {
  return (
    <div className="pl-[20px]">
        <div>
          Self-Abusive Behaviour:
          <FormSingleRadioSelect
            name={"carePlan.behaviourPatterns.selfAbusiveBehavior"}
            options={booleanOptions}
          />
        </div>
        </div>
  )
}
