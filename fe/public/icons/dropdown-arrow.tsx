const DropdownArrow = ({ isOpen = false }) => {
  const rotationDegree = isOpen ? "180deg" : "0deg";

  return (
    <svg
      width="8"
      height="4"
      viewBox="0 0 8 4"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transform: `rotate(${rotationDegree})`,
        transition: "transform 0.2s ease",
      }}
    >
      <path d="M8 0L4 3.987L0 0H8Z" fill="white" />
    </svg>
  );
};

export default DropdownArrow;
