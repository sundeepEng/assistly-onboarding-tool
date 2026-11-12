import React from 'react';

interface WarningIconProps {
  fill?: string;    // Optional prop to customize the fill color
  height?: number | string; // Optional prop to customize the height
  width?: number | string;  // Optional prop to customize the width
}

const WarningIcon: React.FC<WarningIconProps> = ({ fill = "#F2D307", height = 46, width = 45 }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 45 46"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20.8075 7.05713C20.698 7.08739 19.9413 7.26901 19.115 7.46071C4.61943 10.8307 2.7577 31.5952 16.3971 37.8307C32.7643 45.3071 46.8318 23.6547 33.7201 11.1838C30.5243 8.14681 23.9336 6.03807 20.8075 7.05713ZM26.5121 10.4674C35.7511 13.3228 38.917 24.8755 32.4159 31.9887C25.3274 39.7376 12.7533 36.2264 10.344 25.8139C8.18359 16.5313 17.5022 7.69278 26.5121 10.4674Z"
        fill={fill} // Use the fill prop here
      />
      <path
        d="M21.9026 15.4297C21.6835 15.6516 21.5043 15.9947 21.4944 16.1864C21.4347 19.1225 21.5641 24.2481 21.7134 24.5407C22.0917 25.2469 23.5055 25.2772 24.1824 24.6012C24.7798 23.9857 24.6305 16.1561 24.0032 15.5205C23.3959 14.905 22.4601 14.8646 21.9026 15.4297Z"
        fill={fill} // Use the fill prop here
      />
      <path
        d="M21.6338 27.5984C20.1802 28.7789 21.0663 31.1802 22.9678 31.16C23.8539 31.16 24.2123 30.9582 24.7499 30.1712C25.9944 28.3349 23.386 26.1757 21.6338 27.5984Z"
        fill={fill} // Use the fill prop here
      />
    </svg>
  );
};

export default WarningIcon;
