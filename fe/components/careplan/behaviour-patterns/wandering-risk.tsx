import React from 'react'
import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { booleanOptions } from "../../../utils/constants";

export default function WanderingRisk() {
  const basePath = "carePlan.behaviourPatterns"
  return (
    <div className="pl-[20px]">
        <div>
          Wandering Risk:
          <FormSingleRadioSelect
            name={`${basePath}.wanderingRisk`}
            options={booleanOptions}
          />
        </div>
    </div>
  )
}




