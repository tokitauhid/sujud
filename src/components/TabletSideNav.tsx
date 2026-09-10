import { useLocation, useHistory } from "react-router-dom";
import { IonIcon } from "@ionic/react";
import {
  homeOutline,
  home,
  statsChartOutline,
  statsChart,
  timeOutline,
  time,
  settingsOutline,
  settings,
} from "ionicons/icons";

const tabs = [
  {
    path: "/HomePage",
    label: "TRACKER",
    iconOutline: homeOutline,
    iconFilled: home,
  },
  {
    path: "/StatsPage",
    label: "STATS",
    iconOutline: statsChartOutline,
    iconFilled: statsChart,
  },
  {
    path: "/SalahTimesPage",
    label: "PRAYERS",
    iconOutline: timeOutline,
    iconFilled: time,
  },
  {
    path: "/SettingsPage",
    label: "CONFIG",
    iconOutline: settingsOutline,
    iconFilled: settings,
  },
];

const triggerHaptic = () => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(10);
  }
};

const TabletSideNav = () => {
  const location = useLocation();
  const history = useHistory();

  return (
    <nav className="tablet-side-nav">
      <div className="tablet-side-nav-inner">
        {tabs.map((tab) => {
          const isActive =
            location.pathname === tab.path ||
            (tab.path === "/HomePage" && location.pathname === "/");
          return (
            <button
              key={tab.path}
              className={`tablet-side-nav-btn ${isActive ? "active" : ""}`}
              onClick={() => {
                triggerHaptic();
                history.push(tab.path);
              }}
              aria-label={tab.label}
            >
              {isActive && (
                <div className="tablet-side-nav-active-bar" />
              )}
              <IonIcon
                icon={isActive ? tab.iconFilled : tab.iconOutline}
                className="tablet-side-nav-icon"
              />
              <span className="tablet-side-nav-label">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default TabletSideNav;

