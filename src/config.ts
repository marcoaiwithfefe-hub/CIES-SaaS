export const CONFIG = {
  API_BASE_URL: process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000',
  ENDPOINTS: {
    HKEX: '/api/screenshot',
    SFC: '/api/screenshot-sfc',
    AFRC: '/api/screenshot-afrc',
    AFRC_FIRM: '/api/screenshot-afrc-firm',
  },
  HKEX: {
    URL: 'https://www.hkex.com.hk/Market-Data/Securities-Prices/Equities?sc_lang=zh-HK',
    SELECTORS: {
      COOKIE_BTN: '#onetrust-accept-btn-handler',
      SEARCH_INPUT: 'input[placeholder="代號 / 關鍵字"]',
    },
    LABELS: {
      TITLE: 'HKEX SnapSaaS',
      SUBTITLE: 'Automated financial data capture tool',
      TAB: 'HKEX Equities'
    }
  },
  SFC: {
    URL: 'https://www.sfc.hk/en/Regulatory-functions/Products/List-of-Eligible-Collective-Investment-Schemes-under-new-CIES',
    SELECTORS: {
      TABLE_CONTAINER: '.table-container table',
      EXPAND_ALL_BTN: '.accordin_expand',
      ROW: 'tr'
    },
    LABELS: {
      TITLE: 'SFC CIES Tool',
      SUBTITLE: 'Search the SFC Public Register',
      TAB: 'SFC CIES List'
    }
  },
  AFRC: {
    URL: 'https://armies.afrc.org.hk/registration/armiesweb.WWP_FE_PC_PublicRegisterList.aspx',
    SELECTORS: {
      NAME_INPUT: '#vNAME',
      REG_NO_INPUT: '#vREGNO',
      SEARCH_BTN: '#BTNUA_SEARCH',
      RESULTS_CONTAINER: '#GridContainerDiv',
      FALLBACK_TABLE: 'table.GridWithPaginationBar',
      FALLBACK_BODY: 'body'
    },
    LABELS: {
      TITLE: 'AFRC CPA Register',
      SUBTITLE: 'Search the AFRC Public Register of CPAs (Practising)',
      TAB: 'AFRC CPA (Individual)'
    }
  },
  AFRC_FIRM: {
    URL: 'https://armies.afrc.org.hk/registration/ARMIESWeb.WWP_FE_FMCP_PublicRegisterList.aspx',
    SELECTORS: {
      EN_NAME_INPUT: '#vNAME',
      CH_NAME_INPUT: '#vCHINESENAME',
      REG_NO_INPUT: '#vREGNO',
      SEARCH_BTN: '#BTNUA_SEARCH',
      RESULTS_CONTAINER: '#GridContainerDiv',
      FALLBACK_TABLE: 'table.GridWithPaginationBar',
      FALLBACK_BODY: 'body'
    },
    LABELS: {
      TITLE: 'AFRC CPA (Firm) Register',
      SUBTITLE: 'Search the AFRC Public Register of CPA Firms and Corporate Practices',
      TAB: 'AFRC CPA (Firm)'
    }
  }
};
