export type Senior = {
    biography: any;
    userId: string;
    name: string;
    age: number;
    roomNumber: number;
    image: string;
    profileImageUrl: string;
    mobile?: string;
    clientRate?: number;
    payRate?: number;
    emergencyContact: {
        name: string;
        phone: string;
    };
    clinical: {
        roomNumber: any;
        status: string;
    };
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
    isDeleted?:boolean
};
