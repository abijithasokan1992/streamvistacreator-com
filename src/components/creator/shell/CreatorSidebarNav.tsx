import { NavLink, useLocation } from "react-router-dom";
import {
  Film,
  UploadCloud,
  Radio,
  Store,
  Handshake,
  DollarSign,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export interface CreatorNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: "Studio" | "Marketplace" | "Account";
}

export const CREATOR_NAV: CreatorNavItem[] = [
  { to: "/creator/catalog", label: "Catalog", icon: Film, group: "Studio" },
  { to: "/creator/deliveries", label: "Deliveries", icon: UploadCloud, group: "Studio" },
  { to: "/creator/distribution", label: "Distribution", icon: Radio, group: "Studio" },
  { to: "/creator/marketplace", label: "Marketplace", icon: Store, group: "Marketplace" },
  { to: "/creator/deals", label: "Deals & Rights", icon: Handshake, group: "Marketplace" },
  { to: "/creator/revenue", label: "Revenue", icon: DollarSign, group: "Marketplace" },
  { to: "/creator/insights", label: "Insights", icon: BarChart3, group: "Account" },
  { to: "/creator/settings", label: "Settings & Team", icon: Settings, group: "Account" },
];

const GROUPS: CreatorNavItem["group"][] = ["Studio", "Marketplace", "Account"];

export function CreatorSidebarNav() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {GROUPS.map((group) => {
          const items = CREATOR_NAV.filter((i) => i.group === group);
          return (
            <SidebarGroup key={group}>
              {!collapsed && (
                <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.22em]">
                  {group}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const active = pathname === item.to || pathname.startsWith(item.to + "/");
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <NavLink to={item.to} className="flex items-center gap-2">
                            <item.icon className="h-4 w-4 shrink-0" />
                            {!collapsed && <span className="truncate">{item.label}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
