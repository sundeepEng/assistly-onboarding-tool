export default function DropdownIcon({isDropdownOpen=false,color="#9C9999"}) {
    return (
        <div>
            <svg
                className= {`${isDropdownOpen?"transform rotate-180":""}`}
                width="18"
                height="8"
                viewBox="0 0 12 5"
                fill={color}
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M0.600098 1.07556L1.87315 0.226562L6.0019 3.02826L10.127 0.226562L11.4001 1.07556L6.0019 4.72656L0.600098 1.07556Z"
                    fill={color}
                />
            </svg>
        </div>
    );
}
