import { IonModal } from "@ionic/react";
import {
  INITIAL_MODAL_BREAKPOINT,
  MODAL_BREAKPOINTS,
} from "../../utils/constants";
import { themeType, userPreferencesType } from "../../types/types";
import { MdCheck } from "react-icons/md";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { updateUserPrefs } from "../../utils/helpers";

interface BottomSheetAboutUsProps {
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>;
  triggerId: string;
  setUserPreferences: React.Dispatch<React.SetStateAction<userPreferencesType>>;
  theme: themeType;
  handleTheme: (theme?: themeType) => string;
}

const BottomSheetThemeOptions = ({
  dbConnection,
  triggerId,
  theme,
  setUserPreferences,
}: BottomSheetAboutUsProps) => {
  return (
    <IonModal
      mode="ios"
      expandToScroll={false}
      className="modal-fit-content"
      trigger={triggerId}
      initialBreakpoint={INITIAL_MODAL_BREAKPOINT}
      breakpoints={MODAL_BREAKPOINTS}
    >
      <section className="py-10 theme-sheet-content-wrap">
        {/* <h1 className="modal-header-text">Themes</h1> */}
        <ul className="mx-2 my-5 rounded-none border border-[var(--app-border-color)] bg-[var(--card-bg-color)] notification-ul-wrap overflow-hidden font-mono text-sm">
          {/* Light */}
          <li className="flex justify-between items-center p-3 border-b border-[var(--table-row-border-color)]">
            <button
              aria-pressed={theme === "light"}
              className="w-full text-left cursor-pointer"
              onClick={async () => {
                await updateUserPrefs(
                  dbConnection,
                  "theme",
                  "light",
                  setUserPreferences,
                );
              }}
            >
              Light
            </button>
            {theme === "light" && <MdCheck style={{ color: "var(--accent-color)" }} />}
          </li>

          {/* Dark */}
          <li className="flex justify-between items-center p-3 border-b border-[var(--table-row-border-color)]">
            <button
              aria-pressed={theme === "dark"}
              onClick={async () => {
                await updateUserPrefs(
                  dbConnection,
                  "theme",
                  "dark",
                  setUserPreferences,
                );
              }}
              className="w-full text-left cursor-pointer"
            >
              Dark
            </button>
            {theme === "dark" && <MdCheck style={{ color: "var(--accent-color)" }} />}
          </li>

          {/* OLED Black */}
          <li className="flex justify-between items-center p-3 border-b border-[var(--table-row-border-color)]">
            <button
              aria-pressed={theme === "oled"}
              onClick={async () => {
                await updateUserPrefs(
                  dbConnection,
                  "theme",
                  "oled",
                  setUserPreferences,
                );
              }}
              className="w-full text-left cursor-pointer"
            >
              OLED Black
            </button>
            {theme === "oled" && <MdCheck style={{ color: "var(--accent-color)" }} />}
          </li>

          {/* System */}
          <li className="flex justify-between items-center p-3">
            <button
              aria-pressed={theme === "system"}
              onClick={async () => {
                await updateUserPrefs(
                  dbConnection,
                  "theme",
                  "system",
                  setUserPreferences,
                );
              }}
              className="w-full text-left cursor-pointer"
            >
              System
            </button>
            {theme === "system" && <MdCheck style={{ color: "var(--accent-color)" }} />}
          </li>
        </ul>
      </section>
    </IonModal>
  );
};

export default BottomSheetThemeOptions;
