import { useRouter } from 'next/router';
import React, { useState } from 'react'

const TimeOffBalances = () => {
  const [popoverOpen, setPopoverOpen] = useState(false);
    const router=useRouter()
  return (
      <div>
          <div>
              <div className="flex justify-between">
                  <h2>Time Off Balances</h2>
                  <h3
                      onClick={() => setPopoverOpen(!popoverOpen)}
                      className="justify-end text-steelblue underline cursor-pointer"
                  >
                      View all time off
                  </h3>
              </div>
          </div>
          <div className="">
              <div>
                  No time off added for Tejaswini yet. Visit the Time Off
                  manager to add Tejaswini to a policy, submit time off, and
                  more.
              </div>
          </div>
      </div>
  );
}

export default TimeOffBalances;