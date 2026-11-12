// components/referral-cell.tsx
import React from 'react';
import HoverNotesComponent from '../../commonComponents/hover-notes';
import Avatar from '../../commonComponents/avatar';

interface ReferralCellProps {
  name?: string;
  data?: any;
}

const ReferralCell = ({ name, data }: ReferralCellProps) => {

  return (
    <div className="flex items-center gap-3 pl-[20px] font-jakarta">
      <HoverNotesComponent data={data} >
        <Avatar name={name} size={40} />
      </HoverNotesComponent>
      <div className="fllex items-center h-6 w-[170px] text-base capitalize overflow-hidden text-ellipsis whitespace-nowrap">
        <p
          className="m-0 truncate max-w-[150px] overflow-hidden whitespace-nowrap text-ellipsis cursor-pointer text-s "
          title={name}
        >
          {name.length > 15 ? name.substring(0, 15) + '...' : name}
        </p>
      </div>
    </div>
  );
};

export default ReferralCell;