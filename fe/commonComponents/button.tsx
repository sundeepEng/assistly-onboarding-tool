'use client'
import React from "react";
import { NextPage } from "next";
import { TailSpin } from "react-loader-spinner";

interface ButtonProps {
    name: string;
    classname?: string;
    buttonClick?: () => void;
    isLoading?: boolean;
    type?: "submit" | "button";
    icon?: React.ReactElement;
    titleClass?: string;
    iconStart?: boolean;
    disabled?: boolean;
}

const Button: NextPage<ButtonProps> = ({
    name,
    classname = "",
    buttonClick,
    isLoading,
    type = "submit",
    icon,
    titleClass = "",
    iconStart = true,
    disabled = false,
}) => {
    return (
        <button
            type={type}
            className={`flex justify-center align-center items-center content-center gap-4 cursor-pointer border-none h-[40px] px-[20px] bg-secondarymirage rounded-lg hover:bg-skyblue font-base ${disabled ? "!cursor-not-allowed":""} ${classname}`}
            onClick={buttonClick}
            disabled={disabled|| isLoading}
        >
            <div
                className={`flex ${
                    iconStart ? "flex-row-reverse" : "flex-row"
                } items-center gap-2`}
            >
                <div
                    className={`flex text-base font-semibold font-jakarta text-grays-white ${titleClass}`}
                >
                    {name}
                </div>
                {icon && <div>{icon}</div>}
                {isLoading && (
                    <div>
                        {isLoading && (
                            <TailSpin
                                height={20}
                                width={30}
                                color="white"
                                strokeWidth="4px"
                            />
                        )}
                    </div>
                )}
            </div>
        </button>
    );
};

export default Button;
