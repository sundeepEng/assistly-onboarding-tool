import type { NextPage } from "next";
import Image from "next/image";

export type LeadCardType = {
    className?: string;
};

const LeadCard: NextPage<LeadCardType> = ({ className = "" }) => {
    return (
        <div
            className={`rounded-3xs bg-grays-white flex flex-col items-start justify-start text-left text-lg text-black font-poppins ${className}`}
        >
            <div className="w-[206px] relative shadow-[0px_4px_4px_rgba(0,_0,_0,_0.25)] h-[195px]">
                <div className="absolute top-[0px] left-[0px] rounded-3xs bg-grays-white w-[206px] h-[195px]">
                    <div className="absolute top-[19px] left-[12px] w-[182px] h-[154px]">
                        <div className="absolute top-[0px] left-[0px] w-[182px] h-[50px]">
                            <h1 className="m-0 absolute top-[0px] left-[0px] text-inherit font-medium font-[inherit]">
                                John Doe
                            </h1>
                            <div className="absolute top-[32px] left-[0px] w-[39px] h-[18px] text-5xs text-orange">
                                <div className="absolute top-[3px] left-[2px] font-medium">
                                    INTEREST
                                </div>
                                <div className="absolute top-[0px] left-[0px] rounded-sm bg-orange w-[39px] h-[18px] opacity-[0.15]" />
                            </div>
                        </div>
                        <div className="absolute top-[68px] left-[0px] w-[182px] h-8 text-5xs">
                            <div className="absolute top-[0px] left-[0px] w-[47px] h-[27px]">
                                <div className="absolute top-[15px] left-[2px] font-medium">
                                    11/26/2024
                                </div>
                                <div className="absolute top-[0px] left-[0px] font-medium opacity-[0.5]">
                                    Created On
                                </div>
                            </div>
                            <div className="absolute top-[0px] left-[73px] w-11 h-8">
                                <div className="absolute top-[24px] left-[11px] text-8xs font-medium">
                                    Days Ago
                                </div>
                                <div className="absolute top-[15px] left-[17px] font-medium">
                                    20
                                </div>
                                <div className="absolute top-[0px] left-[0px] font-medium opacity-[0.5]">
                                    Contacted
                                </div>
                            </div>
                            <div className="absolute top-[0px] left-[143px] w-[26px] h-8">
                                <Image
                                    className="absolute top-[20.5px] left-[7px] w-2.5 h-[11.5px]"
                                    loading="lazy"
                                    width={10}
                                    height={12}
                                    alt="hello world"
                                    src="/vector.svg"
                                />
                                <div className="absolute top-[0px] left-[0px] font-medium opacity-[0.5]">
                                    Action
                                </div>
                            </div>
                        </div>
                        <div className="absolute top-[118px] left-[0px] w-[182px] h-9">
                            <div className="absolute top-[0px] left-[0px] w-[181.6px] h-9">
                                <div className="absolute top-[0px] left-[0px] w-[181.6px] h-9">
                                    <div className="absolute top-[0px] left-[0px] w-[181.6px] h-9">
                                        <Image
                                            className="absolute top-[0px] left-[0px] w-9 h-9"
                                            loading="lazy"
                                            width={36}
                                            height={36}
                                            alt=""
                                            src="/initial-contact.svg"
                                        />
                                        <Image
                                            className="absolute top-[0px] left-[46px] w-9 h-9"
                                            loading="lazy"
                                            width={36}
                                            height={36}
                                            alt=""
                                            src="/touring.svg"
                                        />
                                        <Image
                                            className="absolute top-[0px] left-[92px] w-9 h-9"
                                            loading="lazy"
                                            width={36}
                                            height={36}
                                            alt=""
                                            src="/onboarding.svg"
                                        />
                                        <Image
                                            className="absolute top-[0px] left-[138px] w-9 h-9"
                                            loading="lazy"
                                            width={36}
                                            height={36}
                                            alt=""
                                            src="/contract.svg"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeadCard;
