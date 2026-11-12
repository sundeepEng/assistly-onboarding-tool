import _ from "lodash";
import React from "react";
interface Senior {
  medical?: {
    overAllHealth?: {
      alzheimersOrDementia?: string;
    };
  };
  carePlan?: {
    medicationAdministration?: {
      diabeticManagement?: {
        status?: string;
      };
    };
    behaviourPatterns?: {
      wanderingRisk?: string;
      evacuation?: string;
      chokingRisk?: string;
      selfAbusiveBehavior?: string;
      suicidalTendencies?: string;
    };
  };
}

// Disease mapping type
interface DiseaseData {
  name: string;
  label: string;
  color: string;
  textColor: string;
}

// Props should expect a **Senior** object, NOT an array of diseases
interface CircleComponentProps {
  data: Senior;
  alignHorizontal?:boolean
}

const CircleComponent: React.FC<CircleComponentProps> = ({
  data: userData,
  alignHorizontal
}) => {
  const diseaseMapping = [
    // { name: "M", label: "Dementia", color: "#F2B7B4", textColor: "#B3251E" },
    { name: "D", label: "Diabetes", color: "#FFE9E0", textColor: "#000000" },
    {
      name: "W",
      label: "Wandering Risk",
      color: "#D9D9D9",
      textColor: "#FFA503",
    },
    {
      name: "E",
      label: "Evacuation Risk",
      color: "#E9E9F9",
      textColor: "#008000",
    },
    {
      name: "BR",
      label: "Behavior Risk",
      color: "#E6FBF5",
      textColor: "#6A0DAD",
    },
  ];

  // Extract required values using lodash
  // const dementia = _.get(userData, 'medical.overAllHealth.alzheimersOrDementia', 'No');
  const diabetes = _.get(
    userData,
    "carePlan.physicalHealth.diabetisStatus",
    "No"
  );
  const wanderingRisk = _.get(
    userData,
    "carePlan.behaviourPatterns.wanderingRisk",
    false
  );
  const evacuation = _.get(
    userData,
    "carePlan.behaviourPatterns.evacuationAssistance",
    false
  );

  // Behavior risk conditions
  const choking = _.get(userData, "carePlan.physicalHealth.chokingRisk", "No");
  // const abuse = _.get(userData, 'carePlan.behaviourPatterns.selfAbusiveBehavior', 'No');
  // const suicidal = _.get(userData, 'carePlan.behaviourPatterns.suicidalTendencies', 'No');

  const finalDiseases = [];

  // Check conditions and push matching disease details
  // if (String(dementia) === "Yes") finalDiseases.push(diseaseMapping.find(d => d.name === "M"));
  if (String(diabetes) === "Yes")
    finalDiseases.push(diseaseMapping.find((d) => d.name === "D"));
  if (wanderingRisk)
    finalDiseases.push(diseaseMapping.find((d) => d.name === "W"));
  if (evacuation)
    finalDiseases.push(diseaseMapping.find((d) => d.name === "E"));

  if (String(choking) === "Yes") {
    finalDiseases.push(diseaseMapping.find((d) => d.name === "BR"));
  }
  if (finalDiseases?.length === 0) {
    return null;
  }
  return (
    <>
      {finalDiseases?.length > 0 ? (
        <div className="flex h-full">
          <div
            className={`flex ${
              alignHorizontal ? "flex-row" : "flex-col"
            } items-center gap-2 justify-start`}
          >
            {finalDiseases?.map((item, index) => (
              <div key={index} className="relative group">
                <div
                  className={`w-[35px] h-[35px] bg-[${item.color}] rounded-full flex items-center justify-center text-black text-[19px] font-medium`}
                  style={{
                    backgroundColor: item.color,
                  }}
                >
                  {item?.name.toUpperCase()}
                </div>

                {/* Tooltip */}
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300">
                  <div className="relative bg-[#181729] text-white text-xs font-medium px-3 py-1.5 rounded-xl shadow-lg whitespace-nowrap">
                    {item.label}
                    {/* Small Arrow */}

                    <div
                      className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 
  border border-solid border-l-[6px] border-l-transparent 
  border-r-[6px] border-r-transparent 
  border-t-[6px] border-t-[#181729]"
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <></>
      )}
    </>
  );
};

export default CircleComponent;
