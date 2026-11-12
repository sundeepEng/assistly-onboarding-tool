import React from 'react'
import Avatar from '../../commonComponents/avatar';

const ComplianceGuestCell = ({ row }) => {
  return (
    <div className="flex items-center gap-3 pl-[20px] font-jakarta">
      <Avatar src={row?.profileImageUrl} name={row?.name} size={40} />
      <div className="flex items-center h-6 w-[170px] text-base capitalize overflow-hidden text-ellipsis whitespace-nowrap">
        <p
          className="m-0 truncate max-w-[150px] overflow-hidden whitespace-nowrap text-ellipsis cursor-pointer text-s"
          title={row?.name} // Shows full name on hover
        >
          {row?.name?.length > 15
            ? `${row?.name.substring(0, 15)}...`
            : row?.name}
        </p>
      </div>
    </div>
  )
}

export default ComplianceGuestCell