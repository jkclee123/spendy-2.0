import { useLocation } from "react-router-dom";
import { Wallet, PieChart, PlusCircle, LayoutGrid, Settings, type LucideIcon } from "lucide-react";
import { NavigationLink } from "@/components/ui/NavigationLink";
import { useTranslation } from "react-i18next";

interface NavItem {
  href: string;
  key: "transactions" | "charts" | "create" | "categories" | "settings";
  icon: LucideIcon;
  exact?: boolean;
}

const navItems: NavItem[] = [
  { href: "/transactions", key: "transactions", icon: Wallet },
  { href: "/charts", key: "charts", icon: PieChart },
  { href: "/transactions/create", key: "create", icon: PlusCircle },
  { href: "/categories", key: "categories", icon: LayoutGrid },
  { href: "/settings", key: "settings", icon: Settings, exact: true },
];

interface NavLinkProps {
  item: NavItem;
  isActive: boolean;
  label: string;
  showLabel?: boolean;
  isDesktop?: boolean;
}

function NavLink({ item, isActive, label, showLabel = true, isDesktop = false }: NavLinkProps) {
  const Icon = item.icon;

  return (
    <NavigationLink
      href={item.href}
      className={`
        flex min-w-[44px] items-center
        rounded-2xl justify-start
        ${
          isDesktop
            ? "flex-row w-[calc(100%-8px)] transition-all duration-200 pl-[24px] gap-0 group-hover:gap-3 py-2"
            : "flex-col gap-1 mt-1 pt-2 pb-2 px-3"
        }
        ${
          isActive
            ? "text-accent-500 dark:text-accent-400 bg-gray-300 dark:bg-gray-800"
            : "text-gray-800 dark:text-gray-100 hover:text-black dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-800"
        }
      `}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-7 w-7 shrink-0" strokeWidth={isActive ? 1.5 : 1} />
      {showLabel && (
        <span
          className={`
            whitespace-nowrap
            ${
              isDesktop
                ? "text-md ml-1 font-medium max-w-0 overflow-hidden opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 transition-all duration-200"
                : "text-[10px] leading-tight font-medium mt-0.5"
            }
          `}
        >
          {label}
        </span>
      )}
    </NavigationLink>
  );
}

export function NavigationBar({ isLanguageReady = true }: { isLanguageReady?: boolean }) {
  const { pathname } = useLocation();
  const { t } = useTranslation("nav");

  const getIsActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    if (item.href === "/transactions") {
      return pathname === "/transactions" || pathname.startsWith("/transactions/update");
    }
    return pathname.startsWith(item.href);
  };

  return (
    <>
      {/* Mobile Bottom Navigation */}
      {isLanguageReady && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-200/80 backdrop-blur-md dark:bg-gray-900/80 lg:hidden pb-safe">
          <div className="flex h-[5rem] items-start justify-around">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={getIsActive(item)}
                label={t(item.key)}
              />
            ))}
          </div>
        </nav>
      )}

      {/* Desktop Side Navigation */}
      <nav className="fixed left-0 top-0 z-20 hidden h-screen w-[5.2rem] hover:w-[200px] flex-col border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-950 lg:flex group transition-all duration-300 overflow-hidden">
        <div className="flex flex-1 flex-col items-start justify-center gap-8 py-4 pl-[4px]">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={getIsActive(item)}
              label={t(item.key)}
              showLabel={true}
              isDesktop={true}
            />
          ))}
        </div>
      </nav>
    </>
  );
}
