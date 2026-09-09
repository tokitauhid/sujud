import { MdOutlineChevronRight } from "react-icons/md";

const SettingIndividual = ({
  id,
  headingText,
  subText,
  indvidualStyles,
  onClick,
}: {
  id?: string;
  headingText: string;
  subText: string;
  indvidualStyles?: string;
  onClick?: () => void;
}) => {
  return (
    <div
      id={id}
      style={{ borderTopRightRadius: indvidualStyles }}
      className={`flex items-center justify-between py-3 individual-setting-wrap bg-[var(--card-bg-color)] border border-[var(--app-border-color)] mx-auto px-1 rounded-xl ${indvidualStyles}`}
      onClick={onClick}
    >
      <div className="mx-3">
        <p className="support-main-text-heading pt-[0.3rem] pb-[0.1rem] text-[0.95rem] font-medium">
          {headingText}
        </p>
        <p className="support-sub-text pt-[0.3rem] pb-[0.1rem] text-[0.78rem] font-light opacity-60">
          {subText}
        </p>
      </div>

      <MdOutlineChevronRight className="chevron text-[var(--accent-color)] opacity-50 mr-1" />
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
