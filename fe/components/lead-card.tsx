import type { NextPage } from 'next'
import Image from 'next/image'
import Stage from '../commonComponents/stage'

export type Lead = {
  name: string
  interest: string
  createdOn: string
  contactedDaysAgo: number
}

export type LeadCardProps = {
  lead: Lead
  className?: string
}

const LeadCard: NextPage<LeadCardProps> = ({ lead, className = '' }) => {
  return (
    <div
      className={`rounded-3xs bg-red-300 h-[215px] flex flex-col items-start justify-start text-left text-lg text-grays-black font-poppins ${className}`}
    >
      <div className="w-[240px] rounded-3xs relative shadow-[0px_4px_4px_rgba(0,_0,_0,_0.25)] h-[215px] ">
        <div className="absolute top-[0px] left-[0px] rounded-3xs bg-grays-white w-[240px] h-[215px]">
          <div className="absolute top-[19px] left-[12px] w-[250px] h-[195px]">
            <div className="absolute  top-[0px] left-[0px] w-[182px] h-[30px]">
              <h1 className="m-0 absolute top-[0px] left-[0px]  font-medium text-[20px] ">{lead.name}</h1>
              <div className="absolute top-[32px] left-[0px] w-[39px] h-[18px] text-5xs text-orange ">
                <div className="absolute top-[3px] left-[2px] font-poppins text-[12px] bg-[#FFA500] bg-opacity-20 p-[1px] text-[#FFA500] rounded-[2px]">{lead.interest}</div>
                <div className="absolute top-[0px] left-[0px] rounded-sm bg-orange w-[39px] h-[18px] opacity-[0.15]" />
              </div>
            </div>
            <div className="absolute top-[68px] left-[0px] w-[210px]  h-[60px] text-5xs">
              <div className="absolute top-[0px] left-[0px] w-[75px]  h-[27px]">
                <div className="absolute top-[25px] left-[2px] font-medium text-[12px]">{lead.createdOn}</div>
                <div className="absolute top-[0px] left-[0px] font-medium text-[12px] opacity-[0.5]">Created On</div>
              </div>
              <div className="absolute top-[0px] left-[73px]  w-[80px] h-8">
                <div className="absolute top-[40px] left-[23px]  font-medium text-[8px]">Days Ago</div>
                <div className="absolute top-[25px] left-[35px] font-medium text-[12px]">{lead.contactedDaysAgo}</div>
                <div className="absolute top-[0px] left-[15px] font-medium opacity-[0.5] text-[12px]">Contacted</div>
              </div>
              <div className="absolute top-[0px] left-[143px] w-[26px] h-8">
                <Image
                  className="absolute top-[25px] left-[35px] w-6 h-[22px]"
                  loading="lazy"
                  width={30}
                  height={30}
                  alt=""
                  src="/vector.svg"
                />
                <div className="absolute top-[0px] left-[28px] font-medium opacity-[0.5] text-[12px]">Action</div>
              </div>
            </div>
            <div className="absolute top-[140px] left-[0px] w-[182px] h-9">
              <div className="absolute top-[0px] left-[0px] w-[181.6px] h-9">
                <div className="absolute top-[0px] left-[0px] w-[181.6px] h-9">
                  <div className="absolute top-[0px] left-[0px] w-[181.6px] h-9">
                    <Stage/>  
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const LeadList: NextPage = () => {
  //TODO: replace below dummy data with api response data
  const leads: Lead[] = [
    {
      name: 'Tom Harry',
      interest: 'INTEREST',
      createdOn: '11/26/2024',
      contactedDaysAgo: 20
    },
    {
      name: 'Linda Taylor',
      interest: 'INTEREST',
      createdOn: '11/26/2024',
      contactedDaysAgo: 20
    },
    {
      name: 'Robert Miller',
      interest: 'INTEREST',
      createdOn: '11/26/2024',
      contactedDaysAgo: 20
    },
    {
      name: 'Olga Koz',
      interest: 'INTEREST',
      createdOn: '11/26/2024',
      contactedDaysAgo: 20
    },
    {
      name: 'Seneca Johns',
      interest: 'INTEREST',
      createdOn: '11/26/2024',
      contactedDaysAgo: 20
    },
    {
      name: 'Marry Sulivian',
      interest: 'INTEREST',
      createdOn: '11/26/2024',
      contactedDaysAgo: 20
    },
    {
      name: 'William Haggerty',
      interest: 'INTEREST',
      createdOn: '11/26/2024',
      contactedDaysAgo: 20
    }
  ]

  return (
    <div className="flex h-full bg-[#FAFAFA] p-[30px] flex-wrap gap-6 ">
      {leads.map((lead, index) => (
        <LeadCard key={index} lead={lead} />
      ))}
    </div>
  )
}

export default LeadList
