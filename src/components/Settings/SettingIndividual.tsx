import { MdOutlineChevronRight } from "react-icons/md";

const SettingIndividual = ({
  id,
  headingText,
  subText,
  valueText,
  indvidualStyles,
  onClick,
}: {
  id?: string;
  headingText: string;
  subText?: string;
  valueText?: string;
  indvidualStyles?: string;
  onClick?: () => void;
}) => {
  return (
    <div
      id={id}
      className={`flex items-center justify-between py-3 px-3.5 bg-[#121212] hover:bg-[#161616] transition-colors cursor-pointer ${indvidualStyles || ""}`}
      onClick={onClick}
    >
      <div className="flex flex-col pr-2">
        <p className="text-xs font-mono font-medium text-white tracking-wide">
          {headingText}
        </p>
        {subText && (
          <p className="text-[11px] font-mono text-[#71717A] mt-0.5">
            {subText}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {valueText && (
          <span className="text-xs font-mono text-[#8E8E93]">{valueText}</span>
        )}
        <MdOutlineChevronRight className="text-[#52525B] text-base" />
      </div>
    </div>
  );
};

{
  /* <div className="lds-ellipsis">
<div></div>
<div></div>
<div></div>
<div></div>
</div> */
}

export default SettingIndividual;
