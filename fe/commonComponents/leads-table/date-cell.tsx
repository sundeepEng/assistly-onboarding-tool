export default function DateCell({ date }:{date:Date}) {
    return (
        <div className="w-[174px] flex flex-row items-center justify-center p-2.5 box-border">
            <div className="relative inline-block min-w-[80px]">
                {date.toLocaleDateString()}
            </div>
        </div>
    );
}
