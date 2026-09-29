import type { ThemeConfig } from 'antd';

export const appTheme: ThemeConfig = {
  cssVar: { prefix: 'ant' },

  token: {
    colorPrimary: '#7700FF',
    colorPrimaryHover: '#9466FF',

    purple: '#9466FF',
    orange: '#FF4F12',

    colorFillSecondary: '#FAF7FF',

    colorText: '#252632',
    colorTextSecondary: '#8C8FA3',

    colorBgBase: '#FFFFFF',
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#F7F8FC',

    colorBorder: '#E7E9F1',
    colorBorderSecondary: '#EFF0F5',

    colorSuccess: '#22C55E',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',

    colorLink: '#7700FF',
    colorLinkHover: '#9466FF',
    colorLinkActive: '#7700FF',

    borderRadius: 6,
    borderRadiusLG: 8,

    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 14,

    controlHeight: 36,
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
      lightTriggerColor: '#7700FF',

      triggerHeight: 48,
    },

    Menu: {
      itemBg: 'transparent',

      itemColor: '#9295A8',

      itemHoverColor: '#7700FF',
      itemHoverBg: '#F5F0FF',

      itemSelectedColor: '#7700FF',
      itemSelectedBg: '#EFE5FF',

      itemBorderRadius: 6,
      itemHeight: 40,

      iconSize: 16,

      itemMarginInline: 8,
      itemMarginBlock: 4,
    },

    Card: {
      colorBgContainer: '#FFFFFF',
      borderRadiusLG: 8,
      boxShadowTertiary: '0 2px 8px rgba(37, 38, 50, 0.05)',
    },

    Button: {
      borderRadius: 6,

      primaryShadow: 'none',
      defaultShadow: 'none',

      defaultHoverColor: '#7700FF',
      defaultHoverBorderColor: '#9466FF',

      textTextColor: '#7700FF',
      textTextHoverColor: '#9466FF',
      textTextActiveColor: '#7700FF',
    },

    Input: {
      activeBorderColor: '#7700FF',
      hoverBorderColor: '#9466FF',

      activeShadow: '0 0 0 2px rgba(119, 0, 255, 0.08)',
    },

    Select: {
      activeBorderColor: '#7700FF',
      hoverBorderColor: '#9466FF',

      optionSelectedBg: '#F5F0FF',
      optionSelectedColor: '#7700FF',
    },

    Table: {
      headerBg: 'transparent',
      headerColor: '#777A8C',

      headerSortActiveBg: '#FAF7FF',
      headerSortHoverBg: '#FAF7FF',
      fixedHeaderSortActiveBg: '#FAF7FF',

      bodySortBg: '#FAF7FF',

      borderColor: '#ECEEF4',

      rowHoverBg: '#FAF7FF',
      rowExpandedBg: 'transparent',

      expandIconBg: 'transparent',
    },

    Tabs: {
      inkBarColor: '#7700FF',

      itemSelectedColor: '#7700FF',
      itemHoverColor: '#9466FF',
      itemActiveColor: '#7700FF',
    },
  },
};
