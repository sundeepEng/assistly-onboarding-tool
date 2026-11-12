import { NextPage } from "next";

interface Props {
    active?: boolean;
}

const NurseLeadIcon: NextPage<Props> = ({ active }) => {
    const color = active ? "indigo" : "#C8C8CC";

    return (
        <div>
            <svg
                width="90"
                height="90"
                viewBox="0 0 52 52"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Ribbon */}
                <path
                    d="M47.6489 3.99988H36.351C35.3554 3.99988 34.5098 4.80291 34.5098 5.84116V22.5468C34.5127 23.8646 36.1223 24.483 37.0374 23.5579L41.3438 19.2527C41.6889 18.8927 42.311 18.8927 42.6561 19.2527L46.9625 23.5579C47.878 24.4833 49.4874 23.864 49.4901 22.5468V5.84116C49.4901 4.80291 48.6445 3.99988 47.6489 3.99988ZM48.3182 22.5469C48.3167 22.8259 47.9699 22.918 47.7905 22.7285C46.9296 21.8663 44.4745 19.4119 43.4856 18.4249C42.7077 17.6113 41.2934 17.611 40.5158 18.4233C39.8327 19.1051 38.4956 20.4419 37.4415 21.4956L36.2152 22.7213C36.0385 22.9088 35.6874 22.8462 35.6817 22.5575V5.84116C35.6817 5.46683 35.9851 5.17185 36.351 5.17185H47.6488C48.0142 5.17185 48.3182 5.46637 48.3182 5.84116V22.5469Z"
                    fill={color}
                />

                {/* Ribbon medical cross */}
                <path
                    d="M42 8.2V14.1"
                    stroke={color}
                    strokeWidth={1.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M39.05 11.15H44.95"
                    stroke={color}
                    strokeWidth={1.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                <defs>
                    <mask
                        id="mask_nurse_lead"
                        maskUnits="userSpaceOnUse"
                        x={0}
                        y={-1}
                        width={31}
                        height={28}
                    >
                        <path d="M0 0H30.5V26.6664H0V0Z" fill="white" />
                    </mask>
                </defs>

                <g mask="url(#mask_nurse_lead)">
                    {/* Nurse cap */}
                    <path
                        d="M8.209 6.295C8.83 4.75 10.474 3.73 12.386 3.73C14.298 3.73 15.942 4.75 16.563 6.295C16.692 6.615 16.466 6.965 16.121 6.965H8.651C8.306 6.965 8.08 6.615 8.209 6.295Z"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M12.386 4.87V6.32"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M11.66 5.595H13.112"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Hair / head outline */}
                    <path
                        d="M7.637 10.077C7.637 7.638 9.762 5.97 12.386 5.97C15.01 5.97 17.135 7.638 17.135 10.077V11.234C17.135 13.895 15.166 16.058 12.386 16.058C9.606 16.058 7.637 13.895 7.637 11.234V10.077Z"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Face details */}
                    <path
                        d="M10.45 10.78C10.78 10.55 11.16 10.55 11.49 10.78"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M13.28 10.78C13.61 10.55 13.99 10.55 14.32 10.78"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M11.28 13.38C11.91 13.86 12.86 13.86 13.49 13.38"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Neck */}
                    <path
                        d="M10.66 15.54L10.46 16.78C10.4 17.15 10.56 17.52 10.86 17.74C11.21 18 11.72 18.24 12.386 18.24C13.052 18.24 13.563 18 13.913 17.74C14.213 17.52 14.373 17.15 14.313 16.78L14.113 15.54"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Body / scrub top */}
                    <path
                        d="M6.09 23.145H18.682C19.083 23.145 19.408 22.82 19.408 22.419V20.37C19.408 18.975 18.543 17.724 17.236 17.233L14.385 16.162"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M10.387 16.162L7.536 17.233C6.229 17.724 5.364 18.975 5.364 20.37V22.419C5.364 22.82 5.689 23.145 6.09 23.145Z"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* V-neck */}
                    <path
                        d="M10.18 17.16L12.386 20.12L14.592 17.16"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M12.386 20.12V23.04"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Stethoscope */}
                    <path
                        d="M8.21 18.95V20.42C8.21 21.13 8.79 21.71 9.5 21.71C10.21 21.71 10.79 21.13 10.79 20.42V19.64"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M16.56 18.95V20.42C16.56 21.13 15.98 21.71 15.27 21.71C14.56 21.71 13.98 21.13 13.98 20.42V19.64"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <circle
                        cx={12.386}
                        cy={21.57}
                        r={0.72}
                        stroke={color}
                        strokeMiterlimit={10}
                    />

                    {/* Second person / lead team member */}
                    <path
                        d="M23.12 10.08C24.89 10.08 26.325 11.535 26.325 13.33V14.02C26.325 15.945 24.917 17.508 23.12 17.508C21.323 17.508 19.915 15.945 19.915 14.02V13.33C19.915 11.535 21.35 10.08 23.12 10.08Z"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M20.03 13.03C20.74 12.96 21.65 12.62 22.12 11.77C22.96 12.6 24.36 13.03 26.19 13.03"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M21.84 17.12L21.67 18.04"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M24.4 17.12L24.57 18.04"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M19.15 23.145H28.155C28.529 23.145 28.832 22.842 28.832 22.468V20.91C28.832 19.595 27.922 18.455 26.64 18.165L24.57 17.695L23.12 20.38L21.67 17.695L19.6 18.165"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M23.12 20.38V23.02"
                        stroke={color}
                        strokeMiterlimit={10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </g>
            </svg>
        </div>
    );
};

export default NurseLeadIcon;
