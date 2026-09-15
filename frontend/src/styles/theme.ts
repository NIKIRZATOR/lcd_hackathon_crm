import type { ThemeConfig } from 'antd';

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#6941E8',

    colorText: '#252632',
    colorTextSecondary: '#8C8FA3',

    colorBgBase: '#FFFFFF',
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#F7F8FC',

    colorBorder: '#E7E9F1',
    colorBorderSecondary: '#EFF0F5',

    borderRadius: 6,
    borderRadiusLG: 8,

    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',

    fontSize: 14,

    controlHeight: 36,

    colorSuccess: '#22C55E',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
  },

  components: {
    Layout: {
      bodyBg: '#F7F8FC',

      headerBg: '#FFFFFF',
      headerColor: '#252632',
      headerHeight: 64,
      headerPadding: '0 24px',

      siderBg: '#F8F8FC',

      lightSiderBg: '#F8F8FC',
      lightTriggerBg: '#F8F8FC',
      lightTriggerColor: '#6941E8',

      triggerHeight: 48,
    },

    Menu: {
      itemBg: 'transparent',

      itemColor: '#9295A8',
      itemHoverColor: '#6941E8',
      itemHoverBg: '#F1EDFF',

      itemSelectedColor: '#6941E8',
      itemSelectedBg: '#E9E3FF',

      itemBorderRadius: 6,
      itemHeight: 40,

      iconSize: 16,

      itemMarginInline: 8,
      itemMarginBlock: 4,
    },

    Card: {
      colorBgContainer: '#FFFFFF',
      borderRadiusLG: 8,
      boxShadowTertiary: '0 2px 8px rgba(35, 32, 58, 0.05)',
    },

    Button: {
      borderRadius: 6,
      primaryShadow: 'none',
      defaultShadow: 'none',
    },

    Input: {
      activeBorderColor: '#6941E8',
      hoverBorderColor: '#8061EA',
      activeShadow: '0 0 0 2px rgba(105, 65, 232, 0.08)',
    },

    Select: {
      activeBorderColor: '#6941E8',
      hoverBorderColor: '#8061EA',

      optionSelectedBg: '#EEE9FF',
      optionSelectedColor: '#6941E8',
    },

    Table: {
      headerBg: '#F8F8FC',
      headerColor: '#777A8C',
      borderColor: '#ECEEF4',
      rowHoverBg: '#FAF9FF',
    },

    Tabs: {
      inkBarColor: '#6941E8',
      itemSelectedColor: '#6941E8',
      itemHoverColor: '#8061EA',
    },
  },
};
