import React from "react";
import FormSingleRadioSelect from "../../../commonComponents/form-single-radio-select";
import { booleanOptions } from "../../../utils/constants";

export default function DiabeticsManagement() {
  const basePath = "carePlan.physicalHealth";
  return (
      <div className="pl-[20px]">
          <div>
              Diabetic Status:
              <FormSingleRadioSelect
                  name={`${basePath}.diabetisStatus`}
                  options={booleanOptions}
              />
          </div>
      </div>
  );
}
