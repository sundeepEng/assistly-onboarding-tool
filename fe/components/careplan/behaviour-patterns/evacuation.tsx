import React from 'react'
import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { booleanOptions } from "../../../utils/constants";

export default function Evacuation() {
  return (
      <div className="pl-[20px]">
          <div>
              Evacuation Assistance:
              <FormSingleRadioSelect
                  name={"carePlan.behaviourPatterns.evacuationAssistance"}
                  options={booleanOptions}
              />
          </div>
      </div>
  );
}
