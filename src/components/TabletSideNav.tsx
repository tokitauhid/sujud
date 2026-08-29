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
    label: "Home",
    iconOutline: homeOutline,
    iconFilled: home,
  },
  {
    path: "/StatsPage",
    label: "Stats",
    iconOutline: statsChartOutline,
    iconFilled: statsChart,
  },
  {
    path: "/SalahTimesPage",
    label: "Salah Times",
    iconOutline: timeOutline,
    iconFilled: time,
  },
  {
    path: "/SettingsPage",
    label: "Settings",
    iconOutline: settingsOutline,
    iconFilled: settings,
  },
];

const TabletSideNav = () => {
  const location = useLocation();
  const history = useHistory();

  return (
    <nav className="tablet-side-nav">
      <div className="tablet-side-nav-inner">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              className={`tablet-side-nav-btn ${isActive ? "active" : ""}`}
              onClick={() => history.push(tab.path)}
              aria-label={tab.label}
            >
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
