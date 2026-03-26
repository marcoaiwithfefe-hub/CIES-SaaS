/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import HkexPanel from './components/HkexPanel';
import SfcPanel from './components/SfcPanel';
import AfrcPanel from './components/AfrcPanel';
import AfrcFirmPanel from './components/AfrcFirmPanel';
import { DashboardLayout, TabType } from './components/shared/DashboardLayout';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('hkex');
  const [isMockMode, setIsMockMode] = useState(true);

  return (
    <DashboardLayout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      isMockMode={isMockMode}
      setIsMockMode={setIsMockMode}
    >
      <div className={activeTab === 'hkex' ? 'block' : 'hidden'}>
        <HkexPanel isMockMode={isMockMode} />
      </div>
      <div className={activeTab === 'sfc' ? 'block' : 'hidden'}>
        <SfcPanel isMockMode={isMockMode} />
      </div>
      <div className={activeTab === 'afrc' ? 'block' : 'hidden'}>
        <AfrcPanel isMockMode={isMockMode} />
      </div>
      <div className={activeTab === 'afrc-firm' ? 'block' : 'hidden'}>
        <AfrcFirmPanel isMockMode={isMockMode} />
      </div>
    </DashboardLayout>
  );
}
